import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { getConfiguration } from "../../lib/helpers/config";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";

const run = async () => {
  try {
    const configuration = getConfiguration();
    const twilioClient = getTwilioClient();

    const twilioServices = await prepareServices(configuration, twilioClient);

    const results = await performReplacements(configuration, twilioServices, "deploy");

    commands.writeSummaryTable(
      results.flatMap((r) => r.changes.map((c) => [c.widget, c.type, c.field, c.value]))
    );
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
