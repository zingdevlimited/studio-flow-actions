import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { getConfiguration } from "../../lib/helpers/config";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";
import { detectManualChangeForFlows } from "../../lib/services/manual-change-detector";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();
    const allowPartialDeploy = commands.getOptionalInput("ALLOW_PARTIAL_DEPLOY") === "true";
    let skipFlowNames: string[] = [];

    const twilioServices = await prepareServices(configuration, twilioClient);

    if (allowPartialDeploy) {
      const detectionResults = detectManualChangeForFlows(configuration.flows, twilioServices.flowService);
      const manuallyChangedFlows = detectionResults.filter((flow) => flow.status === "manually_changed");

      skipFlowNames = manuallyChangedFlows.map((flow) => flow.flowName);

      for (const flow of manuallyChangedFlows) {
        const flowId = flow.resolvedSid ?? flow.configuredSid ?? "Unknown SID";
        commands.logWarning(
          `Skipping deploy for ${flow.flowName} (${flowId}) because the latest revision appears to be manually changed.`
        );
      }

      if (manuallyChangedFlows.length > 0) {
        commands.addSummaryHeader("Flows skipped in partial deploy mode:");
        commands.addSummaryTable(
          manuallyChangedFlows.map((flow) => ({
            flow: flow.flowName,
            sid: flow.resolvedSid ?? flow.configuredSid ?? "Unknown",
            reason: flow.reason,
          }))
        );
      }
    }

    const results = await performReplacements(configuration, twilioServices, "deploy", {
      skipFlowNames,
    });

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
