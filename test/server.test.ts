import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { createLogger } from "../src/logger.js";
import { TEST_CONFIG, jsonResponse, makeMockFetch } from "./helpers.js";

/**
 * End-to-end wiring smoke test: boot the real server over an in-memory MCP
 * transport (no network) and drive it through a real MCP client. Proves that
 * every tool/prompt/resource registers and serializes without throwing.
 */
async function connectClient(fetchImpl: typeof fetch): Promise<Client> {
  const server = createServer({
    config: TEST_CONFIG,
    fetchImpl,
    logger: createLogger({ apiKey: TEST_CONFIG.apiKey, level: "silent" }),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

function contentText(result: { content?: Array<{ type: string; text?: string }> }): string {
  return (result.content ?? [])
    .map((block) => (block.type === "text" ? (block.text ?? "") : ""))
    .join("\n");
}

describe("MCP server wiring", () => {
  it("registers exactly the 7 contract tools", async () => {
    const client = await connectClient(makeMockFetch(() => jsonResponse(200, [])).fetchImpl);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "deepy_create_generation",
      "deepy_estimate_generation",
      "deepy_get_generation",
      "deepy_get_model",
      "deepy_get_result",
      "deepy_improve_prompt",
      "deepy_list_models",
    ]);
  });

  it("registers the 4 prompts and 4 skill resources", async () => {
    const client = await connectClient(makeMockFetch(() => jsonResponse(200, [])).fetchImpl);
    const { prompts } = await client.listPrompts();
    const { resources } = await client.listResources();
    expect(prompts.map((p) => p.name).sort()).toEqual([
      "deepy_choose_model",
      "deepy_prompt_optimizer",
      "deepy_safe_generation_flow",
      "deepy_troubleshooting",
    ]);
    expect(resources.map((r) => r.uri).sort()).toEqual([
      "deepy://skills/cost-confirmation.md",
      "deepy://skills/model-selection.md",
      "deepy://skills/prompt-optimization.md",
      "deepy://skills/safe-generation-flow.md",
    ]);
  });

  it("executes deepy_list_models through the transport", async () => {
    const client = await connectClient(
      makeMockFetch(() => jsonResponse(200, [{ modelName: "bytedance/seedream-v4.5" }])).fetchImpl
    );
    const result = await client.callTool({ name: "deepy_list_models", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(contentText(result as { content?: Array<{ type: string; text?: string }> })).toContain(
      "seedream"
    );
  });

  it("refuses deepy_create_generation without confirmed=true and makes no HTTP call", async () => {
    const mock = makeMockFetch(() => jsonResponse(200, {}));
    const client = await connectClient(mock.fetchImpl);
    const result = await client.callTool({
      name: "deepy_create_generation",
      arguments: { modelName: "m", prompt: "p", confirmed: false },
    });
    expect(result.isError).toBe(true);
    expect(mock.calls).toHaveLength(0);
  });

  it("serves a skill resource body", async () => {
    const client = await connectClient(makeMockFetch(() => jsonResponse(200, {})).fetchImpl);
    const result = await client.readResource({ uri: "deepy://skills/safe-generation-flow.md" });
    expect(result.contents[0]?.text).toContain("safe generation flow");
  });
});
