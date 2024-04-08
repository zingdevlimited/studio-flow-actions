import github from "@actions/github";
import { commands } from "../helpers/commands";

interface IGithubService {
  commitFiles: (
    files: Array<{ path: string; content: string }>,
    branch: string,
    message: string
  ) => Promise<void>;
  openPullRequest: (branch: string, title: string, body: string) => Promise<void>;
  getFileContent: (path: string, tag: string) => Promise<string>;
}

const GH_FILE_MODE = "100644" as const;

export const GithubService = (ghToken: string): IGithubService => {
  const octokit = github.getOctokit(ghToken).rest;

  const { GITHUB_REPOSITORY, GITHUB_ACTOR, GITHUB_SERVER_URL, GITHUB_REF_NAME, GITHUB_RUN_ID } =
    process.env;
  const [owner, repo] = process.env.GITHUB_REPOSITORY!.split("/");

  return {
    commitFiles: async (files, branch, message) => {
      const fileListTree = files.map((f) => ({
        path: f.path,
        mode: GH_FILE_MODE,
        content: f.content,
      }));

      const commits = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });
      const latestCommitSha = commits.data[0].sha;
      const treeSha = commits.data[0].commit.tree.sha;

      const newTree = await octokit.git.createTree({
        owner,
        repo,
        tree: fileListTree,
        base_tree: treeSha,
      });

      const newCommit = await octokit.git.createCommit({
        owner,
        repo,
        tree: newTree.data.sha,
        message,
        parents: [latestCommitSha],
        author: {
          name: `${GITHUB_ACTOR}`,
          email: `${GITHUB_ACTOR}@users.noreply.github.com`,
        },
      });

      await octokit.git.createRef({
        owner,
        repo,
        sha: newCommit.data.sha,
        ref: `refs/heads/${branch}`,
      });
    },
    openPullRequest: async (branch, title, body) => {
      const pullRequest = await octokit.pulls.create({
        owner,
        repo,
        head: branch,
        base: GITHUB_REF_NAME!,
        title,
        body: `${body}\n\nGenerated from run: <${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}>`,
      });
      commands.logInfo(`Created Pull Request: ${pullRequest.data.html_url}`);
    },
    getFileContent: async (path, tag) => {
      const contentResponse = await octokit.repos.getContent({
        owner,
        repo,
        path,
        tag,
      });
      const content = Buffer.from((contentResponse.data as any).content, "base64").toString();
      return content;
    },
  };
};
