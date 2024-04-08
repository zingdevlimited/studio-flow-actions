import { readFileLocalOrRemote, getConfiguration } from "../../lib/helpers/config";
import { getManagedWidgets, studioFlowSchema } from "../../lib/helpers/studio-schemas";
import { commands } from "../../lib/helpers/commands";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    let success = true;

    for (const flowConfig of configuration.flows) {
      commands.startLogGroup(flowConfig.name);
      const flowJsonContent = await readFileLocalOrRemote(flowConfig.path);
      const studioFlowDefinition = studioFlowSchema.parse(JSON.parse(flowJsonContent));

      // Run through parser and offline validation
      const result = getManagedWidgets(studioFlowDefinition, configuration);
      if (result.some((w) => w === null)) {
        success = false;
      } else {
        commands.logInfo("Passed ✅", "green");
      }
      commands.endLogGroup();
    }

    if (!success) {
      commands.setFailed("Check failed.");
    }
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
