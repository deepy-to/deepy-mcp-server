#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createLogger, parseLogLevel } from "./logger.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";
import { ConfigError } from "./errors.js";
import { redactSecrets } from "./redact.js";
// Captured after config loads so the top-level crash handler can redact the key.
let resolvedApiKey;
async function main() {
    const level = parseLogLevel(process.env.DEEPY_LOG_LEVEL) ?? "info";
    const bootLogger = createLogger({ level });
    let config;
    try {
        config = loadConfig();
    }
    catch (err) {
        if (err instanceof ConfigError) {
            // Clear, actionable startup error — no server is started.
            bootLogger.error(err.message);
            process.exit(1);
        }
        throw err;
    }
    resolvedApiKey = config.apiKey;
    const logger = createLogger({ apiKey: config.apiKey, level });
    const server = createServer({ config, logger });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stderr only — stdout carries the MCP protocol. Base URL is not a secret;
    // the API key is never logged.
    logger.info(`${SERVER_NAME} v${SERVER_VERSION} connected (base=${config.baseUrl}).`);
}
main().catch((err) => {
    process.stderr.write(`[deepy-mcp] fatal: ${redactSecrets(err, resolvedApiKey)}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map