import { commands } from "../../lib/commands";
import { getTwilioClient } from "../../lib/twilio-client";
import { existsSync, readFileSync, writeFileSync } from "fs";

import { FlowService } from "../../lib/flow-service";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";
import { configFileSchema } from "../../lib/config";
import { GithubService } from "../../lib/github-service";

const run = async () => {
  const configPath = commands.getInput("CONFIG_PATH");
  const twilioClient = getTwilioClient();

  if (!existsSync(configPath)) {
    commands.setFailed(`
CONFIG_PATH path '${configPath}' could not be found.
Possible causes:
  - The runner has not checked out the repository with actions/checkout
  - The path to the file does not begin at the root of the repository
`);
    return;
  }

  const configObject = configFileSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));

  const flowService = await FlowService(twilioClient);

  const flowWrites = [];

  for (const flow of configObject.flows) {
    let flowInstance: FlowInstance;
    if (!flow.sid) {
      flowInstance = flowService.byName(flow.name);
    } else {
      flowInstance = flowService.bySid(flow.sid);
    }
    const friendlyName = flowInstance.friendlyName;
    const sid = flowInstance.sid;
    const revision = flowInstance.revision;

    const fileContent = JSON.stringify(flowInstance.definition);

    writeFileSync(flow.path, fileContent, "utf8");
    flowWrites.push({ path: flow.path, friendlyName, sid, revision, content: fileContent });
  }

  if (process.env.GITHUB_REPOSITORY) {
    const { GITHUB_RUN_NUMBER } = process.env;
    const ghToken = commands.getInput("TOKEN");
    commands.maskValue(ghToken);
    const githubService = GithubService(ghToken);

    const branch = `studio-flow/update-run-${GITHUB_RUN_NUMBER}`;

    await githubService.commitFiles(
      flowWrites,
      branch,
      `auto: Sync studio flow definitions (${GITHUB_RUN_NUMBER})`
    );

    const body = flowWrites
      .map(
        (f) =>
          `- ${f.path}\n\t- Friendly Name: ${f.friendlyName}\n\t- Sid: ${f.sid}\n\t- Revision: ${f.revision}`
      )
      .join("\n");

    await githubService.openPullRequest(branch, `Sync Flow Files (Run ${GITHUB_RUN_NUMBER})`, body);
  }
};
run();
