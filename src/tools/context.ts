import type { DeepyApiClient } from "../http/client.js";
import type { DeepyConfig } from "../config.js";
import type { Logger } from "../logger.js";

/** Shared dependencies handed to every tool handler. */
export interface ToolContext {
  client: DeepyApiClient;
  config: DeepyConfig;
  /** Same value as config.apiKey; kept explicit for redaction call sites. */
  apiKey: string;
  logger: Logger;
}
