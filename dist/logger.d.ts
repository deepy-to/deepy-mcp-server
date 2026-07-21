/**
 * Minimal leveled logger. IMPORTANT: it writes to **stderr** only — an MCP
 * stdio server reserves stdout for the JSON-RPC protocol, so any stray
 * stdout write corrupts the transport. Every line is redacted.
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export interface Logger {
    debug(...parts: unknown[]): void;
    info(...parts: unknown[]): void;
    warn(...parts: unknown[]): void;
    error(...parts: unknown[]): void;
}
export interface LoggerOptions {
    /** Known API key to redact from every line. */
    apiKey?: string;
    level?: LogLevel;
    /** Sink override for tests. Defaults to stderr. */
    sink?: (line: string) => void;
}
export declare function createLogger(options?: LoggerOptions): Logger;
export declare function parseLogLevel(value: string | undefined): LogLevel | undefined;
//# sourceMappingURL=logger.d.ts.map