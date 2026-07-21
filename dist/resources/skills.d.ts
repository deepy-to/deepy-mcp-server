/**
 * Skill documents exposed as MCP resources under `deepy://skills/*.md`.
 * These are HINTS for the agent, not enforcement — the real rules (money,
 * moderation, idempotency) live in the backend. Kept as string constants so
 * the build is pure `tsc` (no file-copy step) and works under `npx`.
 */
export declare const SKILL_SLUGS: readonly ["model-selection", "prompt-optimization", "safe-generation-flow", "cost-confirmation"];
export type SkillSlug = (typeof SKILL_SLUGS)[number];
export declare const SKILLS: Readonly<Record<SkillSlug, string>>;
//# sourceMappingURL=skills.d.ts.map