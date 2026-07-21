/**
 * Deterministic JSON serialization with recursively sorted object keys.
 * Used only for deriving a stable idempotency key from a request body so
 * that logically-equal bodies (regardless of key order) hash the same.
 */
export declare function stableStringify(value: unknown): string;
//# sourceMappingURL=stable-stringify.d.ts.map