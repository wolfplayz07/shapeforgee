# ShapeForge

ShapeForge is a mobile- and desktop-friendly procedural assembly editor. Enter a supported object prompt, inspect its components, and gradually separate the assembly with the exploded-view slider.

## Current application

[Open the hosted ShapeForge app](https://shapeforge-app.cosmic-gleam-7983.chatgpt.site)

This repository contains the recovered working application, including the Chevelle/Mustang vehicle-generator update.

### Features

- Prompt-driven procedural recipes for vehicles, the A-72 bowling machine, furniture, fans, bicycles, displays, and mechanical assemblies.
- Distinct Chevelle and Mustang proportions and component layouts.
- Rotatable assembly viewer with progressive exploded views, component selection, labels, and relationships.
- Component hierarchy and inspector, editable dimensions and colors, hide/detach controls, and undo/redo.
- JSON project save/load and import support for several earlier ShapeForge formats.
- Responsive controls for phones and computers.

This is a procedural prototype, not a general AI text-to-3D model or engineering-accurate CAD system. Unsupported prompts still use a generic concept assembly. Vehicle shapes are stylized; model-year labels do not guarantee year-accurate geometry.

## Run locally

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
