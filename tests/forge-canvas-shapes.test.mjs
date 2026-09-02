import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildPartMesh, renderPrimitiveKind } from "../lib/render-shape.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const part = (name, size, options = {}) => ({
  id: `COMP-${name.replace(/\W/g, "").slice(0, 8)}`,
  name,
  kind: options.kind ?? "box",
  axis: options.axis ?? "x",
  category: options.category ?? "external",
  purpose: options.purpose ?? "visible component",
  position: options.position ?? [0, 0, 0],
  size,
  rotation: options.rotation ?? [0, 0, 0],
  explode: [0, 0, 0],
  related: [],
  color: "#708090",
  hidden: false,
  detached: false,
});

const benchmarks = [
  [part("Drill motor housing", [86, 46, 42]), "capsule"],
  [part("Cordless drill grip handle", [72, 31, 34]), "capsule"],
  [part("Dryer nozzle", [58, 34, 34]), "frustum"],
  [part("Pen point tip", [18, 8, 8]), "cone"],
  [part("Fan blade", [74, 21, 7]), "wedge"],
  [part("Bottle body", [28, 28, 82], { axis: "z" }), "cylinder"],
  [part("Dresser drawer front", [110, 28, 9]), "box"],
  [part("Dew collector panel", [150, 92, 6]), "box"],
  [part("Lamp stem", [18, 18, 115], { kind: "cylinder", axis: "z" }), "cylinder"],
  [part("Stapler upper housing", [118, 28, 24]), "capsule"],
];

test("ForgeCanvas source is wired to generalized part meshes", async () => {
  const source = await readFile(`${root}/components/forge-canvas.tsx`, "utf8");
  assert.match(source, /buildPartMesh\(part, center\)/);
  assert.doesNotMatch(source, /part\.kind === "cylinder" \? cylinderMesh/);
});

test("unrelated benchmark parts reach reusable primitive families", () => {
  const observed = new Set();
  for (const [candidate, expected] of benchmarks) {
    assert.equal(renderPrimitiveKind(candidate), expected, candidate.name);
    const mesh = buildPartMesh(candidate);
    assert.ok(mesh.points.length >= 8, `${candidate.name} should have renderable points`);
    assert.ok(mesh.faces.length >= 6, `${candidate.name} should have renderable faces`);
    assert.ok(mesh.points.every((point) => point.length === 3 && point.every(Number.isFinite)));
    observed.add(mesh.kind);
  }
  assert.deepEqual([...observed].sort(), ["box", "capsule", "cone", "cylinder", "frustum", "wedge"]);
});

test("rotation and translated exploded center are applied by the bridge", () => {
  const candidate = part("Support arm", [80, 18, 12], {
    rotation: [0, 0, 35],
    position: [12, -7, 5],
  });
  const centered = buildPartMesh(candidate, [42, 18, -11]);
  assert.equal(centered.kind, "wedge");
  const xs = centered.points.map((point) => point[0]);
  const ys = centered.points.map((point) => point[1]);
  assert.ok(Math.max(...xs) > 42 && Math.min(...xs) < 42);
  assert.ok(Math.max(...ys) > 18 && Math.min(...ys) < 18);
});
