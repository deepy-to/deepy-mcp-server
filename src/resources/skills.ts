/**
 * Skill documents exposed as MCP resources under `deepy://skills/*.md`.
 * These are HINTS for the agent, not enforcement — the real rules (money,
 * moderation, idempotency) live in the backend. Kept as string constants so
 * the build is pure `tsc` (no file-copy step) and works under `npx`.
 */

export const SKILL_SLUGS = [
  "model-selection",
  "prompt-optimization",
  "safe-generation-flow",
  "cost-confirmation",
] as const;

export type SkillSlug = (typeof SKILL_SLUGS)[number];

export const SKILLS: Readonly<Record<SkillSlug, string>> = {
  "model-selection": `# Deepy skill: model selection

Goal: pick the right Deepy model for the user's task before spending anything.

1. Call \`deepy_list_models\`. Filter by \`type\` when you know the modality
   (\`TEXT_TO_IMAGE\`, \`TEXT_TO_VIDEO\`, \`IMAGE_TO_VIDEO\`, \`TEXT_TO_AUDIO\`).
2. Only models opened for your API key are returned. If the model you want is
   missing, it is closed — do not guess model names (a closed/unknown model
   returns \`MODEL_NOT_FOUND\`).
3. Call \`deepy_get_model\` for the candidate to read its \`parameters\`,
   \`referenceLimits\`, and \`maxPromptLength\` before building the request.
4. For image-/video-from-image models, check \`supportsReferences\` and the
   reference limits. Call \`deepy_upload_file\` for every attachment (prefer its
   local \`filePath\`), then pass the returned ids in \`referenceFiles\`.

Never invent parameters — use only what the model schema declares.
`,

  "prompt-optimization": `# Deepy skill: prompt optimization

Goal: turn a rough idea into a strong prompt without changing the cost basis.

1. Call \`deepy_improve_prompt\` with the draft \`prompt\` and the \`modality\`
   (\`image\` | \`video\` | \`audio\`); optionally pass a \`style\`.
2. Use the returned \`improvedPrompt\` verbatim in both
   \`deepy_estimate_generation\` and \`deepy_create_generation\`.
3. Do NOT edit the prompt between estimate and create — the estimate and the
   charge must be based on byte-identical params (quote == charge).
`,

  "safe-generation-flow": `# Deepy skill: safe generation flow

Always follow this order. Never skip the estimate or the confirmation.

1. \`deepy_list_models\` → choose a model (see model-selection).
2. \`deepy_get_model\` → read the parameter schema.
3. \`deepy_improve_prompt\` (optional) → strengthen the prompt.
4. If the user supplied attachments, call \`deepy_upload_file\` for each and
   put the returned ids in \`referenceFiles\`.
5. \`deepy_estimate_generation\` → get the integer \`tokens\` cost and
   \`userBalanceAfter\`.
6. Show the user the cost and get EXPLICIT approval.
7. \`deepy_create_generation\` with \`confirmed=true\` and the SAME params used
   for the estimate. The tool refuses (and calls no backend) if not confirmed.
8. \`deepy_get_generation\` → poll until \`COMPLETED\` or \`FAILED\`.
9. \`deepy_get_result\` → the server fetches the media with its API key,
   saves it locally on the user's device, and returns the file path.
   Small images/audio may also render inline; videos are delivered only as a
   local file path. Do not auto-retry a paid create on error.
`,

  "cost-confirmation": `# Deepy skill: cost confirmation

Money is integer-only and the backend is the source of truth.

- Never compute or guess a price. Only show the \`tokens\` value returned by
  \`deepy_estimate_generation\`.
- Present \`tokens\` (cost) and \`userBalanceAfter\` to the user in plain terms
  and wait for an explicit yes before creating.
- Only set \`confirmed=true\` after that explicit approval.
- If create fails with \`INSUFFICIENT_CREDITS\`, tell the user to top up and
  keep the plan; do not retry automatically.
- A generation is charged at most once. If you see \`IDEMPOTENCY_CONFLICT\`,
  do NOT retry — check status with \`deepy_get_generation\` instead.
`,
};
