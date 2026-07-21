import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { formatJson, runTool, textResult } from "./runtime.js";
import type { ImprovePromptResponse } from "../types.js";

export const improvePromptInputSchema = {
  prompt: z.string().min(1).describe("The user's draft prompt to improve."),
  modality: z
    .enum(["image", "video", "audio"])
    .describe("Target modality for the generation the prompt is for."),
  style: z.string().optional().describe("Optional style hint (e.g. cinematic, photorealistic)."),
};

interface ImprovePromptArgs {
  prompt: string;
  modality: "image" | "video" | "audio";
  style: string | undefined;
}

export function makeImprovePromptHandler(ctx: ToolContext) {
  return (args: ImprovePromptArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const body: Record<string, unknown> = { prompt: args.prompt, modality: args.modality };
      if (args.style !== undefined) body.style = args.style;

      const response = await ctx.client.post<ImprovePromptResponse>(
        "/api/v1/public/improve-prompt",
        { body }
      );
      const improvedPrompt = response?.data?.prompt ?? "";
      return textResult(
        formatJson({ improvedPrompt }) +
          "\n\nUse improvedPrompt verbatim in deepy_estimate_generation / deepy_create_generation " +
          "so the quoted cost matches the charge (quote == charge)."
      );
    });
}

export function registerImprovePrompt(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_improve_prompt",
    {
      title: "Improve a generation prompt",
      description:
        "Rewrite a draft prompt into a stronger one for the given modality (image/video/audio). " +
        "Returns the improved prompt text to reuse verbatim in estimate/create.",
      inputSchema: improvePromptInputSchema,
    },
    makeImprovePromptHandler(ctx)
  );
}
