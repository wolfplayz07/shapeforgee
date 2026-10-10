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
const shapeforge = await vite.ssrLoadModule("/lib/shapeforge.ts");
const planner = await vite.ssrLoadModule("/worker/geometry-planner.ts");
const { createForgeProject, isVehicleComponentPrompt, validateForgeProject } = shapeforge;
const { createForgeProjectWithPlanner, PLANNER_MAX_TOKENS, buildPlannerMessages } = planner;

after(async () => {
  await vite.close();
});

const names = (project) => project.parts.map((part) => part.name);
const quiet = () => {};

test("vehicle sub-component prompts no longer expand into the whole car", () => {
  for (const prompt of ["car brake caliper", "Mustang alternator", "car water pump", "1970 chevelle engine", "sedan brake rotor"]) {
    assert.equal(isVehicleComponentPrompt(prompt), true, prompt);
    const project = createForgeProject(prompt, { detail: "detailed" });
    assert.notEqual(project.source, "procedural-vehicle", prompt);
    assert.ok(!names(project).includes("Body Shell"), `${prompt} should not render a body shell`);
  }
  for (const prompt of ["car", "1970 chevelle", "red sports car with open doors", "mustang"]) {
    assert.equal(createForgeProject(prompt, { detail: "detailed" }).source, "procedural-vehicle", prompt);
  }
});

test("water / fuel / drain pumps build a rotary fluid pump, bike pumps stay bike pumps", () => {
  const water = createForgeProject("water pump", { detail: "detailed" });
  assert.ok(names(water).includes("Pump Housing (Volute)"));
  assert.ok(names(water).includes("Impeller"));
  assert.ok(names(water).includes("Drive Pulley Hub"), "engine water pump has a belt pulley");
  assert.ok(!names(water).some((name) => /T-Handle|Valve Chuck|Air Hose|Pressure Gauge/.test(name)));
  assert.deepEqual(validateForgeProject(water).filter((check) => !check.ok), []);

  const fuel = createForgeProject("electric fuel pump", { detail: "detailed" });
  assert.ok(names(fuel).includes("Impeller"));

  const bike = createForgeProject("bicycle pump", { detail: "detailed" });
  assert.ok(names(bike).includes("T-Handle Grip"));
});

function sixPartPlan() {
  const part = (id, name, primitive, size, position) => ({
    id, name, role: "structure", primitive, axis: "x", purpose: `${name} body`,
    relativeSize: size, relativePosition: position, rotation: [0, 0, 0], parentId: null,
    relatedIds: [], spatialRelationships: ["attached to tube"],
  });
  return {
    schemaVersion: 1,
    requestedObject: { identity: "Telescope", scope: "complete_object" },
    silhouette: { form: "long tube on tripod", proportions: { width: 1.4, height: 1.1, depth: 0.5 }, orientation: "upright", dominantAxis: "x", symmetry: "none" },
    exclusions: [],
    recognitionCriticalParts: ["optical tube", "tripod"],
    parts: [
      part("opticalTube", "Optical Tube", "cylinder", [0.9, 0.18, 0.18], [0, 0.35, 0]),
      part("eyepiece", "Eyepiece", "cylinder", [0.12, 0.08, 0.08], [-0.5, 0.42, 0]),
      part("finderScope", "Finder Scope", "cylinder", [0.3, 0.06, 0.06], [0.05, 0.5, 0]),
      part("mountHead", "Mount Head", "box", [0.16, 0.12, 0.16], [0, 0.18, 0]),
      part("tripodLegFront", "Tripod Leg Front", "cylinder", [0.06, 0.7, 0.06], [0.2, -0.3, 0.2]),
      part("tripodLegRear", "Tripod Leg Rear", "cylinder", [0.06, 0.7, 0.06], [-0.2, -0.3, -0.2]),
    ],
    relationships: [{ from: "eyepiece", to: "opticalTube", type: "attached" }],
    plannerNotes: "tube on tripod",
  };
}

test("a planner reply cut off by max_tokens is salvaged instead of collapsing to the generic template", async () => {
  const full = JSON.stringify(sixPartPlan());
  const cut = full.slice(0, full.indexOf('"tripodLegRear"') + 25); // dies inside the 6th part
  const calls = [];
  const ai = { run: async (model, input) => { calls.push(input); return { response: cut }; } };
  const project = await createForgeProjectWithPlanner("telescope", { AI: ai }, { detail: "detailed", logger: quiet });
  assert.equal(project.planner.source, "workers-ai");
  assert.ok(project.planner.warnings.some((warning) => /Recovered truncated planner JSON/.test(warning)));
  assert.ok(names(project).includes("Optical Tube"));
  assert.ok(!names(project).some((name) => /Primary Structure|Working Core/.test(name)));
  assert.equal(calls[0].max_tokens, PLANNER_MAX_TOKENS);
});

test("planner asks for a terse, bounded plan", () => {
  const system = buildPlannerMessages("telescope")[0].content;
  assert.match(system, /Keep 5 to 12 parts/);
  assert.match(system, /at most 8 words/);
  assert.ok(PLANNER_MAX_TOKENS > 2400 && PLANNER_MAX_TOKENS <= 4096);
});
