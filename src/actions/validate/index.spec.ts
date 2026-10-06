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

const loadValidateAction = async (inputs: Record<string, string>) => {
  const commands = {
    getOptionalInput: jest.fn((name: string) => inputs[name]),
    startLogGroup: jest.fn(),
    endLogGroup: jest.fn(),
    addSummaryHeader: jest.fn(),
    addSummaryTable: jest.fn(),
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn(),
    setFailed: jest.fn(),
    writeSummary: jest.fn().mockResolvedValue(undefined),
  };
  const performReplacements = jest.fn().mockResolvedValue([]);
  const detectManualChangeForFlows = jest.fn().mockReturnValue(detectionResults);

  jest.resetModules();
  jest.doMock("../../lib/helpers/commands", () => ({ commands }));
  jest.doMock("../../lib/helpers/config", () => ({
    getConfiguration: jest.fn().mockResolvedValue(configuration),
  }));
  jest.doMock("../../lib/helpers/twilio-client", () => ({
    getTwilioClient: jest.fn().mockReturnValue({
      studio: { v2: { flowValidate: { update: jest.fn() } } },
    }),
  }));
  jest.doMock("../../lib/prepare-services", () => ({
    prepareServices: jest.fn().mockResolvedValue({ flowService: {} }),
  }));
  jest.doMock("../../lib/replacer", () => ({ performReplacements }));
  jest.doMock("../../lib/services/manual-change-detector", () => ({
    detectManualChangeForFlows,
  }));

  // eslint-disable-next-line global-require
  require("./index");
  await new Promise((resolve) => setImmediate(resolve));

  return { commands, performReplacements, detectManualChangeForFlows };
};

describe("validate action orchestration", () => {
  it("skips manually changed flows in partial mode", async () => {
    const { commands, performReplacements } = await loadValidateAction({
      MANUAL_CHANGE_MODE: "partial",
    });

    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "dry", {
      skipFlowNames: ["Manual Flow"],
    });
    expect(commands.logWarning).toHaveBeenCalledWith(expect.stringContaining("Manual Flow"));
    expect(commands.setFailed).not.toHaveBeenCalled();
  });

  it("does not inspect manual changes in normal validation mode", async () => {
    const { commands, detectManualChangeForFlows } = await loadValidateAction({});

    expect(detectManualChangeForFlows).not.toHaveBeenCalled();
    expect(commands.setFailed).not.toHaveBeenCalled();
  });

  it("fails when strict validation detects a manual change", async () => {
    const { commands, performReplacements, detectManualChangeForFlows } = await loadValidateAction({
      MANUAL_CHANGE_MODE: "strict",
    });

    expect(detectManualChangeForFlows).toHaveBeenCalledWith(configuration.flows, {});
    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "dry", {
      skipFlowNames: [],
    });
    expect(commands.logError).toHaveBeenCalledWith(expect.stringContaining("Manual Flow"));
    expect(commands.setFailed).toHaveBeenCalledWith("Validation failed.");
  });

  it("rejects an unknown manual-change mode", async () => {
    const { commands, performReplacements } = await loadValidateAction({
      MANUAL_CHANGE_MODE: "unknown",
    });

    expect(commands.setFailed).toHaveBeenCalledWith(
      "Invalid MANUAL_CHANGE_MODE 'unknown'. Expected 'normal', 'partial', or 'strict'."
    );
    expect(performReplacements).not.toHaveBeenCalled();
  });
});
