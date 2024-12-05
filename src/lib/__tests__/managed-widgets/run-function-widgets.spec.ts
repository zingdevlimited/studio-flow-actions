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
  functionServices: [
    {
      name: "testservice",
      environmentSuffix: "dev",
    },
    {
      name: "patternservice-\\d-\\d-\\d",
      environmentSuffix: 0,
      pattern: true,
    },
  ],
  replaceWidgetTypes: ["run-function"],
  customPropertyReplacements: [],
  enableShellVariables: false,
};

const getCorrectWidget = () => ({
  name: "run-function-1",
  type: "run-function" as const,
  transitions: [],
  properties: {
    service_sid: "ZS000",
    environment_sid: "ZE000",
    function_sid: "ZN000",
    url: "https://testservice-1234-dev.twil.io/testfunction",
  },
});

const mockServices: TwilioServices = {
  functionMap: new FunctionMap([
    {
      uniqueName: "testservice",
      serviceSid: "ZS123",
      environmentSid: "ZE123",
      domainName: "testservice-1234-dev.twil.io",
      functions: {
        "/testfunction": "ZN123",
      },
      serviceConfig: configuration.functionServices[0],
    },
    {
      uniqueName: "patternservice-1-2-1",
      serviceSid: "ZS123",
      environmentSid: "ZE123",
      domainName: "testservice-1234-dev.twil.io",
      functions: {
        "/testfunction2": "ZN123",
      },
      serviceConfig: configuration.functionServices[1],
    },
  ]),
  twilioClient: {} as any,
  channelMap: {},
  studioFlowMap: {},
  workflowMap: {},
};

describe("getManagedWidgets (run-function)", () => {
  it("Succeeds with widget matching configuration", () => {
    const flow = mockFlowWithWidget(getCorrectWidget());

    const res = getManagedWidgets(flow, configuration, mockServices);
    expect(res[0]).not.toBeNull();
  });

  it("Fails with invalid functions URL", async () => {
    const widget = getCorrectWidget();
    widget.properties.url = "https://testservice-1234-dev.otherdomain.io/myfunction";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).toBeNull();
  });

  it("Fails with URL pointing to service name not named in configuration", async () => {
    const widget = getCorrectWidget();
    widget.properties.url = "https://notaservice-1234-dev.twil.io/myfunction";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).toBeNull();
  });

  it("Succeeds with URL pointing to service name matching pattern defined in configuration", async () => {
    const widget = getCorrectWidget();
    widget.properties.url = "https://patternservice-1-0-0-1234-dev.twil.io/testfunction2";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).not.toBeNull();
  });

  it("Fails with URL pointing to non-existing function", async () => {
    const widget = getCorrectWidget();
    widget.properties.url = "https://testservice-1234-dev.twil.io/notafunction";
    const flow = mockFlowWithWidget(widget);

    const res = getManagedWidgets(flow, configuration, mockServices);

    expect(res[0]).toBeNull();
  });
});
