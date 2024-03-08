import { z } from "zod";

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
    properties: z.object({
      service_sid: z.string().startsWith("ZS"),
      environment_sid: z.string().startsWith("ZE"),
      function_sid: z.string().startsWith("ZH"),
      parameters: z.array(
        z.object({
          key: z.string(),
          value: z.string(),
        })
      ),
      url: z.string().regex(FUNCTION_URL_REGEX, "Functions URL must match regex"),
    }),
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
    properties: z.object({
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
    }),
  })
  .merge(baseWidgetSchema);

const setVariablesWidgetSchema = z
  .object({
    type: z.literal("set-variables"),
    properties: z.object({
      variables: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  })
  .merge(baseWidgetSchema);

const runSubflowWidgetSchema = z
  .object({
    type: z.literal("run-subflow"),
    properties: z.object({
      parameters: z
        .array(z.object({ key: z.string(), value: z.string() }))
        .refine((params) => params.some((p) => p.key === "subflowName"), {
          message:
            "run-subflow attributes must contain 'subflowName' field for deployment purposes",
        }),
      flow_sid: z.string().startsWith("FW"),
    }),
  })
  .merge(baseWidgetSchema);

export const studioStateSchema = z.discriminatedUnion("type", [
  runFunctionWidgetSchema,
  sendToFlexWidgetSchema,
  setVariablesWidgetSchema,
  runSubflowWidgetSchema,
]);

export const studioFlowSchema = z.object({
  description: z.string(),
  states: z.array(studioStateSchema),
  initial_state: z.literal("Trigger"),
  flags: z.object({
    allow_concurrent_calls: z.literal(true),
  }),
});

export type StudioFlow = z.infer<typeof studioFlowSchema>;

export type SendToFlexWidgetAttributes = z.infer<typeof sendToFlexWidgetAttributesSchema>;
