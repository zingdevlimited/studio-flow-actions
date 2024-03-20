import { z } from "zod";
import { MANAGED_WIDGET_TYPES } from "./studio-schemas";
import { existsSync, readFileSync } from "fs";
import { commands } from "./commands";

export const configFileSchema = z.object({
  flows: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      sid: z.string().optional(),
      subflow: z.boolean().default(false),
      allowCreate: z.boolean().default(false),
    })
  ),
  replaceWidgetTypes: z.array(z.enum(MANAGED_WIDGET_TYPES)).default([]),
  functionServices: z
    .array(
      z.object({
        name: z.string(),
        environmentSuffix: z.union([z.string(), z.null()]),
      })
    )
    .optional(),
  workflowMap: z.record(z.string()).optional(),
  subflowMap: z.record(z.string()).optional(),
  variableReplacements: z.record(z.string()).optional(),
  enableShellVariables: z.boolean().default(false),
});

export type ConfigFile = z.infer<typeof configFileSchema>;

const replaceShellVariables = <T>(configuration: T) => {
  const envVarRegex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;

  const configJson = JSON.stringify(configuration);

  const replacedJson = configJson.replace(envVarRegex, (_, variable) => {
    return process.env[variable] || "";
  });

  return JSON.parse(replacedJson) as T;
};

export const getConfiguration = () => {
  const configPath = commands.getInput("CONFIG_PATH");

  if (!existsSync(configPath)) {
    commands.setFailed(`
CONFIG_PATH path '${configPath}' could not be found.
Possible causes:
  - The runner has not checked out the repository with actions/checkout
  - The path to the file does not begin at the root of the repository
`);
    return {} as ConfigFile;
  }
  const configFileContent = readFileSync(configPath, "utf8");
  const configurationParseResult = configFileSchema.safeParse(JSON.parse(configFileContent));

  if (!configurationParseResult.success) {
    commands.setFailed(
      `Failed to parse Configuration file:\n${configurationParseResult.error.message}`
    );
    return {} as ConfigFile;
  }
  let configuration = configurationParseResult.data;

  if (configuration.enableShellVariables) {
    configuration = replaceShellVariables(configuration);
  }

  return configuration;
};
