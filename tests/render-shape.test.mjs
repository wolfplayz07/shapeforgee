import test from "node:test";
import assert from "node:assert/strict";

import { buildPartMesh, renderPrimitiveAxis, renderPrimitiveKind } from "../lib/render-shape.mjs";

const part = (name, category, purpose, size, kind = "box", axis = "x", rotation = [0, 0, 0]) => ({
  name,
  category,
  purpose,
  size,
  kind,
  axis,
  rotation,
  position: [0, 0, 0],
});

test("renderer bridge selects generalized higher fidelity primitives across unrelated objects", () => {
  const cases = [
    [part("Main Body Housing", "housing", "drill body shell", [105, 52, 48]), "capsule"],
    [part("Angled Handle", "grip", "ergonomic handle", [36, 88, 40], "box", "y"), "capsule"],
    [part("Output Nozzle", "output", "dryer nozzle", [62, 26, 26]), "frustum"],
    [part("Ballpoint Tip", "output", "pen point", [22, 8, 8]), "cone"],
    [part("Pen Barrel", "housing", "ink tube barrel", [110, 13, 13]), "cylinder"],
    [part("Fan Blade", "rotor", "air-moving blade", [70, 22, 5]), "wedge"],
    [part("Bottle Body", "container", "reusable bottle", [74, 150, 74], "cylinder", "y"), "cylinder"],
    [part("Drawer Front", "panel", "dresser drawer panel", [95, 20, 8]), "box"],
    [part("Collector Panel", "surface", "dew collection panel", [205, 8, 112]), "box"],
    [part("Lamp Stem", "support", "upright rod", [14, 120, 14], "cylinder", "y"), "cylinder"],
    [part("Stapler Upper Arm", "mechanism", "hinged upper arm", [142, 24, 42]), "box"],
  ];

  for (const [candidate, expected] of cases) {
    assert.equal(renderPrimitiveKind(candidate), expected, candidate.name);
  }
});

test("proportion checks prevent over-rounding slab-like housings", () => {
  assert.equal(
    renderPrimitiveKind(part("Control Housing", "housing", "wide flat equipment body", [140, 72, 12])),
    "box",
  );
  assert.equal(
    renderPrimitiveKind(part("Ergonomic Handle", "grip", "hand grip", [34, 92, 31], "box", "y")),
    "capsule",
  );
});

test("inferred rounded and tapered primitives align with their dominant dimension", () => {
  const verticalHandle = part("Grip Handle", "grip", "ergonomic grip", [32, 96, 36], "box", "x");
  const verticalNozzle = part("Output Nozzle", "output", "tapered nozzle", [24, 70, 24], "box", "x");
  const authoredShaft = part("Motor Shaft", "drive", "shaft", [12, 90, 12], "cylinder", "x");

  assert.equal(renderPrimitiveAxis(verticalHandle), "y");
  assert.equal(renderPrimitiveAxis(verticalNozzle), "y");
  assert.equal(renderPrimitiveAxis(authoredShaft), "x");
  assert.equal(buildPartMesh(verticalHandle).axis, "y");
});

test("renderer bridge emits valid transformed meshes for every primitive family", () => {
  const candidates = [
    part("Desk Surface", "surface", "flat top", [150, 10, 80]),
    part("Motor Shaft", "drive", "shaft", [80, 14, 14], "cylinder", "x"),
    part("Tool Housing", "housing", "body shell", [110, 48, 42], "box", "x", [0, 0, -7]),
    part("Sprayer Nozzle", "output", "tapered nozzle", [60, 28, 28]),
    part("Needle Tip", "output", "point", [35, 8, 8]),
    part("Support Fin", "support", "support arm", [75, 20, 6]),
  ];

  const kinds = new Set();
  for (const candidate of candidates) {
    const mesh = buildPartMesh(candidate, [10, -5, 3]);
    kinds.add(mesh.kind);
    assert.ok(mesh.points.length >= 8, candidate.name);
    assert.ok(mesh.faces.length >= 6, candidate.name);
    for (const point of mesh.points) {
      assert.equal(point.length, 3);
      assert.ok(point.every(Number.isFinite), candidate.name);
    }
    for (const face of mesh.faces) {
      assert.ok(face.indices.length >= 3, candidate.name);
      assert.ok(face.indices.every((index) => index >= 0 && index < mesh.points.length), candidate.name);
    }
  }

  assert.deepEqual([...kinds].sort(), ["box", "capsule", "cone", "cylinder", "frustum", "wedge"].sort());
});

test("renderer bridge preserves legacy and explicit higher-fidelity fallback semantics", () => {
  assert.equal(renderPrimitiveKind(part("Unknown Bracket", "misc", "generic part", [20, 20, 20], "box")), "box");
  assert.equal(renderPrimitiveKind(part("Unknown Round Part", "misc", "generic part", [20, 20, 20], "cylinder")), "cylinder");
  assert.equal(renderPrimitiveKind(part("Unknown Refined Part", "misc", "generic part", [40, 20, 20], "capsule")), "capsule");
});
