import { z } from "zod";
import { formatJson, runTool, textResult } from "./runtime.js";
export const getModelInputSchema = {
    modelName: z
        .string()
        .min(1)
        .describe("Full model name, which may contain slashes, e.g. bytedance/seedance-2.0/text-to-video."),
};
/** Encode each path segment while preserving the model name's slashes. */
function encodeModelPath(modelName) {
    return modelName
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}
export function makeGetModelHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const path = `/api/v1/public/models/${encodeModelPath(args.modelName)}`;
        const model = await ctx.client.get(path);
        return textResult(formatJson(model));
    });
}
export function registerGetModel(server, ctx) {
    server.registerTool("deepy_get_model", {
        title: "Get Deepy model details",
        description: "Fetch the full schema for one model: its parameters, reference-file limits, generation type, and max prompt length. " +
            "A closed or unknown model returns MODEL_NOT_FOUND (closed models are never revealed).",
        inputSchema: getModelInputSchema,
    }, makeGetModelHandler(ctx));
}
//# sourceMappingURL=get-model.js.map