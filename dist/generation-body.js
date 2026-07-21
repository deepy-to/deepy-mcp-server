/**
 * Build the request body used by BOTH `deepy_estimate_generation` and
 * `deepy_create_generation`. Both tools call this with the same input and
 * the client serializes with `JSON.stringify`, so the bytes are identical:
 * this is what upholds the `quote == charge` invariant. Key order here is
 * intentional and MUST match between estimate and create.
 */
export function buildGenerationBody(input) {
    return {
        modelName: input.modelName,
        prompt: input.prompt,
        parameters: input.parameters ?? {},
        referenceFiles: input.referenceFiles ?? [],
    };
}
//# sourceMappingURL=generation-body.js.map