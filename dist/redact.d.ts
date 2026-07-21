/**
 * Secret redaction. The API key (and anything that looks like one, plus
 * Bearer tokens) must never appear in logs, tool output, or error text.
 * Applied both to a known key value and via generic patterns as defense
 * in depth.
 */
export declare function redactSecrets(input: unknown, apiKey?: string): string;
//# sourceMappingURL=redact.d.ts.map