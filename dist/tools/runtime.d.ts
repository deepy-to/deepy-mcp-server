import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolContext } from "./context.js";
export declare function textResult(text: string): CallToolResult;
export declare function errorResult(text: string): CallToolResult;
/** An MCP image content block (base64), optionally preceded by a text caption. */
export declare function imageResult(base64: string, mimeType: string, caption?: string): CallToolResult;
/** An MCP audio content block (base64), optionally preceded by a text caption. */
export declare function audioResult(base64: string, mimeType: string, caption?: string): CallToolResult;
export declare function formatJson(value: unknown): string;
/**
 * Execute a tool body with uniform guarantees:
 *  - backend errors are surfaced (never swallowed) with code + guidance;
 *  - any unexpected error becomes a clean tool error, not a crash;
 *  - ALL text output is redacted so the API key can never leak.
 */
export declare function runTool(ctx: ToolContext, fn: () => Promise<CallToolResult>): Promise<CallToolResult>;
export declare function toErrorResult(err: unknown): CallToolResult;
//# sourceMappingURL=runtime.d.ts.map