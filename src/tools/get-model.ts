import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { formatJson, runTool, textResult } from "./runtime.js";
import type { ModelDetailResponse } from "../types.js";

export const getModelInputSchema = {
  modelName: z
    .string()
    .min(1)
    .describe(
      "Full model name, which may contain slashes, e.g. bytedance/seedance-2.0/text-to-video."
    ),
};

interface GetModelArgs {
  modelName: string;
}

/** Encode each path segment while preserving the model name's slashes. */
function encodeModelPath(modelName: string): string {
  return modelName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function makeGetModelHandler(ctx: ToolContext) {
  return (args: GetModelArgs): Promise<CallToolResult> =>
    runTool(ctx, async () => {
      const path = `/api/v1/public/models/${encodeModelPath(args.modelName)}`;
      const model = await ctx.client.get<ModelDetailResponse>(path);
      return textResult(formatJson(model));
    });
}

export function registerGetModel(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    "deepy_get_model",
    {
      title: "Get Deepy model details",
      description:
        "Fetch the full schema for one model: its parameters, reference-file limits, generation type, and max prompt length. " +
        "A closed or unknown model returns MODEL_NOT_FOUND (closed models are never revealed).",
      inputSchema: getModelInputSchema,
    },
    makeGetModelHandler(ctx)
  );
}
