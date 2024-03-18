import { Twilio } from "twilio";
import { commands } from "./commands";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";

interface IFlowService {
  byName: (friendlyName: string) => FlowInstance;
  bySid: (sid: string) => FlowInstance;
}

export const FlowService = async (client: Twilio): Promise<IFlowService> => {
  try {
    const flowList = await client.studio.v2.flows.list();

    return {
      byName: (friendlyName) => {
        const flow = flowList.find((f) => f.friendlyName === friendlyName);
        if (!flow) {
          commands.setFailed(`No Studio Flow with friendlyName '${friendlyName}' was found.`);
          return {} as FlowInstance; // Program will exit
        }
        return flow;
      },
      bySid: (sid) => {
        const flow = flowList.find((f) => f.sid === sid) || null;
        if (!flow) {
          commands.setFailed(`No Studio Flow with sid '${sid}' was found.`);
          return {} as FlowInstance; // Program will exit
        }
        return flow;
      },
    };
  } catch (err) {
    commands.setFailed(`Failed to fetch Studio Flows: ${err}`);
    return {} as any;
  }
};
