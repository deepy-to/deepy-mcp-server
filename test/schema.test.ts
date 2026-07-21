import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createGenerationInputSchema } from "../src/tools/create-generation.js";

/**
 * The confirmation gate is only meaningful if the MCP schema layer forces
 * `confirmed` to be a real boolean — a truthy string like "false" or 1 must be
 * rejected before the handler runs, so it can never be coerced into an approval.
 */
const schema = z.object(createGenerationInputSchema);

describe("create-generation schema — confirmed must be a boolean", () => {
  it("accepts confirmed: true / false (real booleans)", () => {
    expect(schema.safeParse({ modelName: "m", prompt: "p", confirmed: true }).success).toBe(true);
    expect(schema.safeParse({ modelName: "m", prompt: "p", confirmed: false }).success).toBe(true);
  });

  it.each([
    ['the string "false"', "false"],
    ['the string "true"', "true"],
    ["the number 1", 1],
    ["the number 0", 0],
    ["an empty object", {}],
    ["null", null],
  ])("rejects %s for confirmed", (_label, value) => {
    const parsed = schema.safeParse({ modelName: "m", prompt: "p", confirmed: value });
    expect(parsed.success).toBe(false);
  });

  it("rejects an omitted confirmed (it is required)", () => {
    expect(schema.safeParse({ modelName: "m", prompt: "p" }).success).toBe(false);
  });
});
