import { ManagedWidget, StudioFlow, getManagedWidgets } from "../../helpers/studio-schemas";
import { ConfigFile } from "../../helpers/config";
import { TwilioServices } from "../../prepare-services";

jest.mock("../../helpers/commands");

const mockFlowWithWidget = <T extends ManagedWidget>(widget: T): StudioFlow => ({
  description: "Test",
  states: [widget],
  initial_state: "Trigger",
  flags: {
    allow_concurrent_calls: true,
  },
});

const configuration: ConfigFile = {
  flows: [
    {
      name: "test",
      path: "test",
      subflow: false,
      allowCreate: false,
    },
  ],
  replaceWidgetTypes: ["send-to-flex"],
  customPropertyReplacements: [],
  enableShellVariables: false,
};

const getCorrectWidget = () => ({
  name: "send-to-flex-1",
  type: "send-to-flex" as const,
  transitions: [],
  properties: {
    workflow: "WW000",
    channel: "TC000",
    attributes:
      // eslint-disable-next-line quotes
      `{"workflowName":"Test Workflow","channelName":"testchannel","otherProperty":{{ something_else | to_json }}}`,
  },
});

const mockServices: TwilioServices = {
  channelMap: {
    testchannel: "TC123",
  },
  workflowMap: {
    "Test Workflow": "WW123",
  },
  functionMap: {},
  studioFlowMap: {},
  twilioClient: {} as any,
};

describe("getManagedWidgets (send-to-flex)", () => {
  it("Succeeds with widget matching configuration", () => {
    const flow = mockFlowWithWidget(getCorrectWidget());

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).not.toBeNull();

    const flexWidget = res[0] as ManagedWidget & { type: "send-to-flex" };
    expect(
      flexWidget.properties.attributes.includes(
        // eslint-disable-next-line quotes
        `"otherProperty":{{ something_else | to_json }}}`
      )
    ).toBe(true);
  });

  it("Fails with missing workflowName attribute", () => {
    const widget = getCorrectWidget();
    widget.properties.attributes = JSON.stringify({
      channelName: "testchannel",
    });
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration);
    expect(res[0]).toBeNull();
  });

  it("Fails with missing channelName attribute", () => {
    const widget = getCorrectWidget();
    widget.properties.attributes = JSON.stringify({
      workflowName: "Test Workflow",
    });
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration);
    expect(res[0]).toBeNull();
  });

  it("Fails with channelName not matching any TaskChannel unique names", () => {
    const widget = getCorrectWidget();
    widget.properties.attributes = JSON.stringify({
      workflowName: "Test Workflow",
      channelName: "notachannel",
    });
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).toBeNull();
  });

  it("Fails with workflowName not matching any workflowMap provided in Services", () => {
    const widget = getCorrectWidget();
    widget.properties.attributes = JSON.stringify({
      workflowName: "Not A Workflow",
      channelName: "testchannel",
    });
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).toBeNull();
  });
});
