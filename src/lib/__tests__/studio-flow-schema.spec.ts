/// <reference types="jest" />

import { studioFlowSchema } from "../helpers/studio-schemas";

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
                  type: "is_blank",
                },
              ],
            },
            {
              event: "match",
              conditions: [
                {
                  friendly_name: "If value is_not_blank",
                  arguments: ["{{trigger.parent.parameters.license_plate}}"],
                  type: "is_not_blank",
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
});
