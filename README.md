# @deepy/mcp-server

Thin [MCP](https://modelcontextprotocol.io) server that lets external AI agents
(Cursor, Claude Desktop, Claude Code, Windsurf, …) drive **Deepy** generation of
video / image / audio over the **public Deepy API** using a personal API key.

It carries **no business logic** — billing, moderation, idempotency, rate limits,
provider access and ownership checks all stay in the Deepy backend, which is the
source of truth. This server is only a safe adapter that exposes Deepy as MCP
tools, prompts and resources.

---

## 1. Requirements

- **Node.js 22+** (the connector runs on your machine).
- A **Deepy API key** — create one in the Deepy web app under **API access**.
  It is shown only once and looks like `sk_live_…` (or `sk_test_…`).

## 2. Install & configure

Point your MCP client at the connector and give it two environment values:

| Variable             | Value                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| `DEEPY_API_BASE_URL` | Deepy API base URL, no trailing slash, e.g. `https://app.prod.einfra.tech` |
| `DEEPY_API_KEY`      | your personal key (`sk_live_…`) — **only** from config/env, never chat     |
| `DEEPY_LOG_LEVEL`    | optional: `debug\|info\|warn\|error\|silent` (default `info`)              |

### Option A — run straight from GitHub (works today, no npm needed)

`npx` clones this repo, installs its dependencies and runs the committed build —
no npm publish required.

**Cursor** — put this in `~/.cursor/mcp.json` (all projects) or
`.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "deepy": {
      "command": "npx",
      "args": ["-y", "github:deepy-to/deepy-mcp-server"],
      "env": {
        "DEEPY_API_BASE_URL": "https://app.prod.einfra.tech",
        "DEEPY_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

**Claude Desktop** — same block in `claude_desktop_config.json`, then restart
Claude Desktop. Ready-made copies live in [`mcp-configs/`](./mcp-configs).

### Option B — npm (once published)

When `@deepy/mcp-server` is published to npm, the args simplify to
`["-y", "@deepy/mcp-server"]`.

### Option C — local copy (offline / development)

Clone this repo (`git clone https://github.com/deepy-to/deepy-mcp-server`), run
`npm install`, then point the config at the built entrypoint:

```json
{
  "mcpServers": {
    "deepy": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/deepy-mcp-server/dist/index.js"],
      "env": {
        "DEEPY_API_BASE_URL": "https://app.prod.einfra.tech",
        "DEEPY_API_KEY": "sk_live_your_key_here"
      }
    }
  }
}
```

## 3. Tools

| Tool                        | Purpose                                        | Backend                                           |
| --------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `deepy_list_models`         | list available models                          | `GET /api/v1/public/models`                       |
| `deepy_get_model`           | model schema / options                         | `GET /api/v1/public/models/{name}`                |
| `deepy_improve_prompt`      | rewrite a draft prompt                         | `POST /api/v1/public/improve-prompt`              |
| `deepy_upload_file`         | upload a reference attachment (max 50 MiB)     | `POST /api/v1/public/files`                       |
| `deepy_estimate_generation` | price a generation (no charge)                 | `POST /api/v1/public/generations/estimate`        |
| `deepy_create_generation`   | start a generation (requires `confirmed=true`) | `POST /api/v1/public/generations`                 |
| `deepy_get_generation`      | poll status                                    | `GET /api/v1/public/generations/{id}`             |
| `deepy_get_result`          | fetch result media (server-side)               | `GET /api/v1/public/generations/{id}/results/{i}` |

The server also ships MCP **prompts** and **resources** (skills) that teach an
agent the safe generation flow.

## 4. Safe generation flow

1. Understand the task (ask 1–2 clarifying questions if unclear).
2. Pick a model (`deepy_list_models` / `deepy_get_model`).
3. Improve the prompt (`deepy_improve_prompt`).
4. For every image/video/audio attachment, call `deepy_upload_file` with its
   absolute local `filePath`; pass each returned `fileId` in `referenceFiles`.
5. Estimate the cost (`deepy_estimate_generation`).
6. Show the price and get **explicit** user approval.
7. Only then `deepy_create_generation` with `confirmed=true`.
8. Poll `deepy_get_generation`, then fetch `deepy_get_result`.

`deepy_upload_file` accepts files up to 50 MiB. A `base64` + `filename` fallback
exists for clients that cannot expose a local attachment path, but `filePath` is
recommended for large files because base64 expands the MCP request.

`deepy_create_generation` **refuses** to run without `confirmed=true`, generates
an idempotency key when none is given, and never retries a paid create.

## 5. Security

- The API key is read **only** from `DEEPY_API_KEY` (config/env), never from
  tool arguments or chat text, and is **redacted from every log line**.
- The server never talks to WaveSpeed/RunPod, the database or S3 directly, and
  never returns private provider/S3 URLs.
- The backend remains authoritative for moderation, billing, rate limits and
  ownership. On `INSUFFICIENT_CREDITS` top up; on `CONTENT_REJECTED` the content
  broke the rules; on `MODEL_NOT_FOUND` re-list the catalog; on
  `IDEMPOTENCY_CONFLICT` do **not** auto-retry.

## 6. Troubleshooting

| Symptom                | Fix                                                                        |
| ---------------------- | -------------------------------------------------------------------------- |
| No Deepy tools appear  | Node.js installed? config saved in the right file? client fully restarted? |
| `Unauthorized`         | key missing/mistyped/disabled — reissue it on API access                   |
| `Insufficient balance` | top up the balance and retry                                               |
| `Model not found`      | list models and pick one from the catalog                                  |

## 7. Development

```bash
npm install
npm run build       # tsc -> dist/
npm test            # vitest (safety-critical behaviour)
npm run dev         # tsx src/index.ts
```
