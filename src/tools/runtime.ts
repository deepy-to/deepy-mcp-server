import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DeepyApiError, ERROR_GUIDANCE } from "../errors.js";
import { redactSecrets } from "../redact.js";
import type { ToolContext } from "./context.js";

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** An MCP image content block (base64), optionally preceded by a text caption. */
export function imageResult(base64: string, mimeType: string, caption?: string): CallToolResult {
  const content: CallToolResult["content"] = [];
  if (caption) content.push({ type: "text", text: caption });
  content.push({ type: "image", data: base64, mimeType });
  return { content };
}

/** An MCP audio content block (base64), optionally preceded by a text caption. */
export function audioResult(base64: string, mimeType: string, caption?: string): CallToolResult {
  const content: CallToolResult["content"] = [];
  if (caption) content.push({ type: "text", text: caption });
  content.push({ type: "audio", data: base64, mimeType });
  return { content };
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Execute a tool body with uniform guarantees:
 *  - backend errors are surfaced (never swallowed) with code + guidance;
 *  - any unexpected error becomes a clean tool error, not a crash;
 *  - ALL text output is redacted so the API key can never leak.
 */
export async function runTool(
  ctx: ToolContext,
  fn: () => Promise<CallToolResult>
): Promise<CallToolResult> {
  try {
    const result = await fn();
    return redactResult(result, ctx.apiKey);
  } catch (err) {
    return redactResult(toErrorResult(err), ctx.apiKey);
  }
}

export function toErrorResult(err: unknown): CallToolResult {
  if (err instanceof DeepyApiError) {
    const guidance = ERROR_GUIDANCE[err.code];
    const retry = err.retryAfter ? ` (retry after ${err.retryAfter})` : "";
    const hint = guidance ? `\n→ ${guidance}` : "";
    return errorResult(`[${err.code}] ${err.message}${retry}${hint}`);
  }
  const message = err instanceof Error ? err.message : String(err);
  return errorResult(`[INTERNAL_ERROR] Unexpected MCP server error: ${message}`);
}

function redactResult(result: CallToolResult, apiKey: string): CallToolResult {
  if (!Array.isArray(result.content)) return result;
  return {
    ...result,
    content: result.content.map((block) =>
      block.type === "text" ? { ...block, text: redactSecrets(block.text, apiKey) } : block
    ),
  };
}
