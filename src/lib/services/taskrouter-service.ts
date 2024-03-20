import { Twilio } from "twilio";
import { commands } from "../helpers/commands";

interface ITaskrouterService {
  getChannelSidMap: () => Promise<Record<string, string>>;
  getWorkflowSidMap: () => Promise<Record<string, string>>;
}

export const TaskrouterService = async (client: Twilio): Promise<ITaskrouterService> => {
  try {
    const workspaces = await client.taskrouter.v1.workspaces.list();
    const flexWorkspace = workspaces[0];

    return {
      getChannelSidMap: async () => {
        const channels = await flexWorkspace.taskChannels().list();

        return channels.reduce(
          (prev, curr) => ({
            ...prev,
            [curr.uniqueName]: curr.sid,
          }),
          {}
        );
      },
      getWorkflowSidMap: async () => {
        const workflows = await flexWorkspace.workflows().list();

        return workflows.reduce(
          (prev, curr) => ({
            ...prev,
            [curr.friendlyName]: curr.sid,
          }),
          {}
        );
      },
    };
  } catch (err) {
    commands.setFailed(`Failed to fetch Taskrouter Workspace: ${err}`);
    return {} as any;
  }
};
