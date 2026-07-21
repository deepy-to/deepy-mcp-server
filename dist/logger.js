import { redactSecrets } from "./redact.js";
const LEVEL_WEIGHT = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 100,
};
export function createLogger(options = {}) {
    const level = options.level ?? "info";
    const threshold = LEVEL_WEIGHT[level];
    const sink = options.sink ??
        ((line) => {
            process.stderr.write(`${line}\n`);
        });
    const emit = (levelName, parts) => {
        if (LEVEL_WEIGHT[levelName] < threshold)
            return;
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
export function parseLogLevel(value) {
    if (!value)
        return undefined;
    const normalized = value.trim().toLowerCase();
    if (normalized in LEVEL_WEIGHT) {
        return normalized;
    }
    return undefined;
}
//# sourceMappingURL=logger.js.map