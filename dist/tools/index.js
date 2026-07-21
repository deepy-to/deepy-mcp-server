import { registerListModels } from "./list-models.js";
import { registerGetModel } from "./get-model.js";
import { registerImprovePrompt } from "./improve-prompt.js";
import { registerEstimateGeneration } from "./estimate-generation.js";
import { registerCreateGeneration } from "./create-generation.js";
import { registerGetGeneration } from "./get-generation.js";
import { registerGetResult } from "./get-result.js";
export function registerAllTools(server, ctx) {
    registerListModels(server, ctx);
    registerGetModel(server, ctx);
    registerImprovePrompt(server, ctx);
    registerEstimateGeneration(server, ctx);
    registerCreateGeneration(server, ctx);
    registerGetGeneration(server, ctx);
    registerGetResult(server, ctx);
}
//# sourceMappingURL=index.js.map