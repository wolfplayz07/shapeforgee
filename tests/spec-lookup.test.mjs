import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
const table = await vite.ssrLoadModule("/lib/spec-table.ts");
const lookup = await vite.ssrLoadModule("/lib/spec-lookup.ts");
const planner = await vite.ssrLoadModule("/worker/geometry-planner.ts");
const { SPEC_TABLE, SPEC_SOURCES, SERVICE_DATA_DEFAULT, findSpecEntry } = table;
const { lookupSpec, parseVehiclePrompt, proportionFactors } = lookup;
const { createForgeProjectWithPlanner } = planner;

after(async () => {
  await vite.close();
});

const quiet = () => {};
const noAi = { run: async () => { throw new Error("AI must not be called"); } };
const vpicBody = (cm) => ({
  Results: [{ Specs: [
    { Name: "Make", Value: "FORD" }, { Name: "Model", Value: "MUSTANG GT" },
    { Name: "OL", Value: String(cm.ol) }, { Name: "OW", Value: String(cm.ow) },
    { Name: "OH", Value: String(cm.oh) }, { Name: "WB", Value: String(cm.wb) },
  ] }],
});

test("every spec table value carries a known source, license and confidence", () => {
  const confidences = new Set(["spec", "measured", "typical", "estimated", "unknown"]);
  for (const source of Object.values(SPEC_SOURCES)) {
    assert.ok(source.license && source.license.length > 2, source.id);
  }
  for (const entry of SPEC_TABLE) {
    const values = [entry.parts, ...(entry.extentMm ? [entry.extentMm.x, entry.extentMm.y, entry.extentMm.z] : [])];
    for (const value of values) {
      assert.ok(SPEC_SOURCES[value.source], `${entry.id}: unknown source ${value.source}`);
      assert.ok(confidences.has(value.confidence), `${entry.id}: bad confidence`);
    }
    for (const attachment of entry.attachments ?? []) assert.ok(SPEC_SOURCES[attachment.source], entry.id);
  }
});

test("spec table matching: components hit, look-alikes are excluded", () => {
  assert.equal(findSpecEntry("car brake caliper")?.id, "brake-caliper");
  assert.equal(findSpecEntry("water pump")?.id, "fluid-pump");
  assert.equal(findSpecEntry("desk lamp")?.id, "desk-lamp");
  assert.equal(findSpecEntry("office chair")?.id, "office-chair");
  assert.equal(findSpecEntry("cordless drill")?.id, "cordless-drill");
  assert.equal(findSpecEntry("bike brake caliper")?.id ?? null, null);
  assert.equal(findSpecEntry("digital vernier caliper")?.id ?? null, null);
  assert.equal(findSpecEntry("telescope"), null);
});

test("car brake caliper builds the sourced caliper layout without calling Workers AI", async () => {
  const project = await createForgeProjectWithPlanner("car brake caliper", { AI: noAi }, { detail: "detailed", logger: quiet });
  assert.equal(project.planner.source, "spec-table");
  const names = project.parts.map((part) => part.name);
  for (const name of ["Caliper Body", "Piston", "Inner Brake Pad", "Outer Brake Pad", "Mounting Bracket", "Bleeder Screw"]) {
    assert.ok(names.includes(name), name);
  }
  assert.ok(!names.includes("Body Shell"));
  const spec = project.planner.spec;
  assert.equal(spec.matched, "brake-caliper");
  assert.equal(spec.torque, SERVICE_DATA_DEFAULT);
  assert.equal(spec.procedures, SERVICE_DATA_DEFAULT);
  assert.deepEqual(spec.partCoverage.missing, []);
  assert.ok(spec.attachments.some((attachment) => attachment.linked));
  assert.ok(spec.sources.every((source) => source.license));
});

test("hand-tuned recipes are annotated, not distorted", async () => {
  const base = await createForgeProjectWithPlanner("office chair", {}, { detail: "detailed", logger: quiet });
  assert.equal(base.planner.source, "recovered-recipe");
  assert.equal(base.planner.spec.matched, "office-chair");
  assert.ok(!base.planner.spec.applied.some((line) => line.startsWith("proportions x")));
  const drill = await createForgeProjectWithPlanner("cordless drill", {}, { detail: "detailed", logger: quiet });
  assert.ok(drill.planner.spec.applied.some((line) => line.includes("hand-tuned recipe kept")));
});

test("generated fallback geometry is nudged toward sourced proportions within clamps", async () => {
  const project = await createForgeProjectWithPlanner("water pump", {}, { detail: "detailed", logger: quiet });
  assert.equal(project.planner.spec.matched, "fluid-pump");
  assert.ok(project.parts.some((part) => /impeller/i.test(part.name)));
  const factors = proportionFactors([100, 300, 100], [100, 100, 100]);
  for (const factor of factors) assert.ok(factor >= 0.7 && factor <= 1.45);
});

test("no trusted spec falls back to recipes and records it", async () => {
  const project = await createForgeProjectWithPlanner("telescope", {}, { detail: "detailed", logger: quiet });
  const spec = project.planner.spec;
  assert.equal(spec.matched, null);
  assert.ok(spec.applied.includes("no trusted spec found; recipe/shape rules used as-is"));
  assert.equal(spec.torque, SERVICE_DATA_DEFAULT);
  assert.deepEqual(spec.lookups.map((entry) => `${entry.source}:${entry.status}`), ["spec-table:miss", "nhtsa-vpic:skipped", "web-reference:skipped"]);
});

test("vPIC: year/make/model prompts only, cm converted to mm, cached", async () => {
  assert.deepEqual(parseVehiclePrompt("2015 Ford Mustang"), { year: 2015, make: "ford", model: "mustang" });
  assert.equal(parseVehiclePrompt("2015 ford mustang brake caliper"), null);
  assert.equal(parseVehiclePrompt("ford mustang"), null);
  let calls = 0;
  const fetch = async (url) => {
    calls += 1;
    assert.match(url, /GetCanadianVehicleSpecifications/);
    return { ok: true, json: async () => vpicBody({ ol: 478, ow: 192, oh: 139, wb: 272 }) };
  };
  const first = await lookupSpec("2016 ford mustang", { fetch });
  assert.equal(first.spec.vehicle.lengthMm, 4780);
  assert.equal(first.spec.vehicle.wheelbaseMm, 2720);
  assert.equal(first.spec.vehicle.source, "nhtsa-vpic");
  assert.ok(first.spec.sources.some((source) => source.id === "nhtsa-vpic"));
  await lookupSpec("2016 ford mustang", { fetch });
  assert.equal(calls, 1);

  const project = await createForgeProjectWithPlanner("2016 ford mustang", {}, { detail: "detailed", logger: quiet, specFetch: fetch });
  assert.equal(project.source, "procedural-vehicle");
  assert.equal(project.planner.spec.vehicle.heightMm, 1390);
});

test("vPIC timeouts and errors never block generation", async () => {
  const hang = () => new Promise(() => {});
  const started = Date.now();
  const slow = await lookupSpec("2011 honda civic", { fetch: hang, vehicleTimeoutMs: 50 });
  assert.ok(Date.now() - started < 1000);
  assert.equal(slow.spec.lookups.find((entry) => entry.source === "nhtsa-vpic").status, "timeout");
  const broken = await lookupSpec("2012 honda accord", { fetch: async () => { throw new Error("offline"); } });
  assert.equal(broken.spec.lookups.find((entry) => entry.source === "nhtsa-vpic").status, "error");
  const off = await createForgeProjectWithPlanner("2013 honda fit", { SHAPEFORGE_SPEC_VEHICLE_LOOKUP: "off" }, { detail: "detailed", logger: quiet, specFetch: hang });
  assert.equal(off.planner.spec.lookups.find((entry) => entry.source === "nhtsa-vpic").status, "skipped");
});
