import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const getResultInputSchema: {
    publicId: z.ZodString;
    index: z.ZodOptional<z.ZodNumber>;
};
interface GetResultArgs {
    publicId: string;
    index: number | undefined;
}
export declare function makeGetResultHandler(ctx: ToolContext): (args: GetResultArgs) => Promise<CallToolResult>;
export declare function registerGetResult(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=get-result.d.ts.map