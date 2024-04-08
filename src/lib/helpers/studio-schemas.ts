import { z } from "zod";
import { commands } from "./commands";
import { ConfigFile } from "./config";
import { getUrlComponents } from "../services/serverless";
import { TwilioServices } from "../prepare-services";

export const FUNCTION_URL_REGEX = /https:\/\/(\S+)-\d\d\d\d(-(\S+))?\.twil\.io(\/\S*)/;

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

const sendToFlexWidgetAttributesSchema = z.object({
  workflowName: z.string({
    required_error:
      "send-to-flex attributes must contain 'workflowName' field for deployment purposes",
  }),
  channelName: z.string({
    required_error:
      "send-to-flex attributes must contain 'channelName' field (corresponding to a TaskChannel uniqueName) for deployment purposes",
  }),
});

const sendToFlexWidgetSchema = z
  .object({
    type: z.literal("send-to-flex"),
    properties: z
      .object({
        waitUrl: z.string().optional(),
        workflow: z.string().startsWith("WW"),
        channel: z.string().startsWith("TC"),
        attributes: z
          .preprocess((str, ctx) => {
            try {
              return JSON.parse(str as string);
            } catch (e) {
              ctx.addIssue({ code: "custom", message: "Invalid JSON" });
              return z.NEVER;
            }
          }, sendToFlexWidgetAttributesSchema)
          .transform((attr) => JSON.stringify(attr)),
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

export type SendToFlexWidgetAttributes = z.infer<typeof sendToFlexWidgetAttributesSchema>;

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
          const attributes = JSON.parse(state.properties.attributes) as SendToFlexWidgetAttributes;

          if (!twilioServices.channelMap[attributes.channelName]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "attributes", "channelName"],
              message: `Unknown channelName '${attributes.channelName}'. (Must match the uniqueName of an existing TaskChannel)`,
            });
          }
          if (!twilioServices.workflowMap[attributes.workflowName]) {
            ctx.addIssue({
              code: "custom",
              path: ["properties", "attributes", "workflowName"],
              message: `Unknown workflowName '${attributes.workflowName}'. (Must match either a Friendly Name OR the key of a 'workflowMap' entry in your config file)`,
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
            ctx.addIssue({
              code: "custom",
              path: ["properties", "parameters"],
              message: "Parameters must contain 'subflowName' field for deployment purposes",
            });
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
          .map((i) => `    [${i.path.join(".")}] ${i.message}`)
          .join("\n");

        commands.logError(`${logMessage}\n${issueMessages}`);
        return null;
      } else {
        return res.data;
      }
    });

  return widgets as ManagedWidget[];
};
