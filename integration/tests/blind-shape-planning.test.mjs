import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AssemblyStore } from "../server/store.mjs";

const part = (id, name, kind, parent, category, purpose, position, size, rotation, explode, related, color, axis) => ({
  id, name, kind, ...(axis ? { axis } : {}), parent, category, purpose,
  position, size, rotation, explode, related, color, hidden: false, detached: false,
});

test("blind request can be decomposed into a recognizable passive dew collector without a saved recipe", t => {
  const store = new AssemblyStore(":memory:");
  t.after(() => store.close());

  // This assembly is intentionally supplied through save(), not create(), so the
  // test exercises the request-driven custom component path rather than a recipe.
  const parts = [
    part("COMP-000001", "Condenser Panel", "box", null, "collector surface", "Thin exposed aluminum surface that radiatively cools and condenses moisture.", [0, 0, 0], [200, 100, 2], [0, 0, -35], [0, 0, 0], ["COMP-000002", "COMP-000003", "COMP-000009", "COMP-000010", "COMP-000012"], "#d8dde1"),
    part("COMP-000002", "Rear Insulation", "box", "COMP-000001", "insulation", "Closed-cell insulation that reduces heat gain into the condenser from behind.", [0, 0, -7], [194, 96, 10], [0, 0, -35], [0, 0, -65], ["COMP-000001"], "#e4e0d2"),
    part("COMP-000003", "Bottom Gutter", "box", "COMP-000001", "water path", "Collects condensed droplets running down the tilted panel.", [0, -58, 8], [205, 12, 14], [0, 0, -35], [0, -85, 45], ["COMP-000001", "COMP-000004"], "#8a959d"),
    part("COMP-000004", "Gutter Outlet", "cylinder", "COMP-000003", "water path", "Small outlet that transfers collected water from the gutter into the drain tube.", [94, -65, 10], [14, 8, 8], [0, 0, -35], [65, -110, 58], ["COMP-000003", "COMP-000005"], "#7f8b93", "x"),
    part("COMP-000005", "Drain Tube", "cylinder", "COMP-000004", "water path", "Carries collected condensate from the gutter to the covered bottle.", [106, -88, -6], [52, 7, 7], [0, 0, -72], [110, -145, 35], ["COMP-000004", "COMP-000006"], "#6c8895", "x"),
    part("COMP-000006", "Collection Bottle", "cylinder", null, "storage", "Covered container that receives and stores the collected water.", [128, -121, -28], [52, 52, 82], [0, 0, 0], [140, -170, -25], ["COMP-000005", "COMP-000007"], "#6e9bb0", "y"),
    part("COMP-000007", "Bottle Neck", "cylinder", "COMP-000006", "storage", "Narrow bottle neck where the drain tube enters.", [128, -75, -28], [25, 25, 18], [0, 0, 0], [140, -120, -25], ["COMP-000006", "COMP-000008"], "#789fb2", "y"),
    part("COMP-000008", "Covered Cap", "cylinder", "COMP-000007", "cover", "Covers the bottle opening while allowing the drain tube to enter.", [128, -63, -28], [30, 30, 7], [0, 0, 0], [140, -100, -25], ["COMP-000007"], "#4f6671", "y"),
    part("COMP-000009", "Left Support Leg", "box", "COMP-000001", "support", "Holds the condenser at its operating tilt angle.", [-72, 18, -48], [12, 105, 12], [0, 0, -35], [-105, 45, -80], ["COMP-000001", "COMP-000011"], "#59636b"),
    part("COMP-000010", "Right Support Leg", "box", "COMP-000001", "support", "Holds the condenser at its operating tilt angle.", [72, 18, -48], [12, 105, 12], [0, 0, -35], [105, 45, -80], ["COMP-000001", "COMP-000011"], "#59636b"),
    part("COMP-000011", "Rear Cross Brace", "box", null, "support", "Keeps the two support legs aligned and stabilizes the panel.", [0, 38, -82], [155, 10, 10], [0, 0, 0], [0, 80, -125], ["COMP-000009", "COMP-000010"], "#4d565d"),
    part("COMP-000012", "Panel Temperature Sensor", "box", "COMP-000001", "instrumentation", "Small sensor body mounted to the condenser for panel-temperature measurement.", [-60, -18, 5], [18, 12, 5], [0, 0, -35], [-95, -35, 65], ["COMP-000001", "COMP-000013"], "#3f86b0"),
    part("COMP-000013", "Sensor Probe", "cylinder", "COMP-000012", "instrumentation", "Small contact probe that measures the condenser surface temperature.", [-60, -18, 1], [6, 4, 4], [0, 0, -35], [-95, -35, 35], ["COMP-000012"], "#aeb7bd", "z"),
    part("COMP-000014", "Tube Retaining Clip", "box", "COMP-000005", "hardware", "Tiny clip that keeps the drain tube routed against the support structure.", [100, -82, -18], [9, 6, 4], [0, 0, -35], [120, -105, 5], ["COMP-000005", "COMP-000010"], "#9da7ad"),
  ];

  const result = store.save({
    request_id: randomUUID(),
    name: "Passive Dew Collector",
    description: "A passive dew collector with a thin tilted aluminum condenser panel, rear insulation, bottom gutter and tube feeding a covered collection bottle, support frame, and panel temperature sensor.",
    parts,
  });

  assert.equal(result.project.source, "imported");
  assert.equal(result.project.parts.length, 14);
  assert.deepEqual(result.project.parts, parts);

  const names = new Set(result.project.parts.map(item => item.name));
  for (const expected of ["Condenser Panel", "Rear Insulation", "Bottom Gutter", "Drain Tube", "Collection Bottle", "Left Support Leg", "Right Support Leg", "Panel Temperature Sensor", "Tube Retaining Clip"]) {
    assert.ok(names.has(expected), `missing ${expected}`);
  }

  const panel = result.project.parts.find(item => item.name === "Condenser Panel");
  const tube = result.project.parts.find(item => item.name === "Drain Tube");
  const clip = result.project.parts.find(item => item.name === "Tube Retaining Clip");
  assert.ok(panel.size[0] / panel.size[1] >= 2, "panel should preserve the wide thin collector silhouette");
  assert.ok(panel.size[2] <= 3, "condenser must remain a thin sheet");
  assert.equal(tube.kind, "cylinder", "drain tube should use round geometry");
  assert.ok(Math.max(...clip.size) <= 9, "small hardware should remain small relative to the panel");
});
