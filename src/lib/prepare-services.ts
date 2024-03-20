import { Twilio } from "twilio";
import { ConfigFile } from "./helpers/config";
import { FlowService } from "./services/flow-service";
import { TaskrouterService } from "./services/taskrouter-service";
import { FunctionsMap, getFunctionServices } from "./services/serverless";

export const prepareServices = async (configuration: ConfigFile, twilioClient: Twilio) => {
  const taskrouterService = await TaskrouterService(twilioClient);
  const flowService = await FlowService(twilioClient);

  let functionMap: FunctionsMap = {};
  let workflowMap = await taskrouterService.getWorkflowSidMap();
  const channelMap = await taskrouterService.getChannelSidMap();
  let studioFlowMap = flowService.getFlowSidMap();

  if (configuration.workflowMap) {
    workflowMap = {
      ...workflowMap,
      ...configuration.workflowMap,
    };
  }
  if (configuration.subflowMap) {
    studioFlowMap = {
      ...studioFlowMap,
      ...configuration.subflowMap,
    };
  }

  if (configuration.functionServices) {
    functionMap = await getFunctionServices(twilioClient, configuration.functionServices);
  }

  configuration.flows.forEach((f) => {
    // Validate the flows exist
    if (f.sid) {
      flowService.bySid(f.sid);
    } else if (!f.allowCreate) {
      flowService.byName(f.name);
    }
  });

  return {
    functionMap,
    workflowMap,
    channelMap,
    studioFlowMap,
    twilioClient,
  };
};

export type TwilioServices = Awaited<ReturnType<typeof prepareServices>>;
