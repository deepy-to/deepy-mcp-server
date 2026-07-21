import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const createGenerationInputSchema: {
    modelName: z.ZodString;
    prompt: z.ZodString;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    referenceFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    confirmed: z.ZodBoolean;
    idempotencyKey: z.ZodOptional<z.ZodString>;
};
interface CreateGenerationArgs {
    modelName: string;
    prompt: string;
    parameters: Record<string, unknown> | undefined;
    referenceFiles: string[] | undefined;
    confirmed: boolean;
    idempotencyKey: string | undefined;
}
export declare function makeCreateGenerationHandler(ctx: ToolContext): (args: CreateGenerationArgs) => Promise<CallToolResult>;
export declare function registerCreateGeneration(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=create-generation.d.ts.map