import { existsSync, readFileSync } from "fs";
import { commands } from "../../lib/commands";
import { getManagedWidgets, studioFlowSchema } from "../../lib/studio-schemas";

const run = () => {
  const localFilePath = commands.getInput("LOCAL_FILE");

  if (!existsSync(localFilePath)) {
    commands.setFailed(`
LOCAL_FILE path '${localFilePath}' could not be found.
Possible causes:
  - The runner has not checked out the repository with actions/checkout
  - The path to the file does not begin at the root of the repository
`);
    return;
  }

  const fileContent = readFileSync(localFilePath, "utf8");

  try {
    const studioFlow = studioFlowSchema.passthrough().parse(JSON.parse(fileContent));
    getManagedWidgets(studioFlow);
  } catch (err) {
    commands.setFailed((err as Error).message);
  }
};
run();
