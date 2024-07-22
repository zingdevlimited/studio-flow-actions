import { ManagedWidget, StudioFlow, getManagedWidgets } from "../../helpers/studio-schemas";
import { ConfigFile } from "../../helpers/config";
import { TwilioServices } from "../../prepare-services";

jest.mock("../../helpers/commands");

const configuration: ConfigFile = {
  flows: [
    {
      name: "test",
      path: "test",
      subflow: false,
      allowCreate: false,
    },
    {
      name: "subflowNoCreate",
      path: "subflow-1",
      subflow: true,
      allowCreate: false,
    },
    {
      name: "subflowCreate",
      path: "subflow-2",
      subflow: true,
      allowCreate: true,
    },
  ],
  functionServices: [
    {
      name: "testservice",
      environmentSuffix: "dev",
    },
  ],
  replaceWidgetTypes: ["run-function"],
  customPropertyReplacements: [],
  enableShellVariables: false,
};

const mockFlowWithWidget = <T extends ManagedWidget>(widget: T): StudioFlow => ({
  description: "Test",
  states: [widget],
  initial_state: "Trigger",
  flags: {
    allow_concurrent_calls: true,
  },
});

const getCorrectWidget = () => ({
  name: "run-subflow-1",
  type: "run-subflow" as const,
  transitions: [],
  properties: {
    flow_sid: "FW000",
    flow_revision: "LatestPublished",
    parameters: [
      {
        key: "subflowName",
        type: "string",
        value: "existingSubflow",
      },
    ],
  },
});

const mockServices: TwilioServices = {
  studioFlowMap: {
    existingSubflow: "FW123",
  },
  functionMap: {},
  channelMap: {},
  workflowMap: {},
  twilioClient: {} as any,
};

describe("getManagedWidgets (run-subflow)", () => {
  it("Succeeds with widget matching configuration", () => {
    const flow = mockFlowWithWidget(getCorrectWidget());

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).not.toBeNull();
  });

  it("Succeeds if subflowName matches future subflow", () => {
    const widget = getCorrectWidget();
    widget.properties.parameters[0].value = "subflowCreate";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).not.toBeNull();
  });

  it("Fails if subflowName parameter is missing", () => {
    const widget = getCorrectWidget();
    widget.properties.parameters[0].key = "somethingElse";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).toBeNull();
  });

  it("Fails if subflowName parameter does not match a valid name", () => {
    const widget = getCorrectWidget();
    widget.properties.parameters[0].value = "subflowNoCreate";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).toBeNull();
  });
});
