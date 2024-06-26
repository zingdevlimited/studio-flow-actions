import { Twilio } from "twilio";
import { commands } from "../helpers/commands";

interface ITaskrouterService {
  getChannelSidMap: () => Promise<Record<string, string>>;
  getWorkflowSidMap: () => Promise<Record<string, string>>;
}

export const TaskrouterService = async (client: Twilio): Promise<ITaskrouterService> => {
  try {
    commands.logDebug("TaskrouterService: Initialize");
    const workspaces = await client.taskrouter.v1.workspaces.list();
    const flexWorkspace = workspaces.length ? workspaces[0] : null;

    return {
      getChannelSidMap: async () => {
        if (!flexWorkspace) {
          return {};
        }
        commands.logDebug("TaskrouterService: List TaskChannels");
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
        if (!flexWorkspace) {
          return {};
        }
        commands.logDebug("TaskrouterService: List Workflows");
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
