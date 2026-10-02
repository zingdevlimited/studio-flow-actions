import { ConfigFile } from "../../helpers/config";
import { IFlowService } from "../flow-service";
import { detectManualChangeForFlow, detectManualChangeForFlows } from "../manual-change-detector";

const flow = (overrides: Record<string, unknown> = {}) =>
  ({
    sid: "FW123",
    friendlyName: "Support",
    commitMessage: "[Auto Deploy] run 123",
    ...overrides,
  }) as any;

const flowConfig = (overrides: Record<string, unknown> = {}) =>
  ({
    name: "Support",
    path: "support.json",
    subflow: false,
    allowCreate: false,
    ...overrides,
  }) as ConfigFile["flows"][number];

const service = (flowInstance: any): IFlowService => ({
  byName: () => flowInstance,
  byNameOrNull: () => flowInstance,
  bySid: () => flowInstance,
  bySidOrNull: () => flowInstance,
  getFlowSidMap: () => ({}),
  getDefinition: async () => ({}),
});

describe("manual-change-detector", () => {
  it("classifies auto-deployed flows", () => {
    expect(detectManualChangeForFlow(flowConfig(), service(flow()))).toMatchObject({
      status: "auto_deployed",
      resolvedSid: "FW123",
    });
  });

  it("classifies flows without the auto-deploy marker as manual", () => {
    expect(
      detectManualChangeForFlow(flowConfig(), service(flow({ commitMessage: "Edited in Console" })))
    ).toMatchObject({ status: "manually_changed" });
  });

  it.each([undefined, ""])(
    "classifies a flow with commit message %p as manual",
    (commitMessage) => {
      expect(
        detectManualChangeForFlow(flowConfig(), service(flow({ commitMessage })))
      ).toMatchObject({
        status: "manually_changed",
      });
    }
  );

  it("classifies missing flows without treating them as manual", () => {
    expect(detectManualChangeForFlow(flowConfig(), service(null))).toMatchObject({
      status: "flow_missing",
    });
  });

  it("uses the configured SID before falling back to the flow name", () => {
    const flowService: IFlowService = {
      ...service(flow()),
      bySidOrNull: () => null,
      byNameOrNull: () => flow({ sid: "FW456" }),
    };

    expect(detectManualChangeForFlow(flowConfig({ sid: "FW999" }), flowService)).toMatchObject({
      resolvedSid: "FW456",
    });
  });

  it("classifies every configured flow", () => {
    const results = detectManualChangeForFlows(
      [flowConfig(), flowConfig({ name: "Other" })],
      service(flow())
    );

    expect(results).toHaveLength(2);
  });
});
