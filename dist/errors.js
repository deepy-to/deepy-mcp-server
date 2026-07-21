/**
 * Typed errors + the backend `{code,message}` envelope mapping.
 * The guidance strings mirror `deepy-tools-contract.md` §6 so the agent
 * gets an actionable hint, but the backend remains the source of truth.
 */
const KNOWN_CODES = new Set([
    "MODEL_NOT_FOUND",
    "INSUFFICIENT_CREDITS",
    "CONTENT_REJECTED",
    "IDEMPOTENCY_CONFLICT",
    "UNAUTHORIZED",
    "VALIDATION_FAILED",
    "FILE_TOO_LARGE",
    "RATE_LIMITED",
    "TOO_MANY_ACTIVE_GENERATIONS",
    "INTERNAL_ERROR",
    "NETWORK_ERROR",
    "INVALID_RESPONSE",
]);
export const ERROR_GUIDANCE = {
    MODEL_NOT_FOUND: "Re-fetch the catalog (deepy_list_models); the model may be closed or renamed.",
    INSUFFICIENT_CREDITS: "Tell the user to top up their Deepy balance. Keep the plan; do NOT auto-retry.",
    CONTENT_REJECTED: "Deepy moderation rejected this content. Explain to the user and ask them to revise the prompt.",
    IDEMPOTENCY_CONFLICT: "A generation with this idempotency key already exists. Do NOT auto-retry; check status with deepy_get_generation.",
    UNAUTHORIZED: "The API key is invalid or disabled. Ask the user to verify DEEPY_API_KEY in the MCP config.",
    VALIDATION_FAILED: "Request parameters are invalid. Read the message, fix the params, and retry.",
    FILE_TOO_LARGE: "The reference file is too large. Use a smaller file.",
    RATE_LIMITED: "Rate limited. Back off and retry after the Retry-After delay.",
    TOO_MANY_ACTIVE_GENERATIONS: "Too many active generations. Wait for some to finish, then retry.",
    INTERNAL_ERROR: "The backend hit an internal error. Surface it to the user; do not hide it.",
    NETWORK_ERROR: "Could not reach the Deepy backend. Check DEEPY_API_BASE_URL and connectivity.",
    INVALID_RESPONSE: "The backend returned an unexpected or unparseable response.",
};
/** Thrown at startup when the environment is misconfigured. */
export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigError";
    }
}
/** A backend-originated (or transport) error, carrying the contract code. */
export class DeepyApiError extends Error {
    code;
    httpStatus;
    retryAfter;
    constructor(init) {
        super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
        this.name = "DeepyApiError";
        this.code = init.code;
        this.httpStatus = init.httpStatus;
        this.retryAfter = init.retryAfter;
    }
    /** Map an HTTP error response (parsed body may be the `{code,message}` envelope). */
    static fromResponse(status, body, retryAfter) {
        const envelope = extractEnvelope(body);
        const code = envelope.code && KNOWN_CODES.has(envelope.code)
            ? envelope.code
            : statusToCode(status);
        const message = envelope.message ?? `Deepy API request failed (${code}, HTTP ${status}).`;
        return new DeepyApiError({
            code,
            message,
            httpStatus: status,
            retryAfter: retryAfter ?? null,
        });
    }
}
function extractEnvelope(body) {
    if (body !== null && typeof body === "object") {
        const record = body;
        return {
            code: typeof record.code === "string" ? record.code : undefined,
            message: typeof record.message === "string" ? record.message : undefined,
        };
    }
    return {};
}
function statusToCode(status) {
    switch (status) {
        case 400:
            return "VALIDATION_FAILED";
        case 401:
        case 403:
            return "UNAUTHORIZED";
        case 402:
            return "INSUFFICIENT_CREDITS";
        case 404:
            return "MODEL_NOT_FOUND";
        case 409:
            return "IDEMPOTENCY_CONFLICT";
        case 413:
            return "FILE_TOO_LARGE";
        case 422:
            return "CONTENT_REJECTED";
        case 429:
            return "RATE_LIMITED";
        default:
            if (status >= 500)
                return "INTERNAL_ERROR";
            if (status >= 400)
                return "VALIDATION_FAILED";
            return "INTERNAL_ERROR";
    }
}
//# sourceMappingURL=errors.js.map