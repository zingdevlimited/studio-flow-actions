import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { mkdirSync, writeFileSync } from "fs";
import color from "ansi-colors";
import { FlowService, IFlowService } from "../../lib/services/flow-service";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";
import { ConfigFile, getConfiguration, tryReadFileLocalOrRemote } from "../../lib/helpers/config";
import { GithubService } from "../../lib/services/github-service";
import { basename, dirname } from "path";
import {
  ManagedWidget,
  StudioFlow,
  addPropertyToFlexAttributesString,
  getManagedWidgets,
  parseSendToFlexRequiredAttributes,
  studioFlowSchema,
} from "../../lib/helpers/studio-schemas";
import { TaskrouterService } from "../../lib/services/taskrouter-service";
import {
  convertMermaidDiagramToSvg,
  generateMermaidDiffDiagram,
  generateMermaidSingleDiagram,
} from "src/lib/helpers/mermaid-diagram";
import { Twilio } from "twilio";

const autoAddMissingWidgetProperties = async (
  twilioClient: Twilio,
  flowService: IFlowService,
  configuration: ConfigFile,
  friendlyName: string,
  studioFlowDefinition: StudioFlow
) => {
  const adjustments = [];

  const taskrouterService = await TaskrouterService(twilioClient);
  const remoteWorkflowMap = await taskrouterService.getWorkflowSidMap();
  const remoteChannelMap = await taskrouterService.getChannelSidMap();

  for (const state of studioFlowDefinition.states) {
    if (state.type === "send-to-flex") {
      const widgetProperties = (state as ManagedWidget & { type: "send-to-flex" }).properties;
      let attributesString = widgetProperties.attributes ?? "{}";
      const existing = parseSendToFlexRequiredAttributes(attributesString);

      if (!existing.workflowName) {
        let workflowName: string | undefined = undefined;
        if (configuration.workflowMap) {
          workflowName = Object.keys(configuration.workflowMap).find(
            (key) => configuration.workflowMap![key] === widgetProperties.workflow
          );
        }
        if (!workflowName) {
          workflowName = Object.keys(remoteWorkflowMap).find(
            (key) => remoteWorkflowMap[key] === widgetProperties.workflow
          );
        }
        if (!workflowName) {
          commands.setFailed(
            `[${friendlyName}][${state.name}]: Workflow with sid ${widgetProperties.workflow} does not exist on this Twilio account. Please select a valid workflow through the Studio Flow editor.`
          );
          continue;
        }

        attributesString = addPropertyToFlexAttributesString(
          attributesString,
          "workflowName",
          workflowName
        );

        adjustments.push(`- **${state.name}.attributes.workflowName** <- \`${workflowName}\``);
      }

      if (!existing.channelName) {
        const channelName = Object.keys(remoteChannelMap).find(
          (key) => remoteChannelMap[key] === widgetProperties.channel
        );
        if (!channelName) {
          commands.setFailed(
            `[${friendlyName}][${state.name}]: TaskChannel with sid ${widgetProperties.channel} does not exist on this Twilio account. Please select a valid channel through the Studio Flow editor.`
          );
          continue;
        }

        attributesString = addPropertyToFlexAttributesString(
          attributesString,
          "channelName",
          channelName
        );

        adjustments.push(`- **${state.name}.attributes.channelName** <- \`${channelName}\``);
      }

      widgetProperties.attributes = attributesString;
    } else if (state.type === "run-subflow") {
      const widgetProperties = (state as ManagedWidget & { type: "run-subflow" }).properties;
      if (!widgetProperties.parameters.find((p) => p.key === "subflowName")) {
        let subflowName: string | undefined = undefined;
        if (configuration.subflowMap) {
          subflowName = Object.keys(configuration.subflowMap).find(
            (key) => configuration.subflowMap![key] === widgetProperties.flow_sid
          );
        }
        if (!subflowName) {
          const subflowInstance = flowService.bySidOrNull(widgetProperties.flow_sid);
          if (!subflowInstance) {
            commands.setFailed(
              `[${friendlyName}][${state.name}]: Subflow with sid ${widgetProperties.flow_sid} does not exist on this Twilio account. Please select a valid subflow through the Studio Flow editor.`
            );
            continue;
          }
          subflowName = subflowInstance.friendlyName;
        }

        widgetProperties.parameters.push({
          key: "subflowName",
          value: subflowName,
          type: "string",
        });
        adjustments.push(`- **${state.name}.parameters.subflowName** <- \`${subflowName}\``);
      }
    }
  }

  return { adjustments };
};

const run = async () => {
  try {
    let success = true;
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const flowService = await FlowService(twilioClient);

    const flowWrites = [];

    for (const flowConfig of configuration.flows) {
      commands.startLogGroup(flowConfig.name);

      let oldFlowDefinition;
      const localFile = await tryReadFileLocalOrRemote(flowConfig.path);
      if (localFile) {
        oldFlowDefinition = studioFlowSchema.parse(JSON.parse(localFile));
      } else {
        oldFlowDefinition = null;
      }

      let flowInstance: FlowInstance;
      if (!flowConfig.sid) {
        flowInstance = flowService.byName(flowConfig.name);
      } else {
        flowInstance = flowService.bySid(flowConfig.sid);
      }
      const friendlyName = flowInstance.friendlyName;
      const flowSid = flowInstance.sid;
      const revision = flowInstance.revision;
      const definition = await flowService.getDefinition(flowSid);
      const studioFlowDefinition = studioFlowSchema.parse(definition);

      let adjustments: string[] = [];
      if (commands.getOptionalInput("ADD_MISSING_DEPLOY_PROPERTIES") === "true") {
        const autoAddResult = await autoAddMissingWidgetProperties(
          twilioClient,
          flowService,
          configuration,
          friendlyName,
          studioFlowDefinition
        );
        adjustments = autoAddResult.adjustments;
      }

      // Sort states by name
      studioFlowDefinition.states = [
        ...studioFlowDefinition.states.filter((state) => state.type === "trigger"),
        ...studioFlowDefinition.states
          .filter((state) => state.type !== "trigger")
          .sort((a, b) => a.name.localeCompare(b.name)),
      ];

      const fileContent = JSON.stringify(studioFlowDefinition, undefined, 2);

      if (commands.getOptionalInput("DISABLE_CHECK") !== "true") {
        // Run through parser and offline validation
        const result = getManagedWidgets(studioFlowDefinition, configuration);
        if (result.some((w) => w === null)) {
          success = false;
          continue;
        }
      }

      mkdirSync(dirname(flowConfig.path), { recursive: true });
      writeFileSync(flowConfig.path, fileContent, "utf8");
      flowWrites.push({
        path: flowConfig.path,
        friendlyName,
        sid: flowSid,
        revision,
        content: fileContent,
        adjustments,
        old: oldFlowDefinition,
        new: studioFlowDefinition,
      });

      commands.logInfo(
        `Updated ${color.blue(flowConfig.path)} from ${color.yellow(friendlyName)}/${color.magenta(flowSid)} Revision ${color.cyan(revision.toString())}`
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
      const filesToCommit: Array<{ path: string; content: string }> = [...flowWrites];

      const saveDiagramsPath = commands.getOptionalInput("SAVE_DIAGRAMS_TO_PATH");
      if (saveDiagramsPath) {
        commands.logInfo("Generating diagrams...");
        for (const flow of flowWrites) {
          const diagram = generateMermaidSingleDiagram(flow.new);
          if (!diagram) continue;
          const svgContent = await convertMermaidDiagramToSvg(diagram.content);

          filesToCommit.push({
            path: `${saveDiagramsPath}/${basename(flow.path, ".json")}.svg`,
            content: svgContent,
          });
        }
      }

      await githubService.commitFiles(
        filesToCommit,
        branch,
        `auto: Sync studio flow definitions (${GITHUB_RUN_NUMBER})`
      );

      let prBody = "";
      for (const f of flowWrites) {
        let flowString = `- \`${f.path}\``;
        flowString = `${flowString}\n\t- **Friendly Name**: ${f.friendlyName}`;
        flowString = `${flowString}\n\t- **Sid**: ${f.sid}`;
        flowString = `${flowString}\n\t- **Revision**: ${f.revision}`;

        if (f.adjustments.length) {
          flowString = `${flowString}\n\t- **Adjustments**:\n\t\t${f.adjustments.join("\n\t\t")}`;
        }

        const mermaid = generateMermaidDiffDiagram(f.old ?? f.new, f.new);
        if (mermaid) {
          if (mermaid.edgeCount > 500) {
            flowString = `${flowString}\n*Could not render change preview. Too many edges*`;
          } else if (mermaid.content.length + flowString.length + prBody.length > 60000) {
            flowString = `${flowString}\n*Could not render change preview. Exceeds PR character limit*`;
          } else {
            flowString = `${flowString}\n\`\`\`mermaid\n${mermaid.content}\n\`\`\``;
          }
        }
        prBody = `${prBody}\n${flowString}`;
      }

      await githubService.openPullRequest(
        branch,
        `Sync Flow Files (Run ${GITHUB_RUN_NUMBER})`,
        prBody
      );
    }
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
