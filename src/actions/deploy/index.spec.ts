import { ManualChangeDetectionResult } from "../../lib/services/manual-change-detector";

const configuration = {
  flows: [{ name: "Manual Flow" }, { name: "Auto Flow" }],
};

const detectionResults: ManualChangeDetectionResult[] = [
  {
    flowName: "Manual Flow",
    resolvedSid: "FW123",
    status: "manually_changed",
    reason: "Changed manually",
  },
  {
    flowName: "Auto Flow",
    resolvedSid: "FW456",
    status: "auto_deployed",
    reason: "Deployed automatically",
  },
];

const loadDeployAction = async (inputs: Record<string, string>) => {
  const commands = {
    getOptionalInput: jest.fn((name: string) => inputs[name]),
    addSummaryHeader: jest.fn(),
    addSummaryTable: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    setFailed: jest.fn(),
    writeSummary: jest.fn().mockResolvedValue(undefined),
  };
  const performReplacements = jest.fn().mockResolvedValue([]);

  jest.resetModules();
  jest.doMock("../../lib/helpers/commands", () => ({ commands }));
  jest.doMock("../../lib/helpers/config", () => ({
    getConfiguration: jest.fn().mockResolvedValue(configuration),
  }));
  jest.doMock("../../lib/helpers/twilio-client", () => ({
    getTwilioClient: jest.fn().mockReturnValue({}),
  }));
  jest.doMock("../../lib/prepare-services", () => ({
    prepareServices: jest.fn().mockResolvedValue({ flowService: {} }),
  }));
  jest.doMock("../../lib/replacer", () => ({ performReplacements }));
  jest.doMock("../../lib/services/manual-change-detector", () => ({
    detectManualChangeForFlows: jest.fn().mockReturnValue(detectionResults),
  }));

  // eslint-disable-next-line global-require
  require("./index");
  await new Promise((resolve) => setImmediate(resolve));

  return { commands, performReplacements };
};

describe("deploy action orchestration", () => {
  it("skips manually changed flows in partial mode", async () => {
    const { commands, performReplacements } = await loadDeployAction({
      ALLOW_PARTIAL_DEPLOY: "true",
    });

    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "deploy", {
      skipFlowNames: ["Manual Flow"],
    });
    expect(commands.logWarning).toHaveBeenCalledWith(expect.stringContaining("Manual Flow"));
    expect(commands.setFailed).not.toHaveBeenCalled();
  });

  it("processes all flows when partial mode is disabled", async () => {
    const { commands, performReplacements } = await loadDeployAction({});

    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "deploy", {
      skipFlowNames: [],
    });
    expect(commands.setFailed).not.toHaveBeenCalled();
  });
});
