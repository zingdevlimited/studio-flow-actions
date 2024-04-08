import { FunctionsMap, getUrlComponents } from "../services/serverless";
import { ManagedWidget, SendToFlexWidgetAttributes, StudioFlow } from "./studio-schemas";

type UpdateWidgetResult = {
  changes: Array<{ widget: string; type: string; field: string; value: string }>;
};

export const updateRunFunctionWidgets = (
  states: ManagedWidget[],
  functionsMap: FunctionsMap
): UpdateWidgetResult => {
  const type = "run-function";
  const changes = [];
  for (const state of states) {
    if (state.type !== type) continue;

    const urlComponents = getUrlComponents(state.properties.url)!;

    const serviceObject = functionsMap[urlComponents.serviceName];

    state.properties.service_sid = serviceObject.serviceSid;
    changes.push({
      widget: state.name,
      type,
      field: "service_sid",
      value: serviceObject.serviceSid,
    });

    state.properties.environment_sid = serviceObject.environmentSid;
    changes.push({
      widget: state.name,
      type,
      field: "environment_sid",
      value: serviceObject.environmentSid,
    });

    const functionSid = serviceObject.functions[urlComponents.functionPath];

    state.properties.function_sid = functionSid;
    changes.push({
      widget: state.name,
      type,
      field: "function_sid",
      value: functionSid,
    });

    const functionUrl = `https://${serviceObject.domainName}${urlComponents.functionPath}`;
    state.properties.url = functionUrl;
    changes.push({
      widget: state.name,
      type,
      field: "url",
      value: functionUrl,
    });
  }

  return { changes };
};

export const updateSendToFlexWidgets = (
  states: ManagedWidget[],
  channelsMap: Record<string, string>,
  workflowsMap: Record<string, string>
): UpdateWidgetResult => {
  const type = "send-to-flex";
  const changes = [];
  for (const state of states) {
    if (state.type !== type) continue;

    const attributes = JSON.parse(state.properties.attributes) as SendToFlexWidgetAttributes;

    const channelSid = channelsMap[attributes.channelName];
    state.properties.channel = channelSid;
    changes.push({
      widget: state.name,
      type,
      field: "channel",
      value: channelSid,
    });

    const workflowSid = workflowsMap[attributes.workflowName];
    state.properties.workflow = workflowSid;
    changes.push({
      widget: state.name,
      type,
      field: "workflow",
      value: workflowSid,
    });
  }

  return { changes };
};

export const updateSetVariableWidgets = (
  states: ManagedWidget[],
  variablesMap: Record<string, string>
): UpdateWidgetResult => {
  const type = "set-variables";
  const changes = [];

  for (const state of states) {
    if (state.type !== type) continue;

    for (const [key, value] of Object.entries(variablesMap)) {
      const varObject = state.properties.variables.find((v) => v.key === key);

      if (varObject) {
        varObject.value = value;
        changes.push({
          widget: state.name,
          type,
          field: `variables.${key}.value`,
          value,
        });
      }
    }
  }

  return { changes };
};

export const updateRunSubflowWidgets = (
  states: ManagedWidget[],
  subflowMap: Record<string, string>
): UpdateWidgetResult => {
  const type = "run-subflow";
  const changes = [];

  for (const state of states) {
    if (state.type !== type) continue;

    const subflowName = state.properties.parameters.find((p) => p.key === "subflowName")!.value;

    const subflowSid = subflowMap[subflowName];

    state.properties.flow_sid = subflowSid;
    changes.push({
      widget: state.name,
      type,
      field: "flow_sid",
      value: subflowSid,
    });
  }

  return { changes };
};

export const setWidgetProperty = (
  studioFlowDefinition: StudioFlow,
  widgetName: string,
  propertyKey: string,
  propertyValue: string
): UpdateWidgetResult => {
  const stateIndex = studioFlowDefinition.states.findIndex((s) => s.name === widgetName);
  if (stateIndex < 0) {
    return { changes: [] };
  }
  const state = studioFlowDefinition.states[stateIndex];
  (state as any).properties[propertyKey] = propertyValue;
  return {
    changes: [
      {
        widget: widgetName,
        type: state.type,
        field: propertyKey,
        value: propertyValue,
      },
    ],
  };
};
