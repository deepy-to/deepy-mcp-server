import { z } from "zod";
import { formatJson, runTool, textResult } from "./runtime.js";
import { buildGenerationBody } from "../generation-body.js";
export const estimateGenerationInputSchema = {
    modelName: z.string().min(1).describe("Model name from deepy_list_models / deepy_get_model."),
    prompt: z.string().describe("The generation prompt (use deepy_improve_prompt output verbatim)."),
    parameters: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Model-specific parameters (see the model schema). Defaults to {}."),
    referenceFiles: z
        .array(z.string())
        .optional()
        .describe("Reference file ids for image/video-from-image models. Defaults to []."),
};
export function makeEstimateGenerationHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const body = buildGenerationBody(args);
        const estimate = await ctx.client.post("/api/v1/public/generations/estimate", { body });
        return textResult(formatJson(estimate) +
            '\n\nShow the user "tokens" (the integer cost) and "userBalanceAfter", then get explicit ' +
            "confirmation before calling deepy_create_generation with confirmed=true. The backend is the " +
            "source of truth for pricing and will reject with INSUFFICIENT_CREDITS if the balance is too low.");
    });
}
export function registerEstimateGeneration(server, ctx) {
    server.registerTool("deepy_estimate_generation", {
        title: "Estimate generation cost",
        description: "Get the integer token cost and resulting balance for a generation, without charging anything. " +
            "Always estimate and confirm with the user before creating. The exact same params must be passed to " +
            "deepy_create_generation (quote == charge).",
        inputSchema: estimateGenerationInputSchema,
    }, makeEstimateGenerationHandler(ctx));
}
//# sourceMappingURL=estimate-generation.js.map