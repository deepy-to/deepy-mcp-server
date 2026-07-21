import { z } from "zod";
/** Wrap text as a single user message (the shape MCP prompts expect). */
function userMessage(text) {
    return {
        messages: [
            {
                role: "user",
                content: { type: "text", text },
            },
        ],
    };
}
/**
 * Register agent-facing prompt templates. These are HINTS that steer an agent
 * toward the safe flow; they do not enforce anything (the backend does).
 */
export function registerPrompts(server) {
    server.registerPrompt("deepy_safe_generation_flow", {
        title: "Deepy: safe generation flow",
        description: "The end-to-end, confirmation-gated flow for creating a Deepy generation.",
        argsSchema: {},
    }, () => userMessage([
        "Follow the Deepy safe generation flow. Never skip the estimate or the user confirmation.",
        "",
        "1. deepy_list_models — pick a model (filter by type when you know the modality).",
        "2. deepy_get_model — read its parameter schema and reference limits.",
        "3. deepy_improve_prompt — (optional) strengthen the prompt for the modality.",
        "4. deepy_estimate_generation — get the integer token cost and resulting balance.",
        "5. Show the user the cost and get EXPLICIT approval.",
        "6. deepy_create_generation with confirmed=true and the SAME params used for the estimate",
        "   (quote == charge). The tool refuses and calls no backend if confirmed is not true.",
        "7. deepy_get_generation — poll until COMPLETED or FAILED.",
        "8. deepy_get_result — the server fetches the media and returns images/audio inline",
        "   (videos/large files come back as a note pointing to the Deepy app).",
        "",
        "The backend owns money, moderation, and idempotency. Do not reimplement them and do not",
        "auto-retry a paid create on error (especially IDEMPOTENCY_CONFLICT).",
    ].join("\n")));
    server.registerPrompt("deepy_choose_model", {
        title: "Deepy: choose a model",
        description: "Help select an available Deepy model for a task/modality.",
        argsSchema: {
            task: z.string().optional().describe("What the user wants to create."),
            modality: z.string().optional().describe("image | video | audio, if known."),
        },
    }, (args) => userMessage([
        `Choose a Deepy model for this task: ${args.task ?? "(unspecified)"}.`,
        args.modality ? `Target modality: ${args.modality}.` : "",
        "",
        "Call deepy_list_models (filter by type when the modality is known). Only models opened for",
        "this API key are returned; never guess a model name. Then call deepy_get_model on the",
        "candidate to confirm it supports the required parameters and references before proceeding.",
    ]
        .filter(Boolean)
        .join("\n")));
    server.registerPrompt("deepy_prompt_optimizer", {
        title: "Deepy: optimize a prompt",
        description: "Improve a draft prompt for a given modality.",
        argsSchema: {
            prompt: z.string().optional().describe("The draft prompt to improve."),
            modality: z.string().optional().describe("image | video | audio."),
        },
    }, (args) => userMessage([
        "Improve the user's prompt with deepy_improve_prompt.",
        args.prompt ? `Draft prompt: ${args.prompt}` : "Ask the user for the draft prompt first.",
        args.modality
            ? `Modality: ${args.modality}`
            : "Confirm the modality (image/video/audio).",
        "",
        "Use the returned improvedPrompt verbatim in estimate and create — do not edit it in between,",
        "so the quote matches the charge (quote == charge).",
    ].join("\n")));
    server.registerPrompt("deepy_troubleshooting", {
        title: "Deepy: troubleshooting",
        description: "Explain a Deepy error code and the correct next step.",
        argsSchema: {
            errorCode: z
                .string()
                .optional()
                .describe("The {code} returned by the backend, e.g. INSUFFICIENT_CREDITS."),
        },
    }, (args) => userMessage([
        `Explain and recover from the Deepy error${args.errorCode ? `: ${args.errorCode}` : ""}.`,
        "",
        "- MODEL_NOT_FOUND → re-fetch the catalog with deepy_list_models.",
        "- INSUFFICIENT_CREDITS → tell the user to top up; keep the plan; do not retry.",
        "- CONTENT_REJECTED → moderation rejected it; ask the user to revise the prompt.",
        "- IDEMPOTENCY_CONFLICT → do NOT retry; check status with deepy_get_generation.",
        "- UNAUTHORIZED → the API key is invalid/disabled; verify DEEPY_API_KEY.",
        "- RATE_LIMITED / TOO_MANY_ACTIVE_GENERATIONS → back off and retry later.",
        "",
        "Never hide a backend error from the user, and never reimplement billing or moderation.",
    ].join("\n")));
}
//# sourceMappingURL=index.js.map