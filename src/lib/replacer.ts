import { readFileSync } from "fs";
import { commands } from "./helpers/commands";
import { ConfigFile } from "./helpers/config";
import { studioFlowSchema, getManagedWidgets } from "./helpers/studio-schemas";
import {
  updateRunFunctionWidgets,
  updateSendToFlexWidgets,
  updateRunSubflowWidgets,
  updateSetVariableWidgets,
} from "./helpers/widgets";
import { TwilioServices } from "./prepare-services";

export const performReplacements = async (
  configuration: ConfigFile,
  twilioServices: TwilioServices,
  runMode: "deploy" | "dry"
) => {
  const { functionMap, channelMap, workflowMap, studioFlowMap } = twilioServices;

  const results = [];

  const sortedFlows = [...configuration.flows].sort((first, second) =>
    first.subflow === second.subflow ? 0 : first.subflow ? -1 : 1
  );

  for (const flowConfig of sortedFlows) {
    commands.startLogGroup(flowConfig.name);
    const flowJsonContent = readFileSync(flowConfig.path, "utf8");
    const studioFlowDefinition = studioFlowSchema.parse(JSON.parse(flowJsonContent));

    const changes = [];

    const managedWidgets = getManagedWidgets(studioFlowDefinition, configuration);

    if (configuration.replaceWidgetTypes.includes("run-function")) {
      const res = updateRunFunctionWidgets(managedWidgets, functionMap);
      changes.push(...res.changes);
    }
    if (configuration.replaceWidgetTypes.includes("send-to-flex")) {
      const res = updateSendToFlexWidgets(managedWidgets, channelMap, workflowMap);
      changes.push(...res.changes);
    }
    if (configuration.replaceWidgetTypes.includes("run-subflow")) {
      const res = updateRunSubflowWidgets(managedWidgets, studioFlowMap);
      changes.push(...res.changes);
    }
    if (configuration.replaceWidgetTypes.includes("set-variables")) {
      const res = updateSetVariableWidgets(
        managedWidgets,
        configuration.variableReplacements ?? {}
      );
      changes.push(...res.changes);
    }

    for (const widget of managedWidgets) {
      const stateIndex = studioFlowDefinition.states.findIndex((s) => s.name === widget.name);
      studioFlowDefinition.states[stateIndex!] = widget;
    }

    results.push({
      flow: flowConfig,
      updatedDefinition: studioFlowDefinition,
      changes,
    });

    if (runMode === "deploy") {
      const { twilioClient } = twilioServices;

      if (!flowConfig.sid) {
        const sid = studioFlowMap[flowConfig.name];
        if (!sid) {
          if (flowConfig.allowCreate) {
            const createdFlow = await twilioClient.studio.v2.flows.create({
              friendlyName: flowConfig.name,
              definition: studioFlowDefinition,
              status: "published",
            });
            studioFlowMap[flowConfig.name] = createdFlow.sid;
          } else {
            // This branch should be unreachable due to prior checks
            commands.logError(
              `Flow '${flowConfig.name}' does not exist and does not have 'allowCreate' enabled. Skipped.`
            );
          }
        } else {
          await twilioClient.studio.v2.flows(sid).update({
            definition: studioFlowDefinition,
            status: "published",
          });
        }
      } else {
        await twilioClient.studio.v2.flows(flowConfig.sid).update({
          definition: studioFlowDefinition,
          status: "published",
        });
      }
    }
    commands.endLogGroup();
  }

  return results;
};
