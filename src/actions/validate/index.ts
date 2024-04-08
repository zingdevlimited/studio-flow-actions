import { getConfiguration } from "../../lib/helpers/config";
import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const twilioServices = await prepareServices(configuration, twilioClient);

    let success = true;

    const replacements = await performReplacements(configuration, twilioServices, "dry");

    for (const replacement of replacements) {
      commands.startLogGroup(replacement.flow.name);
      commands.writeSummaryTable(replacement.changes);
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
    if (!success) {
      commands.setFailed("Validation failed.");
    }
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
