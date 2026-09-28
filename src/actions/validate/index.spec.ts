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
    detectManualChangeForFlows: jest.fn().mockReturnValue(detectionResults),
  }));

  // eslint-disable-next-line global-require
  require("./index");
  await new Promise((resolve) => setImmediate(resolve));

  return { commands, performReplacements };
};

describe("validate action orchestration", () => {
  it("skips manually changed flows in partial mode", async () => {
    const { commands, performReplacements } = await loadValidateAction({
      ALLOW_PARTIAL_DEPLOY: "true",
    });

    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "dry", {
      skipFlowNames: ["Manual Flow"],
    });
    expect(commands.logWarning).toHaveBeenCalledWith(expect.stringContaining("Manual Flow"));
    expect(commands.setFailed).not.toHaveBeenCalled();
  });

  it("fails when strict manual revision validation detects a change", async () => {
    const { commands, performReplacements } = await loadValidateAction({
      VALIDATE_PREVIOUS_REVISION_USER: "true",
    });

    expect(performReplacements).toHaveBeenCalledWith(configuration, { flowService: {} }, "dry", {
      skipFlowNames: [],
    });
    expect(commands.logError).toHaveBeenCalledWith(expect.stringContaining("Manual Flow"));
    expect(commands.setFailed).toHaveBeenCalledWith("Validation failed.");
  });

  it("rejects strict and partial modes being enabled together", async () => {
    const { commands, performReplacements } = await loadValidateAction({
      ALLOW_PARTIAL_DEPLOY: "true",
      VALIDATE_PREVIOUS_REVISION_USER: "true",
    });

    expect(commands.setFailed).toHaveBeenCalledWith(
      "ALLOW_PARTIAL_DEPLOY and VALIDATE_PREVIOUS_REVISION_USER cannot both be true."
    );
    expect(performReplacements).not.toHaveBeenCalled();
  });
});
