import test from "node:test";
import assert from "node:assert/strict";
import { inferPrimitiveKind, fidelityProfile } from "../../lib/shape-fidelity.mjs";

const part = (name, category, purpose, size, kind = "box") => ({ name, category, purpose, size, kind });

test("handheld forms gain rounded and tapered primitives without naming a drill recipe", () => {
  assert.equal(inferPrimitiveKind(part("Main Housing", "body", "Protective tool shell", [120, 56, 48])), "capsule");
  assert.equal(inferPrimitiveKind(part("Front Nozzle", "working end", "Directs flow", [64, 40, 40])), "frustum");
  assert.equal(inferPrimitiveKind(part("Driver Bit", "working end", "Engages fastener", [52, 8, 8])), "cone");
});

test("unrelated everyday parts map by form semantics", () => {
  assert.equal(inferPrimitiveKind(part("Pen Body", "body", "Main writing barrel", [140, 12, 12])), "capsule");
  assert.equal(inferPrimitiveKind(part("Fan Blade", "motion", "Moves air", [76, 18, 7])), "wedge");
  assert.equal(inferPrimitiveKind(part("Lamp Stem", "support", "Vertical rod", [12, 110, 12])), "cylinder");
  assert.equal(inferPrimitiveKind(part("Drawer Front", "surface", "Closes drawer", [100, 24, 8])), "box");
  assert.equal(inferPrimitiveKind(part("Bottle Body", "container", "Holds liquid", [52, 120, 52])), "cylinder");
});

test("fidelity profile shows mixed primitive vocabulary across a heterogeneous benchmark", () => {
  const project = {
    parts: [
      part("Tool Housing", "body", "Main shell", [120, 58, 48]),
      part("Nozzle", "working end", "Outlet", [55, 35, 35]),
      part("Fan Blade", "motion", "Moves air", [80, 20, 7]),
      part("Pen Tip", "working end", "Point", [24, 8, 8]),
      part("Desk Surface", "surface", "Flat top", [160, 80, 10]),
      part("Motor Shaft", "motion", "Transfers rotation", [12, 70, 12]),
    ],
  };
  const profile = fidelityProfile(project);
  assert.equal(profile.capsule, 1);
  assert.equal(profile.frustum, 1);
  assert.equal(profile.wedge, 1);
  assert.equal(profile.cone, 1);
  assert.equal(profile.box, 1);
  assert.equal(profile.cylinder, 1);
});

test("unknown components preserve safe box/cylinder fallback", () => {
  assert.equal(inferPrimitiveKind(part("Mystery Component", "component", "Unknown", [30, 30, 30], "box")), "box");
  assert.equal(inferPrimitiveKind(part("Mystery Round Component", "component", "Unknown", [30, 30, 30], "cylinder")), "cylinder");
});
