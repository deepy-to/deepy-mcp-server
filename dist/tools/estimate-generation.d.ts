import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const estimateGenerationInputSchema: {
    modelName: z.ZodString;
    prompt: z.ZodString;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    referenceFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
};
interface EstimateGenerationArgs {
    modelName: string;
    prompt: string;
    parameters: Record<string, unknown> | undefined;
    referenceFiles: string[] | undefined;
}
export declare function makeEstimateGenerationHandler(ctx: ToolContext): (args: EstimateGenerationArgs) => Promise<CallToolResult>;
export declare function registerEstimateGeneration(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=estimate-generation.d.ts.map