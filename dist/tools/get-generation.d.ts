import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const getGenerationInputSchema: {
    publicId: z.ZodString;
};
interface GetGenerationArgs {
    publicId: string;
}
export declare function makeGetGenerationHandler(ctx: ToolContext): (args: GetGenerationArgs) => Promise<CallToolResult>;
export declare function registerGetGeneration(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=get-generation.d.ts.map