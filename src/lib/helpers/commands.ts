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
  logError: (message: string) => {
    if (githubActions) {
      core.error(message);
    } else {
      const logMessage = applyMasks(message);
      console.error(color.red(logMessage));
    }
  },
  logWarning: (message: string) => {
    if (githubActions) {
      core.warning(message);
    } else {
      const logMessage = color.yellow(applyMasks(message));
      console.warn(logMessage);
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
  getInput: (inputName: string, secret?: boolean) => {
    if (githubActions) {
      let value: string | undefined = core.getInput(inputName);
      if (!value) {
        value = process.env[inputName]?.trim(); // Fallback to environment variable
      }
      if (!value) {
        core.error(
          `Missing variable '${inputName}'. Add to either Action Inputs or Environment Variables`
        );
        exit(1);
      }
      if (secret) {
        commands.maskValue(value);
      }
      return value;
    } else {
      const value = process.env[inputName]?.trim();
      if (value) {
        if (secret) {
          commands.maskValue(value);
        }
        return value;
      } else {
        console.error(color.red(`Missing Environment Variable: ${inputName}`));
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
      console.error(color.red(applyMasks(message)));
      exit(1);
    }
  },
  writeSummaryTable: (rows: any[]) => {
    if (!rows.length) {
      return;
    }
    if (githubActions) {
      const headings = Object.keys(rows[0]);
      const headerRow = headings.map((h) => ({ header: true, data: h }));
      const dataRows = rows.map((row) => headings.map((h) => row[h]));

      core.summary.addTable([headerRow, ...dataRows]);
      console.log(headerRow);
      console.log(dataRows);

      console.table(rows);
    } else {
      console.table(rows);
    }
  },
};
