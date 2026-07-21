/**
 * Deterministic JSON serialization with recursively sorted object keys.
 * Used only for deriving a stable idempotency key from a request body so
 * that logically-equal bodies (regardless of key order) hash the same.
 */
export function stableStringify(value) {
    return JSON.stringify(sortValue(value));
}
function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value !== null && typeof value === "object") {
        const source = value;
        const sorted = {};
        for (const key of Object.keys(source).sort()) {
            sorted[key] = sortValue(source[key]);
        }
        return sorted;
    }
    return value;
}
//# sourceMappingURL=stable-stringify.js.map