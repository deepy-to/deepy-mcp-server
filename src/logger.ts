import { redactSecrets } from "./redact.js";

/**
 * Minimal leveled logger. IMPORTANT: it writes to **stderr** only — an MCP
 * stdio server reserves stdout for the JSON-RPC protocol, so any stray
 * stdout write corrupts the transport. Every line is redacted.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

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

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const threshold = LEVEL_WEIGHT[level];
  const sink =
    options.sink ??
    ((line: string) => {
      process.stderr.write(`${line}\n`);
    });

  const emit = (levelName: Exclude<LogLevel, "silent">, parts: unknown[]): void => {
    if (LEVEL_WEIGHT[levelName] < threshold) return;
    const message = parts.map((part) => redactSecrets(part, options.apiKey)).join(" ");
    sink(`[deepy-mcp] ${levelName}: ${message}`);
  };

  return {
    debug: (...parts) => emit("debug", parts),
    info: (...parts) => emit("info", parts),
    warn: (...parts) => emit("warn", parts),
    error: (...parts) => emit("error", parts),
  };
}

export function parseLogLevel(value: string | undefined): LogLevel | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized in LEVEL_WEIGHT) {
    return normalized as LogLevel;
  }
  return undefined;
}
