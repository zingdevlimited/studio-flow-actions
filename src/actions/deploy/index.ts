import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { getConfiguration } from "../../lib/helpers/config";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const twilioServices = await prepareServices(configuration, twilioClient);

    const results = await performReplacements(configuration, twilioServices, "deploy");

    for (const result of results) {
      commands.addSummaryHeader(`Flow \`${result.flow.name}\`:`);
      commands.addSummaryTable(result.changes);
    }
    await commands.writeSummary();
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
