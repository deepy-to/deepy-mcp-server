/**
 * Typed errors + the backend `{code,message}` envelope mapping.
 * The guidance strings mirror `deepy-tools-contract.md` §6 so the agent
 * gets an actionable hint, but the backend remains the source of truth.
 */
export type DeepyErrorCode = "MODEL_NOT_FOUND" | "INSUFFICIENT_CREDITS" | "CONTENT_REJECTED" | "IDEMPOTENCY_CONFLICT" | "UNAUTHORIZED" | "VALIDATION_FAILED" | "FILE_TOO_LARGE" | "RATE_LIMITED" | "TOO_MANY_ACTIVE_GENERATIONS" | "INTERNAL_ERROR" | "NETWORK_ERROR" | "INVALID_RESPONSE";
export declare const ERROR_GUIDANCE: Readonly<Record<DeepyErrorCode, string>>;
/** Thrown at startup when the environment is misconfigured. */
export declare class ConfigError extends Error {
    constructor(message: string);
}
export interface DeepyApiErrorInit {
    code: DeepyErrorCode;
    message: string;
    httpStatus?: number;
    retryAfter?: string | null;
    cause?: unknown;
}
/** A backend-originated (or transport) error, carrying the contract code. */
export declare class DeepyApiError extends Error {
    readonly code: DeepyErrorCode;
    readonly httpStatus: number | undefined;
    readonly retryAfter: string | null | undefined;
    constructor(init: DeepyApiErrorInit);
    /** Map an HTTP error response (parsed body may be the `{code,message}` envelope). */
    static fromResponse(status: number, body: unknown, retryAfter?: string | null): DeepyApiError;
}
//# sourceMappingURL=errors.d.ts.map