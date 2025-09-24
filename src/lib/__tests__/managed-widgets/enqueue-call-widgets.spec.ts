import { ManagedWidget, StudioFlow, getManagedWidgets } from "../../helpers/studio-schemas";
import { ConfigFile } from "../../helpers/config";
import { TwilioServices } from "../../prepare-services";
import { FunctionMap } from "../../services/serverless";

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
  functionServices: [],
  replaceWidgetTypes: ["enqueue-call"],
  customPropertyReplacements: [],
  enableShellVariables: false,
};

const getCorrectWidget = () => ({
  name: "enqueue-call-1",
  type: "enqueue-call" as const,
  transitions: [],
  properties: {
    workflow_sid: "WW000",
    task_attributes:
      // eslint-disable-next-line quotes
      `{"workflowName":"Test Workflow","otherProperty":{{ something_else | to_json }}}`,
  },
});

const mockServices: TwilioServices = {
  channelMap: {
    testchannel: "TC123",
  },
  workflowMap: {
    "Test Workflow": "WW123",
  },
  functionMap: new FunctionMap([]),
  studioFlowMap: {},
  twilioClient: {} as any,
};

describe("getManagedWidgets (send-to-flex)", () => {
  it("Succeeds with widget matching configuration", () => {
    const flow = mockFlowWithWidget(getCorrectWidget());

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).not.toBeNull();

    const enqueueCallWidget = res[0] as ManagedWidget & { type: "enqueue-call" };
    expect(
      enqueueCallWidget.properties.task_attributes.includes(
        // eslint-disable-next-line quotes
        `"otherProperty":{{ something_else | to_json }}}`
      )
    ).toBe(true);
  });

  it("Fails with missing workflowName attribute", () => {
    const widget = getCorrectWidget();
    widget.properties.task_attributes = JSON.stringify({});
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration);
    expect(res[0]).toBeNull();
  });

  it("Fails with workflowName not matching any workflowMap provided in Services", () => {
    const widget = getCorrectWidget();
    widget.properties.task_attributes = JSON.stringify({
      workflowName: "Not A Workflow",
    });
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).toBeNull();
  });
});
