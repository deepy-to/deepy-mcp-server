import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const listModelsInputSchema: {
    type: z.ZodOptional<z.ZodString>;
    family: z.ZodOptional<z.ZodString>;
    group: z.ZodOptional<z.ZodString>;
};
interface ListModelsArgs {
    type: string | undefined;
    family: string | undefined;
    group: string | undefined;
}
export declare function makeListModelsHandler(ctx: ToolContext): (args: ListModelsArgs) => Promise<CallToolResult>;
export declare function registerListModels(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=list-models.d.ts.map