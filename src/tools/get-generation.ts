import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { formatJson, runTool, textResult } from "./runtime.js";
import type { GenerationResponse } from "../types.js";

export const getGenerationInputSchema = {
  publicId: z.string().min(1).describe("The publicId returned by deepy_create_generation."),
};

interface GetGenerationArgs {
  publicId: string;
}

export function makeGetGenerationHandler(ctx: ToolContext) {
  return (args: GetGenerationArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const path = `/api/v1/public/generations/${encodeURIComponent(args.publicId)}`;
      const generation = await ctx.client.get<GenerationResponse>(path);

      let hint = "";
      if (generation.status === "COMPLETED") {
        hint = "\n\nStatus is COMPLETED — fetch the media with deepy_get_result.";
      } else if (generation.status === "FAILED") {
        hint =
          "\n\nStatus is FAILED — see errorCode/errorMessage. Do NOT auto-retry a paid create.";
      } else {
        hint = "\n\nStill in progress — poll again shortly.";
      }
      return textResult(formatJson(generation) + hint);
    });
}

export function registerGetGeneration(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_get_generation",
    {
      title: "Get generation status",
      description:
        "Fetch a generation's current status, error info, and result indexes by publicId. " +
        "Poll this after create until status is COMPLETED or FAILED.",
      inputSchema: getGenerationInputSchema,
    },
    makeGetGenerationHandler(ctx)
  );
}
