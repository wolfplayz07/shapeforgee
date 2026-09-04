# ShapeForge

ShapeForge is a mobile- and desktop-friendly procedural assembly editor. Enter a supported object prompt, inspect its components, and gradually separate the assembly with the exploded-view slider.

## Current application

[Open the hosted ShapeForge app](https://shapeforge-app.cosmic-gleam-7983.chatgpt.site)

This repository contains the recovered working application, including the Chevelle/Mustang vehicle-generator update.

### Features

- Prompt-driven procedural recipes for vehicles, the A-72 bowling machine, furniture, fans, bicycles, displays, and mechanical assemblies.
- Server-side Workers AI physical-object planning for general prompts, with validated structured JSON converted into ShapeForge primitives.
- Distinct Chevelle and Mustang proportions and component layouts.
- Rotatable assembly viewer with progressive exploded views, component selection, labels, and relationships.
- Component hierarchy and inspector, editable dimensions and colors, hide/detach controls, and undo/redo.
- JSON project save/load and import support for several earlier ShapeForge formats.
- Responsive controls for phones and computers.

This is a conceptual prototype, not engineering-accurate CAD. Workers AI plans recognizable physical structure for unknown prompts when the Cloudflare `AI` binding is available; otherwise ShapeForge falls back to deterministic semantic templates. Vehicle shapes are stylized; model-year labels do not guarantee year-accurate geometry.

## Workers AI geometry planning

The live hosted Worker uses Cloudflare Workers AI as the first general-purpose geometry planner. The browser never receives model credentials or account identifiers. The intended path is:

```text
Generate -> /api/forge -> createForgeProjectWithPlanner()
  -> high-confidence recovered recipe
  -> Workers AI GeometryPlan
  -> validateAndSanitizeGeometryPlan()
  -> geometryPlanToProject()
  -> Project.parts[]
  -> existing renderer/persistence
```

The default model is `@cf/meta/llama-3.1-8b-instruct-fast`. It was chosen as the first production default because Cloudflare documents JSON Mode support for this model, and it balances structured-output reliability with lower latency for the Generate button. You can override it with the Worker variable `SHAPEFORGE_AI_MODEL`.

This repository does not use a checked-in `wrangler.toml`; Cloudflare bindings are configured through `vite.config.ts` for the Cloudflare Vite plugin. The required binding is:

```ts
ai: {
  binding: "AI",
}
```

For deployment, make sure the Cloudflare Worker has Workers AI enabled and an AI binding named `AI`. No browser-side token, account ID, or API key is required.

The structured plan schema is implemented in `lib/geometry-plan.ts`. It includes requested object identity/subtype/scope, silhouette/form, proportions, orientation, dominant axis, symmetry, exclusions, recognition-critical parts, part roles, primitive suggestions, relative dimensions/positions/rotations, parent/related links, spatial relationships, mirrored/repeated parts, and planner notes.

Validation rejects or repairs unsafe model output before geometry is created: unsupported primitive kinds, invalid dimensions, non-finite numbers, invalid IDs, missing parents, self links, cycles, excessive part counts, and prompt exclusions. If Workers AI is unavailable, times out, returns malformed JSON, or fails validation, ShapeForge falls back to the existing semantic planner rather than crashing.

## Run locally

### Callable ShapeForge integration

The separate [MCP / ChatGPT integration](integration/README.md) adds saved-project tools and an interactive viewer for reuse across projects. It runs as a private local service with SQLite persistence; it is not automatically connected to ChatGPT by installing GitHub access. See its README for setup, tests, and hosting/authentication boundaries. The existing website is unchanged.

### Website

Use Node.js 22.13 or newer. The included helper scripts target Linux; on Windows, use WSL or a Linux development environment such as GitHub Codespaces.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite. If using Codespaces, open its forwarded development port.

```bash
npm run build
npm run start
```

`npm run lint` runs the linter. The existing `npm test` suite includes inherited starter checks and is not comprehensive ShapeForge interaction coverage.

After deploying with the `AI` binding, a manual live smoke test can be run against the hosted Worker:

```bash
curl -s https://<your-worker-host>/api/forge \
  -H 'content-type: application/json' \
  -d '{"prompt":"horseshoe","detail":"detailed","scale":1}'
```

The returned project should include `source: "workers-ai"` and `planner.source: "workers-ai"` when live model planning was used.

## Source map

- `app/page.tsx`: application controls, component tree, inspector, and project actions.
- `app/globals.css`: responsive interface styling.
- `components/forge-canvas.tsx`: assembly rendering, camera gestures, selection, and explosion.
- `lib/shapeforge.ts`: recipes, vehicle generation, project format, validation, and imports.
- `components/ui/`: included interface primitives.
- `package-lock.json`: locked dependencies.

## Hosting and preservation

The existing hosted application is unchanged by this GitHub import. Pushing here does not automatically redeploy that site; no automatic synchronization has been configured.

The export retains the source and build configuration but removes the original hosted project's identifier from `.openai/hosting.json`. No credentials, environment secrets, installed dependencies, build outputs, or temporary runtime files are included. Register/configure your own hosting target before deploying this copy.

The original starter documentation is preserved in [docs/SITES_STARTER.md](docs/SITES_STARTER.md). See [docs/PROJECT_HISTORY.md](docs/PROJECT_HISTORY.md) for the recovered source milestones and import details.
