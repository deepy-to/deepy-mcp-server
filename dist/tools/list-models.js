import { z } from "zod";
import { formatJson, runTool, textResult } from "./runtime.js";
export const listModelsInputSchema = {
    type: z
        .string()
        .optional()
        .describe("Optional generation-type filter, e.g. TEXT_TO_IMAGE, TEXT_TO_VIDEO, TEXT_TO_AUDIO."),
    family: z.string().optional().describe("Optional model family filter."),
    group: z.string().optional().describe("Optional model group filter."),
};
export function makeListModelsHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const models = await ctx.client.get("/api/v1/public/models", {
            query: { type: args.type, family: args.family, group: args.group },
        });
        const count = Array.isArray(models) ? models.length : 0;
        return textResult(formatJson({ count, models }));
    });
}
export function registerListModels(server, ctx) {
    server.registerTool("deepy_list_models", {
        title: "List Deepy models",
        description: "List the AI models available to your Deepy API key (only opened/available models are returned). " +
            "Optionally filter by generation type, family, or group. Use this before estimating or creating a generation.",
        inputSchema: listModelsInputSchema,
    }, makeListModelsHandler(ctx));
}
//# sourceMappingURL=list-models.js.map