import { Twilio } from "twilio";
import { commands } from "./commands";

interface ITaskrouterService {
  getChannelSidMap: () => Promise<Record<string, string>>;
}

export const TaskService = async (client: Twilio): Promise<ITaskrouterService> => {
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
    };
  } catch (err) {
    commands.setFailed(`Failed to fetch Taskrouter Workspace: ${err}`);
    return {} as any;
  }
};
