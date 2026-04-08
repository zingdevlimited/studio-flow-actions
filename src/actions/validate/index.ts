import { getConfiguration } from "../../lib/helpers/config";
import { commands } from "../../lib/helpers/commands";
import { getTwilioClient } from "../../lib/helpers/twilio-client";
import { prepareServices } from "../../lib/prepare-services";
import { performReplacements } from "../../lib/replacer";
import { FlowService } from "../../lib/services/flow-service";
import { detectManualChangeForFlows } from "../../lib/services/manual-change-detector";

const run = async () => {
  try {
    const configuration = await getConfiguration();
    const twilioClient = getTwilioClient();

    const twilioServices = await prepareServices(configuration, twilioClient);

    let success = true;
    const allowPartialDeploy = commands.getOptionalInput("ALLOW_PARTIAL_DEPLOY") === "true";
    let skipFlowNames: string[] = [];

    if (commands.getOptionalInput("VALIDATE_PREVIOUS_REVISION_USER") === "true") {
      const flowService = await FlowService(twilioClient);
      const detectionResults = detectManualChangeForFlows(configuration.flows, flowService);
      const manuallyChangedFlows = detectionResults.filter((flow) => flow.status === "manually_changed");

      if (allowPartialDeploy) {
        skipFlowNames = manuallyChangedFlows.map((flow) => flow.flowName);
      }

      for (const flow of manuallyChangedFlows) {
        const flowId = flow.resolvedSid ?? flow.configuredSid ?? "Unknown SID";
        if (allowPartialDeploy) {
          commands.logWarning(
            `Flow ${flow.flowName} (${flowId}) is blocked due to manual changes and will be skipped in partial mode.`
          );
        } else {
          success = false;
          commands.logError(
            `Flow ${flow.flowName} (${flowId}) was previously modified outside of the deployment process.`
          );
        }
      }

      const missingFlows = detectionResults.filter((flow) => flow.status === "flow_missing");
      for (const flow of missingFlows) {
        commands.logInfo(
          `Flow ${flow.flowName} was not found in the account and was not checked for manual changes.`
        );
      }

      if (allowPartialDeploy && manuallyChangedFlows.length > 0) {
        commands.addSummaryHeader("Manually changed flows skipped in partial mode:");
        commands.addSummaryTable(
          manuallyChangedFlows.map((flow) => ({
            flow: flow.flowName,
            sid: flow.resolvedSid ?? flow.configuredSid ?? "Unknown",
            reason: flow.reason,
          }))
        );
      }
    }

    const replacements = await performReplacements(configuration, twilioServices, "dry", {
      skipFlowNames,
    });

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
          commands.logError(`Error - ${JSON.stringify(error, undefined, 2)}`);
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
