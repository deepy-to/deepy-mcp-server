import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SKILL_SLUGS, SKILLS } from "./skills.js";

/**
 * Register the skill markdown documents as read-only MCP resources at
 * `deepy://skills/<slug>.md`. They are agent hints, not enforcement.
 */
export function registerResources(server: McpServer): void {
  for (const slug of SKILL_SLUGS) {
    const uri = `deepy://skills/${slug}.md`;
    const markdown = SKILLS[slug];
    server.registerResource(
      `deepy-skill-${slug}`,
      uri,
      {
        title: `Deepy skill: ${slug}`,
        description: `Guidance for the Deepy safe generation flow (${slug}). Hint only — the backend enforces the real rules.`,
        mimeType: "text/markdown",
      },
      (resourceUri) => ({
        contents: [
          {
            uri: resourceUri.href,
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      })
    );
  }
}
