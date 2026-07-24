import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "./context.js";
import { registerListModels } from "./list-models.js";
import { registerGetModel } from "./get-model.js";
import { registerImprovePrompt } from "./improve-prompt.js";
import { registerEstimateGeneration } from "./estimate-generation.js";
import { registerCreateGeneration } from "./create-generation.js";
import { registerGetGeneration } from "./get-generation.js";
import { registerGetResult } from "./get-result.js";
import { registerUploadFile } from "./upload-file.js";

export function registerAllTools(server: McpServer, ctx: ToolContext): void {
  registerListModels(server, ctx);
  registerGetModel(server, ctx);
  registerImprovePrompt(server, ctx);
  registerUploadFile(server, ctx);
  registerEstimateGeneration(server, ctx);
  registerCreateGeneration(server, ctx);
  registerGetGeneration(server, ctx);
  registerGetResult(server, ctx);
}

export type { ToolContext } from "./context.js";
