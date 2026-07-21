import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeepyConfig } from "./config.js";
import type { Logger } from "./logger.js";
import type { FetchLike } from "./http/client.js";
export declare const SERVER_NAME = "deepy-mcp-server";
export declare const SERVER_VERSION = "0.1.0";
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
export declare function createServer(options: CreateServerOptions): McpServer;
//# sourceMappingURL=server.d.ts.map