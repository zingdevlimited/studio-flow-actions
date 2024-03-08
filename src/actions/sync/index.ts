import { commands } from "../../lib/commands";
import { getTwilioClient } from "../../lib/twilio-client";
import { existsSync, writeFileSync } from "fs";
import github from "@actions/github";
import { basename } from "path";

const GH_FILE_MODE = "100644";

const run = async () => {
  const twilioClient = getTwilioClient();

  const ghToken = commands.getInput("TOKEN");
  commands.maskValue(ghToken);
  const octokit = github.getOctokit(ghToken).rest;

  const localFilePath = commands.getInput("LOCAL_FILE");

  if (!existsSync(localFilePath)) {
    commands.setFailed(`
LOCAL_FILE path '${localFilePath}' could not be found.
Possible causes:
  - The runner has not checked out the repository with actions/checkout
  - The path to the file does not begin at the root of the repository
`);
    return;
  }

  let flowInstance;
  let flowList;
  try {
    flowList = await twilioClient.studio.v2.flows.list();
  } catch (err) {
    commands.setFailed(`Failed to fetch Studio Flows: ${err}`);
    return;
  }

  const flowSid = commands.getOptionalInput("FLOW_SID");

  if (!flowSid) {
    const flowName = commands.getOptionalInput("FLOW_NAME");

    if (!flowName) {
      commands.setFailed("Input 'FLOW_SID' or 'FLOW_NAME' is required.");
      return;
    }
    flowInstance = flowList.find((f) => f.friendlyName === flowName);

    if (!flowInstance) {
      commands.setFailed(`No Studio Flow with friendlyName '${flowName}' was found.`);
      return;
    }
  } else {
    flowInstance = flowList.find((f) => f.sid === flowSid);

    if (!flowInstance) {
      commands.setFailed(`No Studio Flow with sid '${flowSid}' was found.`);
      return;
    }
  }

  const friendlyName = flowInstance.friendlyName;
  const sid = flowInstance.sid;
  const revision = flowInstance.revision;

  const fileContent = JSON.stringify(flowInstance.definition);

  writeFileSync(localFilePath, fileContent, "utf8");

  if (process.env.GITHUB_REPOSITORY) {
    const { GITHUB_REPOSITORY, GITHUB_ACTOR, GITHUB_SERVER_URL, GITHUB_REF_NAME, GITHUB_RUN_ID } =
      process.env;

    // For running in Actions
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const fileName = basename(localFilePath);

    const commits = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 1,
    });
    const latestCommitSha = commits.data[0].sha;
    const treeSha = commits.data[0].commit.tree.sha;

    const commitMessage = `auto: Sync file '${fileName}' with ${friendlyName} Revision ${revision}`;

    const newTree = await octokit.git.createTree({
      owner,
      repo,
      tree: [
        {
          path: localFilePath,
          mode: GH_FILE_MODE,
          content: fileContent,
        },
      ],
      base_tree: treeSha,
    });

    const newCommit = await octokit.git.createCommit({
      owner,
      repo,
      tree: newTree.data.sha,
      message: commitMessage,
      parents: [latestCommitSha],
      author: {
        name: `${GITHUB_ACTOR}`,
        email: `${GITHUB_ACTOR}@users.noreply.github.com`,
      },
    });

    const branchName = `studio-flow/${sid}_${revision}`;

    await octokit.git.createRef({
      owner,
      repo,
      sha: newCommit.data.sha,
      ref: `refs/heads/${branchName}`,
    });

    const prBody = `
- File: ${localFilePath}
- Flow Name: ${friendlyName}
- Flow SID: ${sid}
- Flow Revision: ${revision}

Generated from run: <${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}>
`;

    const pullRequest = await octokit.pulls.create({
      owner,
      repo,
      head: branchName,
      base: GITHUB_REF_NAME!,
      title: `Sync Studio Flow ${fileName} with Revision ${revision}`,
      body: prBody,
    });

    commands.logInfo(`Created Pull Request: ${pullRequest.data.html_url}`);
  }
};
run();
