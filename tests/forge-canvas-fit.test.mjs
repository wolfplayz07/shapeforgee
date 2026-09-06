import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("ForgeCanvas wires AABB fit + selection focus", async () => {
  const source = await readFile(`${root}/components/forge-canvas.tsx`, "utf8");
  assert.match(source, /computePartsAabb/);
  assert.match(source, /fitSelectionSignal/);
  assert.match(source, /view\.focus/);
  assert.match(source, /onDoubleClick=\{handleDoubleClick\}/);
  assert.match(source, /explosionOffset/);
});

test("page exposes Fit and Fit part controls", async () => {
  const source = await readFile(`${root}/app/page.tsx`, "utf8");
  assert.match(source, /fitSelectionSignal/);
  assert.match(source, /Fit part/);
  assert.match(source, /Assembly fitted to AABB/);
});
