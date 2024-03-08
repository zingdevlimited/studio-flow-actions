import * as core from "@actions/core";
import { exit } from "process";
import color from "ansi-colors";

type LogColors = "red" | "blue" | "yellow" | "green" | "gray" | "cyan" | "magenta";

const githubActions = process.env.GITHUB_ACTIONS === "true";

const maskedValues: string[] = [];

const applyMasks = (text: string) => {
  let maskedText = text;
  for (const mask of maskedValues) {
    maskedText = maskedText.replaceAll(mask, "***");
  }
  return maskedText;
};

const isMasked = (text: string) => maskedValues.some((v) => text.includes(v));

export const commands = {
  logError: (message: string, properties?: core.AnnotationProperties) => {
    if (githubActions) {
      core.error(message, properties);
    } else {
      const logMessage = applyMasks(message);
      console.error(
        color.red(`(${properties?.file ?? ""}:${properties?.startLine ?? ""}) ${logMessage}`)
      );
    }
  },
  logWarning: (message: string, properties?: core.AnnotationProperties) => {
    if (githubActions) {
      core.warning(message, properties);
    } else {
      const logMessage = color.yellow(applyMasks(message));
      console.warn(`(${properties?.file ?? ""}:${properties?.startLine ?? ""}) ${logMessage}`);
    }
  },
  logInfo: (message: string, textColor?: LogColors) => {
    const logMessage = textColor ? color[textColor](message) : message;
    if (githubActions) {
      core.info(logMessage);
    } else {
      console.log(applyMasks(logMessage));
    }
  },
  logDebug: (message: string) => {
    if (githubActions) {
      core.debug(message);
    } else {
      if (process.env.DEBUG_MODE === "true") {
        const logMessage = applyMasks(message);
        console.log(color.gray(`[DEBUG] ${logMessage}`));
      }
    }
  },
  startLogGroup: (groupName: string) => {
    if (githubActions) {
      core.startGroup(groupName);
    } else {
      console.log(color.gray(`===== ${groupName} =====`));
    }
  },
  endLogGroup: () => {
    if (githubActions) {
      core.endGroup();
    } else {
      console.log(color.gray("====="));
    }
  },
  getInput: (inputName: string) => {
    if (githubActions) {
      let value: string | undefined = core.getInput(inputName);
      if (!value) {
        value = process.env[inputName]; // Fallback to environment variable
      }
      if (!value) {
        console.error(
          `Missing variable '${inputName}'. Add to either Action Inputs or Environment Variables`
        );
        exit(1);
      }
      return value;
    } else {
      const value = process.env[inputName];
      if (value) {
        return value;
      } else {
        console.error(`Missing Environment Variable: ${inputName}`);
        exit(1);
      }
    }
  },
  getOptionalInput: (inputName: string) => {
    if (githubActions) {
      return core.getInput(inputName) || process.env[inputName];
    } else {
      return process.env[inputName];
    }
  },
  maskValue: (value: string) => {
    if (githubActions) {
      core.setSecret(value);
    } else {
      maskedValues.push(value);
    }
  },
  setOutput: (outputKey: string, value: string) => {
    if (githubActions) {
      core.setOutput(outputKey, value);
    } else {
      if (isMasked(value)) {
        console.warn(`Output '${outputKey}' tried to output a masked value.`);
        return;
      }
      // Can be received with eval if required
      console.log(`export ${outputKey}=${value}`);
    }
  },
  setFailed: (message: string) => {
    if (githubActions) {
      core.setFailed(message);
    } else {
      console.error(applyMasks(message));
      exit(1);
    }
  },
};
