/// <reference types="jest" />

import {
  IS_BLANK_CONDITION_TYPE,
  IS_NOT_BLANK_CONDITION_TYPE,
  studioFlowSchema,
} from "../helpers/studio-schemas";
import { generateMermaidSingleDiagram } from "../helpers/mermaid-diagram";

describe("studioFlowSchema", () => {
  it("accepts is_blank and is_not_blank split conditions without a value", () => {
    const result = studioFlowSchema.safeParse({
      description: "Incoming Lead Subflow",
      initial_state: "Trigger",
      flags: { allow_concurrent_calls: true },
      states: [
        {
          name: "Trigger",
          type: "trigger",
          transitions: [],
          properties: {},
        },
        {
          name: "split_on_license_plate",
          type: "split-based-on",
          transitions: [
            {
              event: "match",
              conditions: [
                {
                  friendly_name: "If value is_blank",
                  arguments: ["{{trigger.parent.parameters.license_plate}}"],
                  type: IS_BLANK_CONDITION_TYPE,
                },
              ],
            },
            {
              event: "match",
              conditions: [
                {
                  friendly_name: "If value is_not_blank",
                  arguments: ["{{trigger.parent.parameters.license_plate}}"],
                  type: IS_NOT_BLANK_CONDITION_TYPE,
                },
              ],
            },
          ],
          properties: {},
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires a value for split conditions other than is_blank and is_not_blank", () => {
    const result = studioFlowSchema.safeParse({
      description: "Incoming Lead Subflow",
      initial_state: "Trigger",
      flags: { allow_concurrent_calls: true },
      states: [
        {
          name: "Trigger",
          type: "trigger",
          transitions: [],
          properties: {},
        },
        {
          name: "split_on_license_plate",
          type: "split-based-on",
          transitions: [
            {
              event: "match",
              conditions: [
                {
                  friendly_name: "If value equal_to a license plate",
                  arguments: ["{{trigger.parent.parameters.license_plate}}"],
                  type: "equal_to",
                },
              ],
            },
          ],
          properties: {},
        },
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected equal_to condition without a value to be invalid");
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["states", 1, "transitions", 0, "conditions", 0, "value"],
        }),
      ])
    );
  });

  it("renders is_blank and is_not_blank split conditions without an undefined value", () => {
    const flow = studioFlowSchema.parse({
      description: "Incoming Lead Subflow",
      initial_state: "Trigger",
      flags: { allow_concurrent_calls: true },
      states: [
        {
          name: "Trigger",
          type: "trigger",
          transitions: [],
          properties: {},
        },
        {
          name: "split_on_license_plate",
          type: "split-based-on",
          transitions: [
            {
              event: "match",
              next: "Trigger",
              conditions: [
                {
                  friendly_name: "If value is_blank",
                  arguments: ["{{trigger.parent.parameters.license_plate}}"],
                  type: IS_BLANK_CONDITION_TYPE,
                },
              ],
            },
          ],
          properties: {},
        },
      ],
    });

    const diagram = generateMermaidSingleDiagram(flow);

    expect(diagram?.content).toContain(`match: ${IS_BLANK_CONDITION_TYPE}`);
    expect(diagram?.content).not.toContain("undefined");
  });
});
