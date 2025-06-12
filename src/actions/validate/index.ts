import { getConfiguration } from "../../lib/helpers/config";
import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";
import { FlowService } from "src/lib/services/flow-service";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const twilioServices = await prepareServices(configuration, twilioClient);

    let success = true;

    if (commands.getOptionalInput("VALIDATE_PREVIOUS_REVISION_USER") === "true") {
      const flowService = await FlowService(twilioClient);
      for (const flowConfig of configuration.flows) {
        let flowInstance: FlowInstance | null;
        if (!flowConfig.sid) {
          flowInstance = flowService.byNameOrNull(flowConfig.name);
        } else {
          flowInstance = flowService.bySidOrNull(flowConfig.sid);
        }

        if (flowInstance && !flowInstance.commitMessage?.startsWith("[AUTO DEPLOY]")) {
          success = false;
          commands.logError(
            `Flow ${flowConfig.name} (${flowInstance.sid}) was previously modified outside of the deployment process.`
          );
        }
      }
    }

    const replacements = await performReplacements(configuration, twilioServices, "dry");

    for (const replacement of replacements) {
      commands.startLogGroup(replacement.flow.name);

      commands.addSummaryHeader(`Flow \`${replacement.flow.name}\`:`);
      commands.addSummaryTable(replacement.changes);
      try {
        const validation = await twilioClient.studio.v2.flowValidate.update({
          friendlyName: replacement.flow.name,
          status: "published",
          definition: replacement.updatedDefinition,
        });
        if (validation.valid) {
          commands.logInfo("Passed ✅", "green");
        }
      } catch (err) {
        const errorList = (
          err as { details: { errors: Array<{ message: string; property_path: string }> } }
        ).details.errors;
        for (const error of errorList) {
          if (
            error.message.includes("null") &&
            error.property_path.endsWith("/properties/flow_sid")
          ) {
            continue;
          }
          commands.logError(JSON.stringify(error, undefined, 2));
          success = false;
        }
      }
      commands.endLogGroup();
    }
    await commands.writeSummary();
    if (!success) {
      commands.setFailed("Validation failed.");
    }
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
