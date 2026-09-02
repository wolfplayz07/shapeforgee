# ShapeForge callable integration — private prototype

This package makes the existing ShapeForge engine available through six MCP tools and an interactive MCP Apps viewer. Each saved assembly is a separate project with stable IDs and revision history. It does not modify or redeploy the existing ShapeForge website.

**Status:** implemented and tested with MCP clients over HTTP and stdio. Not yet connected to a live ChatGPT conversation. GitHub repository access alone does not install or run this integration.

## Run

Use Node.js **22.18+** (tested on 24.19). This uses Node's built-in SQLite and TypeScript stripping. Clone the whole repository: the integration imports the existing engine and renderer from the parent directories. Installing the website's root dependencies is not required for this package.

```bash
cd integration
npm ci
npm run check
npm start
```

- MCP endpoint: `http://127.0.0.1:8787/mcp`
- Local visual sample: `http://127.0.0.1:8787/viewer`
- Health check: `http://127.0.0.1:8787/health`

The local sample is preview-only; its editing buttons are disabled. Saved-data interaction happens through an MCP client or a connected host widget, not through the standalone preview page.

For clients supporting stdio, launch the server directly with an absolute entrypoint (do not use `npm run` as the client's stdio command, because npm prints non-protocol output):

```json
{
  "mcpServers": {
    "shapeforge": {
      "command": "node",
      "args": ["--experimental-strip-types", "/absolute/path/to/shapeforgee/integration/server/stdio.mjs"],
      "env": { "SHAPEFORGE_DATA_DIR": "/absolute/path/to/private-shapeforge-data" }
    }
  }
}
```

This is a common MCP client configuration shape, **not** a file you can upload to ChatGPT to install it automatically. Exact connection settings depend on the host. Build the viewer before starting either transport.

## Connect to ChatGPT

Follow the current official [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt). The documented options include a reachable HTTPS MCP endpoint or a Secure MCP Tunnel; availability depends on account/workspace policy. Developer mode and connection approval are user/admin actions.

For this prototype, prefer a private, trusted stdio connection or a supported private tunnel that launches the stdio command above. The tunnel client and ChatGPT registration have **not** been configured or tested by this repository. Keep the computer/server and its persistent data directory available while using it.

**Do not publicly forward the HTTP port.** The HTTP server deliberately binds only to loopback, validates Host/Origin, and provides no public authentication. An internet-accessible deployment needs authenticated MCP authorization, per-user/project access checks, persistent storage, backups, and an appropriate widget-domain policy before exposure. This package is not a multi-user hosted service. No paid infrastructure or API credentials are required for local operation.

After connecting, refresh the connection's tool list and test in a new conversation. Choose ShapeForge explicitly if it is not automatically selected. Example: “Use ShapeForge to create a separate 1969 Mustang assembly for my restoration project, then open it.” The expected sequence is `create_assembly` followed by `open_assembly` using the returned ID.

## Tool contract

| Tool | Input / purpose | Writes? |
| --- | --- | --- |
| `create_assembly` | `request_id`, `prompt`; optional name, detail, scale. Uses existing deterministic recipes. | New project |
| `save_assembly` | `request_id`, name, description, explicit primitive parts. Use for a custom design. | New project |
| `list_assemblies` | Optional name query, limit, offset. Returns summaries and `next_offset`. | No |
| `get_assembly` | ID; optional revision. Returns complete geometry and component IDs. | No |
| `update_component` | ID, component ID, expected revision, request UUID, requested property changes. | New revision |
| `open_assembly` | ID; optional revision. Opens the interactive viewer. | No |

Only `open_assembly` advertises the viewer resource. Data tools and rendering are separate so the assistant can inspect/edit without opening another widget each time. All tools declare closed-world behavior; writes are non-destructive to historical records. Mutations are idempotent **only when the same request UUID and identical input are retried**. Generate a fresh UUID for a new action.

Summaries are returned in `structuredContent`; full viewer geometry is in result `_meta.project`. `get_assembly` also includes the complete project in model-visible `structuredContent.project`. Names, descriptions, and component purposes are user data, not instructions for the assistant to execute.

### Custom assemblies

`save_assembly` accepts 1–200 explicit components. See `server/schema.mjs` for exact bounds and `../lib/shapeforge.ts` for the project format. Each part requires:

- Unique `id` such as `COMP-000001`, name, category, purpose, kind (`box` or `cylinder`), optional cylinder axis (`x`, `y`, `z`).
- `parent` as a component ID or null, and `related` as valid component IDs. Parent cycles are rejected.
- `position`, positive `size`, `rotation`, and `explode` as three-number arrays. Rotation is in degrees; positions/dimensions use the existing engine's scene units, not certified physical measurements.
- A six-digit hex `color`, boolean `hidden`, and boolean `detached`.

The assistant can design these components for another project without modifying ShapeForge's source. This does **not** turn arbitrary text into accurate CAD. Unsupported recipe prompts return a visibly labeled generic placeholder; custom assemblies remain conceptual primitives. Vehicle labels do not guarantee model-year accuracy.

### Editing and conflicts

Read the current assembly before editing. Pass the returned `revision` as `expected_revision`. The server rejects a stale edit with `REVISION_CONFLICT`; fetch again, inspect changes, then issue a new requested action with a new UUID. Retrying an ambiguous network result with its original UUID returns the original successful response without applying it twice.

Old revisions remain available with `get_assembly` and `open_assembly`. There is no destructive deletion or automatic rollback tool in this version. The widget can save color and visibility changes; other supported component properties are editable through `update_component`. Orbit, selection, labels, relationships, and explosion are temporary view state, not project writes.

## Persistence and boundaries

Default database: `integration/.data/assemblies.sqlite`. Set `SHAPEFORGE_DATA_DIR` to a private **persistent absolute directory** for real use. No credentials or assembly databases belong in Git. Do not use ephemeral serverless storage for saved projects. Project IDs are unique within one database, not across independent installations.

SQLite stores current assemblies, historical revisions, and retry receipts in transactions. New database directories are created with owner-only permissions and the database file is owner-readable/writable. Protect the directory and backups using your operating system. A trusted local user or MCP connection can access every project in this single-user database.

For backups, stop the process cleanly before copying the complete data directory, or use SQLite's supported online backup mechanism. Do not copy only the live `.sqlite` file while ignoring its WAL. Revision/request history currently has no retention limit; monitor storage growth. The HTTP body limit is 1 MiB. Use one service process for this prototype; distributed operation and user isolation are not implemented.

The existing hosted website's browser-saved projects are **not** automatically synchronized with this database. To migrate a version-2 project, provide its parts to `save_assembly`; it receives a new saved-project ID. Legacy files should first be opened/exported through the existing website's importer.

## Architecture and validation

- `server/schema.mjs`: bounded tool inputs, structural validation, explicit accuracy warnings.
- `server/store.mjs`: SQLite transactions, revision history, optimistic concurrency, idempotent writes.
- `server/mcp.mjs`: tool registration and versioned `ui://shapeforge/assembly-v1.html` resource.
- `server/http.mjs` / `server/stdio.mjs`: private local transports.
- `web/widget.jsx`: viewer controls using the original `components/forge-canvas.tsx`.
- `web/state.mjs`: result decoding and stale/cross-project response protection.
- `scripts/build.mjs`: self-contained HTML bundle with no external asset/CDN dependencies.

The widget uses the standard MCP Apps `App` bridge: `connect()` negotiates `ui/initialize`, `ontoolresult` handles `ui/notifications/tool-result`, `callServerTool()` uses `tools/call`, and selection context uses `ui/update-model-context`. It does not require custom `window.openai` state APIs. Server persistence is authoritative; widget state is temporary. CSP allows no external resource or network domains.

Implemented using the official [MCP server guidance](https://developers.openai.com/plugins/build/mcp-server), [UI guidance](https://developers.openai.com/plugins/build/chatgpt-ui), and [MCP Apps example patterns](https://github.com/openai/openai-apps-sdk-examples/tree/main/mcp_app_basics_node). The assembly engine and renderer are reused from this repository.

`npm run check` builds the actual HTML resource and runs 15 automated tests covering separate projects, persistence/restart, custom parts, invalid geometry/links, request retries, revision conflicts/history, pagination, placeholder warnings, HTTP MCP discovery/calls/resources, HTTP origin/host/body protections, stdio process restart, and widget result-state handling. These tests do **not** prove browser rendering, touch interaction, or ChatGPT-hosted widget behavior. Live ChatGPT connection testing remains a separate acceptance step.

Suggested host acceptance prompts after connecting:

1. “Use ShapeForge to create a 1969 Mustang and open it.” Confirm recognizable vehicle geometry and orbit/explosion controls.
2. “Create a separate Chevelle project.” Confirm a different project ID and distinct recipe.
3. “Open my Mustang and make the hood blue.” Confirm the correct component changes and the revision increments.
4. Reopen after restarting the server. Confirm saved colors and IDs persist.
5. “Use ShapeForge to create a quantum banana observatory.” Confirm the response discloses the placeholder limitation instead of claiming accuracy.

No OpenAI API calls, API keys, external model provider, public deployment, or ChatGPT account setting changes are made by this package.
