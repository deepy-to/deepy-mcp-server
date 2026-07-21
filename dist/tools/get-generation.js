import { z } from "zod";
import { formatJson, runTool, textResult } from "./runtime.js";
export const getGenerationInputSchema = {
    publicId: z.string().min(1).describe("The publicId returned by deepy_create_generation."),
};
export function makeGetGenerationHandler(ctx) {
    return (args) => runTool(ctx, async () => {
        const path = `/api/v1/public/generations/${encodeURIComponent(args.publicId)}`;
        const generation = await ctx.client.get(path);
        let hint = "";
        if (generation.status === "COMPLETED") {
            hint = "\n\nStatus is COMPLETED — fetch the media with deepy_get_result.";
        }
        else if (generation.status === "FAILED") {
            hint =
                "\n\nStatus is FAILED — see errorCode/errorMessage. Do NOT auto-retry a paid create.";
        }
        else {
            hint = "\n\nStill in progress — poll again shortly.";
        }
        return textResult(formatJson(generation) + hint);
    });
}
export function registerGetGeneration(server, ctx) {
    server.registerTool("deepy_get_generation", {
        title: "Get generation status",
        description: "Fetch a generation's current status, error info, and result indexes by publicId. " +
            "Poll this after create until status is COMPLETED or FAILED.",
        inputSchema: getGenerationInputSchema,
    }, makeGetGenerationHandler(ctx));
}
//# sourceMappingURL=get-generation.js.map