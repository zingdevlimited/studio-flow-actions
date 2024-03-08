import { FunctionsMap, getUrlComponents } from "./serverless";
import { SendToFlexWidgetAttributes, StudioFlow } from "./studio-schemas";

type UpdateWidgetResult = {
  changes: Array<{ widget: string; type: string; field: string; value: string }>;
  errors: Array<{ widget: string; type: string; error: string }>;
};

export const updateRunFunctionWidgets = (
  flow: StudioFlow,
  functionsMap: FunctionsMap
): UpdateWidgetResult => {
  const type = "run-function";
  const changes = [];
  const errors = [];
  for (const state of flow.states) {
    if (state.type !== type) continue;

    const urlComponents = getUrlComponents(state.properties.url);
    if (!urlComponents) {
      errors.push({
        widget: state.name,
        type,
        error: "URL does not match regex",
      });
      continue;
    }

    const serviceObject = functionsMap[urlComponents.serviceName];
    if (!serviceObject) {
      errors.push({
        widget: state.name,
        type,
        error: `Unknown Service '${urlComponents.serviceName}'. (Are you missing a 'functionServices' entry in your config file?)`,
      });
      continue;
    }

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

    if (!functionSid) {
      errors.push({
        widget: state.name,
        type: "run-function",
        error: `Unknown Function Path '${urlComponents.functionPath}'`,
      });
      continue;
    }

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

  return { changes, errors };
};

export const updateSendToFlexWidgets = (
  flow: StudioFlow,
  channelsMap: Record<string, string>,
  workflowsMap: Record<string, string>
): UpdateWidgetResult => {
  const type = "send-to-flex";
  const changes = [];
  const errors = [];
  for (const state of flow.states) {
    if (state.type !== type) continue;

    const attributes = JSON.parse(state.properties.attributes) as SendToFlexWidgetAttributes;

    const channelSid = channelsMap[attributes.channelName];
    if (!channelSid) {
      errors.push({
        widget: state.name,
        type,
        error: `Unknown channelName '${attributes.channelName}'. (Must match the uniqueName of an existing TaskChannel)`,
      });
      continue;
    }
    state.properties.channel = channelSid;
    changes.push({
      widget: state.name,
      type,
      field: "channel",
      value: channelSid,
    });

    const workflowSid = workflowsMap[attributes.workflowName];
    if (!workflowSid) {
      errors.push({
        widget: state.name,
        type,
        error: `Unknown workflowName '${attributes.workflowName}'. (Are you missing a 'workflowMap' entry in your config file?)`,
      });
      continue;
    }
    state.properties.workflow = workflowSid;
    changes.push({
      widget: state.name,
      type,
      field: "workflow",
      value: workflowSid,
    });
  }

  return { changes, errors };
};

export const updateSetVariableWidgets = (
  flow: StudioFlow,
  variablesMap: Record<string, string>
): UpdateWidgetResult => {
  const type = "set-variables";
  const changes = [];

  for (const state of flow.states) {
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

  return { changes, errors: [] };
};

export const updateRunSubflowWidgets = (flow: StudioFlow, subflowMap: Record<string, string>) => {
  const type = "run-subflow";
  const changes = [];
  const errors = [];

  for (const state of flow.states) {
    if (state.type !== type) continue;

    const subflowName = state.properties.parameters.find((p) => p.key === "subflowName")?.value;

    if (!subflowName) {
      errors.push({
        widget: state.name,
        type,
        error: "Missing 'subflowName' field in parameters",
      });
      continue;
    }

    const subflowSid = subflowMap[subflowName];
    if (!subflowSid) {
      errors.push({
        widget: state.name,
        type,
        error: `Unknown subflowName '${subflowName}'. (Are you missing a 'subflowMap' entry in your config file?)`,
      });
      continue;
    }

    state.properties.flow_sid = subflowSid;
    changes.push({
      widget: state.name,
      type,
      field: "flow_sid",
      value: subflowSid,
    });
  }

  return { changes, errors };
};
