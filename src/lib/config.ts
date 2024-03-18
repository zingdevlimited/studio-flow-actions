import { z } from "zod";
import { MANAGED_WIDGET_TYPES } from "./studio-schemas";

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
  replaceWidgetTypes: z.array(z.enum(MANAGED_WIDGET_TYPES)),
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

export const replaceShellVariables = <T>(configuration: T) => {
  const envVarRegex = /\$([a-zA-Z_][a-zA-Z0-9_]*)/g;

  const configJson = JSON.stringify(configuration);

  const replacedJson = configJson.replace(envVarRegex, (_, variable) => {
    return process.env[variable] || "";
  });

  return JSON.parse(replacedJson) as T;
};
