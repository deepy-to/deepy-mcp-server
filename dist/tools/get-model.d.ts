import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const getModelInputSchema: {
    modelName: z.ZodString;
};
interface GetModelArgs {
    modelName: string;
}
export declare function makeGetModelHandler(ctx: ToolContext): (args: GetModelArgs) => Promise<CallToolResult>;
export declare function registerGetModel(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=get-model.d.ts.map