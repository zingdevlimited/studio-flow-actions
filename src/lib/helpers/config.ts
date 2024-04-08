import { z } from "zod";
import { MANAGED_WIDGET_TYPES } from "./studio-schemas";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { commands } from "./commands";
import { GithubService } from "../services/github-service";

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
  customPropertyReplacements: z
    .array(
      z.object({
        flowName: z.string(),
        widgetName: z.string(),
        propertyKey: z.string(),
        propertyValue: z.string(),
      })
    )
    .default([]),
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

export const readFileLocalOrRemote = async (path: string) => {
  let filePath = path;
  if (filePath.startsWith("./")) {
    filePath = filePath.substring("./".length);
  }

  if (!existsSync(filePath)) {
    if (process.env.GITHUB_ACTIONS !== "true") {
      commands.setFailed(`File path '${filePath}' could not be found. Did you forget to checkout?`);
      return "";
    }

    const githubToken = commands.getInput("TOKEN", true);
    const githubService = GithubService(githubToken);
    const { GITHUB_SHA } = process.env;

    const content = await githubService.getFileContent(filePath, GITHUB_SHA!);

    console.log(content);

    writeFileSync(filePath, content, "utf8");
    return content;
  } else {
    console.log("file exists");
    return readFileSync(filePath, "utf8");
  }
};

export const getConfiguration = async () => {
  const configPath = commands.getInput("CONFIG_PATH");

  const configFileContent = await readFileLocalOrRemote(configPath);
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
