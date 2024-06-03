import { z } from "zod";
import { commands } from "./commands";
import { ConfigFile } from "./config";
import { getUrlComponents } from "../services/serverless";
import { TwilioServices } from "../prepare-services";
import color from "ansi-colors";

export const FUNCTION_URL_REGEX = /https:\/\/(\S+)-\d\d\d\d(-(\S+))?\.twil\.io(\/\S*)/;

const SEND_TO_FLEX_WORKFLOW_NAME_REGEX = /\\"workflowName\\"\s*:\s*\\"([\w\s-]+)\\"/;
const SEND_TO_FLEX_CHANNEL_NAME_REGEX = /\\"channelName\\"\s*:\s*\\"([\w\s-]+)\\"/;

const baseWidgetSchema = z.object({
  name: z.string(),
  transitions: z.array(
    z.object({
      event: z.string(),
      next: z.string().optional(),
    })
  ),
});

const runFunctionWidgetSchema = z
  .object({
    type: z.literal("run-function"),
    properties: z
      .object({
        service_sid: z.string().startsWith("ZS"),
        environment_sid: z.string().startsWith("ZE"),
        function_sid: z.string().startsWith("ZH").or(z.string().startsWith("ZN")),
        parameters: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            })
          )
          .optional(),
        url: z.string(),
      })
      .passthrough(),
  })
  .merge(baseWidgetSchema);

export const parseSendToFlexRequiredAttributes = (attributes: string) => {
  const workflowNameMatch = SEND_TO_FLEX_WORKFLOW_NAME_REGEX.exec(attributes);
  const channelNameMatch = SEND_TO_FLEX_CHANNEL_NAME_REGEX.exec(attributes);

  const workflowName = workflowNameMatch?.[1] ?? null;
  const channelName = channelNameMatch?.[1] ?? null;

  return { workflowName, channelName };
};

const sendToFlexWidgetSchema = z
  .object({
    type: z.literal("send-to-flex"),
    properties: z
      .object({
        waitUrl: z.string().optional(),
        workflow: z.string().startsWith("WW"),
        channel: z.string().startsWith("TC"),
        attributes: z.string().superRefine((attr, ctx) => {
          const { workflowName, channelName } = parseSendToFlexRequiredAttributes(attr);
          if (!workflowName) {
            ctx.addIssue({
              code: "custom",
              message:
                "send-to-flex attributes must contain 'workflowName' field for deployment purposes",
            });
          }
          if (!channelName) {
            ctx.addIssue({
              code: "custom",
              message:
                "send-to-flex attributes must contain 'channelName' field (corresponding to a TaskChannel uniqueName) for deployment purposes",
            });
          }
        }),
      })
      .passthrough(),
  })
  .merge(baseWidgetSchema);

const setVariablesWidgetSchema = z
  .object({
    type: z.literal("set-variables"),
    properties: z
      .object({
        variables: z.array(z.object({ key: z.string(), value: z.string() })),
      })
      .passthrough(),
  })
  .merge(baseWidgetSchema);

const runSubflowWidgetSchema = z
  .object({
    type: z.literal("run-subflow"),
    properties: z
      .object({
        parameters: z
          .array(z.object({ key: z.string(), value: z.string() }))
          .default([])
          .refine((params) => params.some((p) => p.key === "subflowName"), {
            message:
              "run-subflow attributes must contain 'subflowName' field for deployment purposes",
          }),
        flow_sid: z.string().startsWith("FW"),
        flow_revision: z.string(),
      })
      .passthrough(),
  })
  .merge(baseWidgetSchema);

const studioStateSchema = z.discriminatedUnion("type", [
  runFunctionWidgetSchema,
  sendToFlexWidgetSchema,
  setVariablesWidgetSchema,
  runSubflowWidgetSchema,
]);

export const MANAGED_WIDGET_TYPES = [
  "run-function",
  "send-to-flex",
  "set-variables",
  "run-subflow",
] as const;

export const studioFlowSchema = z.object({
  description: z.string(),
  states: z.array(z.object({ name: z.string(), type: z.string() }).passthrough()),
  initial_state: z.literal("Trigger"),
  flags: z.object({
    allow_concurrent_calls: z.literal(true),
  }),
});

export type StudioFlow = z.infer<typeof studioFlowSchema>;

export type ManagedWidget = z.infer<typeof studioStateSchema>;

export const getManagedWidgets = (
  flow: StudioFlow,
  configuration: ConfigFile,
  twilioServices?: TwilioServices // Online validation
) => {
  const refinedStateSchema = studioStateSchema.superRefine((state, ctx) => {
    switch (state.type) {
      case "run-function":
        const urlComponents = getUrlComponents(state.properties.url);
        if (!urlComponents) {
          ctx.addIssue({
            code: "custom",
            path: ["properties", "url"],
            message: "Functions URL must match regex",
          });
          return;
        }
        if (!configuration.functionServices?.some((s) => s.name === urlComponents.serviceName)) {
          ctx.addIssue({
            code: "custom",
            path: ["properties", "url"],
            message: `Unknown Service '${urlComponents.serviceName}'. (Are you missing a 'functionServices' entry in your config file?)`,
          });
          return;
        }
        if (twilioServices) {
          const serviceObject = twilioServices.functionMap[urlComponents.serviceName];
          if (!serviceObject?.functions[urlComponents.functionPath]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "url"],
              message: `Unknown Function Path '${urlComponents.functionPath}'. (Is your Functions Service deployed?)`,
            });
            return;
          }
        }
        return;
      case "send-to-flex":
        if (twilioServices) {
          const { workflowName, channelName } = parseSendToFlexRequiredAttributes(
            state.properties.attributes
          );

          if (!twilioServices.channelMap[channelName!]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "attributes", "channelName"],
              message: `Unknown channelName '${channelName}'. (Must match the uniqueName of an existing TaskChannel)`,
            });
          }
          if (!twilioServices.workflowMap[workflowName!]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "attributes", "workflowName"],
              message: `Unknown workflowName '${workflowName}'. (Must match either a Friendly Name OR the key of a 'workflowMap' entry in your config file)`,
            });
          }
        }
        return;
      case "run-subflow":
        if (twilioServices) {
          const subflowName = state.properties.parameters.find(
            (p) => p.key === "subflowName"
          )?.value;

          if (!subflowName) {
            // Issue already created further up scope
            return;
          }

          const futureSubflows = configuration.flows
            .filter((f) => f.subflow && f.allowCreate)
            .reduce(
              (prev, curr) => ({
                ...prev,
                [curr.name]: "FW:FUTURE_VALUE",
              }),
              {} as Record<string, string>
            );

          const subflowMap = { ...futureSubflows, ...twilioServices.studioFlowMap };

          if (!subflowMap[subflowName]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "parameters", "subflowName"],
              message: `Unknown subflowName '${subflowName}'. (Must match either a Friendly Name OR the name of a subflow with 'allowCreate' enabled OR the key of a 'subflowMap' entry in your config file)`,
            });
          }
        }
        return;
      default:
        return;
    }
  });

  const widgets = flow.states
    .filter((s) => MANAGED_WIDGET_TYPES.includes(s.type as any))
    .map((s) => {
      const res = refinedStateSchema.safeParse(s);
      if (!res.success) {
        const logMessage = `- ${s.name}`;
        const issueMessages = res.error.issues
          .map((i) => `    ${color.yellow("[" + i.path.join(".") + "]")} ${i.message}`)
          .join("\n");

        commands.logError(`${logMessage}\n${issueMessages}`);
        return null;
      } else {
        return res.data;
      }
    });

  return widgets as ManagedWidget[];
};
