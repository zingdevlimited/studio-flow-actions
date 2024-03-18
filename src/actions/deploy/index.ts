import { existsSync, readFileSync } from "fs";
import { commands } from "../../lib/commands";
import { getTwilioClient } from "../../lib/twilio-client";
import { configFileSchema, replaceShellVariables } from "../../lib/config";
import { getFunctionServices } from "../../lib/serverless";
import { getManagedWidgets, studioFlowSchema } from "../../lib/studio-schemas";
import { updateRunFunctionWidgets, updateSendToFlexWidgets } from "../../lib/widgets";

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

  const configFileContent = readFileSync(configPath, "utf8");
  let configuration = configFileSchema.parse(JSON.parse(configFileContent));

  if (configuration.enableShellVariables) {
    configuration = replaceShellVariables(configuration);
  }

  let functionMap = {};
  const workflowMap = configuration.workflowMap;

  if (configuration.functionServices) {
    functionMap = await getFunctionServices(twilioClient, configuration.functionServices);
  }

  for (const flowConfig of configuration.flows) {
    const flowJsonContent = readFileSync(flowConfig.path, "utf8");
    const studioFlow = studioFlowSchema.parse(flowJsonContent);

    const managedWidgets = getManagedWidgets(studioFlow);

    if (configuration.replaceWidgetTypes.includes("run-function")) {
      updateRunFunctionWidgets(managedWidgets, functionMap);
    }
    if (configuration.replaceWidgetTypes.includes("send-to-flex")) {
      updateSendToFlexWidgets(managedWidgets, channelMap, workflowMap!);
    }
    // Update all

    for (const widget of managedWidgets) {
      const stateIndex = studioFlow.states.findIndex((s) => s.name === widget.name);
      studioFlow.states[stateIndex!] = widget;
    }

    // Save back the Studio Flow object
  }
};
run();
