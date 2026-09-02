import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: [resolve(root, "web/widget.jsx")],
  bundle: true,
  write: false,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    react: dirname(require.resolve("react/package.json")),
    "react-dom": dirname(require.resolve("react-dom/package.json")),
  },
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = await readFile(resolve(root, "web/widget.css"), "utf8");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ShapeForge assembly viewer</title><style>${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/widget.html"), html);
console.log(`Built self-contained ShapeForge viewer (${Buffer.byteLength(html)} bytes).`);
