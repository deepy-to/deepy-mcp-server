import { z } from "zod";
import { formatJson, runTool, textResult } from "./runtime.js";
export const improvePromptInputSchema = {
    prompt: z.string().min(1).describe("The user's draft prompt to improve."),
    modality: z
        .enum(["image", "video", "audio"])
        .describe("Target modality for the generation the prompt is for."),
    style: z.string().optional().describe("Optional style hint (e.g. cinematic, photorealistic)."),
};
export function makeImprovePromptHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const body = { prompt: args.prompt, modality: args.modality };
        if (args.style !== undefined)
            body.style = args.style;
        const response = await ctx.client.post("/api/v1/public/improve-prompt", { body });
        const improvedPrompt = response?.data?.prompt ?? "";
        return textResult(formatJson({ improvedPrompt }) +
            "\n\nUse improvedPrompt verbatim in deepy_estimate_generation / deepy_create_generation " +
            "so the quoted cost matches the charge (quote == charge).");
    });
}
export function registerImprovePrompt(server, ctx) {
    server.registerTool("deepy_improve_prompt", {
        title: "Improve a generation prompt",
        description: "Rewrite a draft prompt into a stronger one for the given modality (image/video/audio). " +
            "Returns the improved prompt text to reuse verbatim in estimate/create.",
        inputSchema: improvePromptInputSchema,
    }, makeImprovePromptHandler(ctx));
}
//# sourceMappingURL=improve-prompt.js.map