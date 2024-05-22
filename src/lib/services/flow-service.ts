import { Twilio } from "twilio";
import { commands } from "../helpers/commands";
import { FlowInstance } from "twilio/lib/rest/studio/v2/flow";

interface IFlowService {
  byName: (friendlyName: string) => FlowInstance;
  byNameOrNull: (friendlyName: string) => FlowInstance | null;
  bySid: (sid: string) => FlowInstance;
  bySidOrNull: (sid: string) => FlowInstance | null;
  getFlowSidMap: () => Record<string, string>;
  getDefinition: (sid: string) => Promise<Record<string, unknown>>;
}

export const FlowService = async (client: Twilio): Promise<IFlowService> => {
  try {
    commands.logDebug("FlowService: Initiate");
    const flowList = await client.studio.v2.flows.list();
    return {
      byName: (friendlyName) => {
        commands.logDebug(`FlowService: Get by name ${friendlyName}`);
        const flow = flowList.find((f) => f.friendlyName === friendlyName);
        if (!flow) {
          commands.setFailed(`No Studio Flow with friendlyName '${friendlyName}' was found.`);
          return {} as FlowInstance; // Program will exit
        }
        return flow;
      },
      byNameOrNull: (friendlyName) => flowList.find((f) => f.friendlyName === friendlyName) ?? null,
      bySid: (sid) => {
        commands.logDebug(`FlowService: Get by sid ${sid}`);
        const flow = flowList.find((f) => f.sid === sid) || null;
        if (!flow) {
          commands.setFailed(`No Studio Flow with sid '${sid}' was found.`);
          return {} as FlowInstance; // Program will exit
        }
        return flow;
      },
      bySidOrNull: (sid) => flowList.find((f) => f.sid === sid) ?? null,
      getFlowSidMap: () => {
        commands.logDebug("FlowService: Get Flow Sid Map");
        return flowList.reduce(
          (prev, curr) => ({
            ...prev,
            [curr.friendlyName]: curr.sid,
          }),
          {}
        );
      },
      getDefinition: async (sid) => (await client.studio.v2.flows(sid).fetch()).definition,
    };
  } catch (err) {
    commands.setFailed(`Failed to fetch Studio Flows: ${err}`);
    return {} as any;
  }
};
