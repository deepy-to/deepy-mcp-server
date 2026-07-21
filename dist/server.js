import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from "./logger.js";
import { DeepyApiClient } from "./http/client.js";
import { registerAllTools } from "./tools/index.js";
import { registerPrompts } from "./prompts/index.js";
import { registerResources } from "./resources/index.js";
export const SERVER_NAME = "deepy-mcp-server";
export const SERVER_VERSION = "0.1.0";
/**
 * Build a fully-wired MCP server: HTTP client + tools + prompts + resources.
 * No transport is attached here (see `index.ts`), which keeps this usable
 * from tests.
 */
export function createServer(options) {
    const logger = options.logger ?? createLogger({ apiKey: options.config.apiKey });
    const client = new DeepyApiClient(options.config, {
        fetchImpl: options.fetchImpl,
        logger,
    });
    const ctx = {
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
//# sourceMappingURL=server.js.map