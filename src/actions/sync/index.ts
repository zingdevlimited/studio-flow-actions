import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { mkdirSync, writeFileSync } from "fs";
import color from "ansi-colors";
import { FlowService } from "../../lib/services/flow-service";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";
import { getConfiguration } from "../../lib/helpers/config";
import { GithubService } from "../../lib/services/github-service";
import { dirname } from "path";
import { getManagedWidgets, studioFlowSchema } from "../../lib/helpers/studio-schemas";

const run = async () => {
  try {
    let success = true;
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const flowService = await FlowService(twilioClient);

    const flowWrites = [];

    for (const flowConfig of configuration.flows) {
      commands.startLogGroup(flowConfig.name);
      let flowInstance: FlowInstance;
      if (!flowConfig.sid) {
        flowInstance = flowService.byName(flowConfig.name);
      } else {
        flowInstance = flowService.bySid(flowConfig.sid);
      }
      const friendlyName = flowInstance.friendlyName;
      const sid = flowInstance.sid;
      const revision = flowInstance.revision;
      const definition = await flowService.getDefinition(sid);

      const fileContent = JSON.stringify(definition, undefined, 2);

      if (commands.getOptionalInput("DISABLE_CHECK") !== "true") {
        const studioFlowDefinition = studioFlowSchema.parse(definition);
        // Run through parser and offline validation
        const result = getManagedWidgets(studioFlowDefinition, configuration);
        if (result.some((w) => w === null)) {
          success = false;
          continue;
        }
      }

      const dirName = dirname(flowConfig.path);
      mkdirSync(dirName, { recursive: true });
      writeFileSync(flowConfig.path, fileContent, "utf8");
      flowWrites.push({ path: flowConfig.path, friendlyName, sid, revision, content: fileContent });

      commands.logInfo(
        `Updated ${color.blue(flowConfig.path)} from ${color.yellow(friendlyName)}/${color.magenta(sid)} Revision ${color.cyan(revision.toString())}`
      );
      commands.endLogGroup();
    }

    if (!success) {
      commands.setFailed("Check failed.");
    }

    if (process.env.GITHUB_REPOSITORY) {
      const { GITHUB_RUN_NUMBER } = process.env;
      const ghToken = commands.getInput("TOKEN", true);
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
            `- \`${f.path}\`\n\t- **Friendly Name**: ${f.friendlyName}\n\t- **Sid**: ${f.sid}\n\t- **Revision**: ${f.revision}`
        )
        .join("\n");

      await githubService.openPullRequest(
        branch,
        `Sync Flow Files (Run ${GITHUB_RUN_NUMBER})`,
        body
      );
    }
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
