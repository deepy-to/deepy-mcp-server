import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
export declare const improvePromptInputSchema: {
    prompt: z.ZodString;
    modality: z.ZodEnum<["image", "video", "audio"]>;
    style: z.ZodOptional<z.ZodString>;
};
interface ImprovePromptArgs {
    prompt: string;
    modality: "image" | "video" | "audio";
    style: string | undefined;
}
export declare function makeImprovePromptHandler(ctx: ToolContext): (args: ImprovePromptArgs) => Promise<CallToolResult>;
export declare function registerImprovePrompt(server: McpServer, ctx: ToolContext): void;
export {};
//# sourceMappingURL=improve-prompt.d.ts.map