import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeepyConfig } from "./config.js";
import { createLogger } from "./logger.js";
import type { Logger } from "./logger.js";
import { DeepyApiClient } from "./http/client.js";
import type { FetchLike } from "./http/client.js";
import type { ToolContext } from "./tools/context.js";
import { registerAllTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";

export const SERVER_NAME = "deepy-mcp-server";
export const SERVER_VERSION = "0.1.0";

export interface CreateServerOptions {
  config: DeepyConfig;
  logger?: Logger;
  /** Injectable fetch for tests. Defaults to global fetch inside the client. */
  fetchImpl?: FetchLike;
}

/**
 * Build a fully-wired MCP server: HTTP client + tools + prompts + resources.
 * No transport is attached here (see `index.ts`), which keeps this usable
 * from tests.
 */
export function createServer(options: CreateServerOptions): McpServer {
  const logger = options.logger ?? createLogger({ apiKey: options.config.apiKey });
  const client = new DeepyApiClient(options.config, {
    fetchImpl: options.fetchImpl,
    logger,
  });

  const ctx: ToolContext = {
    client,
    config: options.config,
    apiKey: options.config.apiKey,
    logger,
  };

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server, ctx);
  registerPrompts(server);
  registerResources(server);
  return server;
}
