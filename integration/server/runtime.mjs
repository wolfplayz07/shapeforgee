import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AssemblyStore } from "./store.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function widgetHtml() {
  try { return readFileSync(resolve(root, "dist/widget.html"), "utf8"); }
  catch { throw new Error("Viewer bundle missing. Run npm run build in integration first."); }
}
export function openStore() {
  return new AssemblyStore(resolve(process.env.SHAPEFORGE_DATA_DIR || resolve(root, ".data"), "assemblies.sqlite"));
}
