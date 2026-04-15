import { ConfigFile } from "../helpers/config";
import { IFlowService } from "./flow-service";

export type ManualChangeStatus = "auto_deployed" | "manually_changed" | "flow_missing";

export interface ManualChangeDetectionResult {
  flowName: string;
  configuredSid?: string;
  resolvedSid?: string;
  commitMessage?: string;
  status: ManualChangeStatus;
  reason: string;
}

type FlowConfigEntry = ConfigFile["flows"][number];

export const detectManualChangeForFlow = (
  flowConfig: FlowConfigEntry,
  flowService: IFlowService
): ManualChangeDetectionResult => {
  const flowInstance = flowConfig.sid
    ? flowService.bySidOrNull(flowConfig.sid) ?? flowService.byNameOrNull(flowConfig.name)
    : flowService.byNameOrNull(flowConfig.name);

  if (!flowInstance) {
    return {
      flowName: flowConfig.name,
      configuredSid: flowConfig.sid,
      status: "flow_missing",
      reason: "Flow could not be found in the account.",
    };
  }

  const commitMessage = flowInstance.commitMessage;
  if (commitMessage?.startsWith("[Auto Deploy]")) {
    return {
      flowName: flowConfig.name,
      configuredSid: flowConfig.sid,
      resolvedSid: flowInstance.sid,
      commitMessage,
      status: "auto_deployed",
      reason: "Last revision was created by the deployment pipeline.",
    };
  }

  return {
    flowName: flowConfig.name,
    configuredSid: flowConfig.sid,
    resolvedSid: flowInstance.sid,
    commitMessage,
    status: "manually_changed",
    reason:
      "Latest revision does not start with [Auto Deploy] and is treated as manually changed.",
  };
};

export const detectManualChangeForFlows = (
  flows: ConfigFile["flows"],
  flowService: IFlowService
): ManualChangeDetectionResult[] => flows.map((flow) => detectManualChangeForFlow(flow, flowService));
