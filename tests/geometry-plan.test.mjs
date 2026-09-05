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

const geometry = await vite.ssrLoadModule("/lib/geometry-plan.ts");
const planner = await vite.ssrLoadModule("/worker/geometry-planner.ts");
const shapeforge = await vite.ssrLoadModule("/lib/shapeforge.ts");
const { geometryPlanToProject, validateAndSanitizeGeometryPlan } = geometry;
const { createForgeProjectWithPlanner } = planner;
const { validateForgeProject } = shapeforge;

after(async () => {
  await vite.close();
});

function part(id, name, role, primitive, relativeSize, relativePosition, extra = {}) {
  return {
    id,
    name,
    role,
    primitive,
    axis: primitive === "cylinder" ? "x" : undefined,
    purpose: `${name} performs its physical role in the requested object.`,
    relativeSize,
    relativePosition,
    rotation: [0, 0, 0],
    relatedIds: [],
    spatialRelationships: ["attached-to neighboring components"],
    ...extra,
  };
}

function basePlan(prompt, overrides = {}) {
  return {
    schemaVersion: 1,
    requestedObject: { identity: prompt, scope: "complete_object" },
    silhouette: {
      form: "object-specific composite",
      proportions: { width: 1.6, height: 0.7, depth: 0.45 },
      orientation: "operational",
      dominantAxis: "x",
      symmetry: "none",
    },
    exclusions: [],
    recognitionCriticalParts: [],
    parts: [
      part("body", "Primary Body", "structure", "box", [0.75, 0.45, 0.45], [0, 0, 0], { relatedIds: ["working"] }),
      part("working", "Working Interface", "output", "cylinder", [0.25, 0.22, 0.22], [0.55, 0, 0], { parentId: "body" }),
      part("support", "Support Feature", "support", "box", [0.35, 0.18, 0.24], [-0.45, -0.35, 0], { parentId: "body" }),
    ],
    relationships: [{ from: "body", to: "working", type: "connected-to" }],
    plannerNotes: "test plan",
    ...overrides,
  };
}

function planFor(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("eyeglasses")) {
    return basePlan("Eyeglasses", {
      requestedObject: { identity: "Eyeglasses", scope: "wearable" },
      silhouette: { form: "wide thin bilateral frame", proportions: { width: 2.8, height: 0.55, depth: 0.28 }, orientation: "front-facing wearable", dominantAxis: "x", symmetry: "bilateral" },
      recognitionCriticalParts: ["left lens", "right lens", "bridge", "temple arms"],
      parts: [
        part("leftLens", "Left Lens", "optical", "cylinder", [0.24, 0.62, 0.08], [-0.3, 0, 0]),
        part("rightLens", "Right Lens", "optical", "cylinder", [0.24, 0.62, 0.08], [0.3, 0, 0], { mirroredFrom: "leftLens" }),
        part("bridge", "Nose Bridge", "support", "box", [0.16, 0.12, 0.12], [0, 0, 0], { relatedIds: ["leftLens", "rightLens"] }),
        part("leftTemple", "Left Temple Arm", "support", "box", [0.42, 0.08, 0.08], [-0.62, 0, -0.55]),
        part("rightTemple", "Right Temple Arm", "support", "box", [0.42, 0.08, 0.08], [0.62, 0, -0.55], { mirroredFrom: "leftTemple" }),
      ],
    });
  }
  if (lower.includes("wrench")) {
    return basePlan("Wrench", {
      requestedObject: { identity: "Wrench", scope: "tool" },
      silhouette: { form: "long thin hand tool with working ends", proportions: { width: 2.4, height: 0.22, depth: 0.18 }, orientation: "lying along handle axis", dominantAxis: "x", symmetry: "bilateral" },
      parts: [
        part("handle", "Slim Handle", "grip", "box", [0.72, 0.45, 0.55], [0, 0, 0]),
        part("jaw", "Open Jaw Head", "output", "cylinder", [0.2, 1.5, 0.7], [0.52, 0, 0], { parentId: "handle" }),
        part("ring", "Box End Ring", "output", "cylinder", [0.18, 1.35, 0.55], [-0.52, 0, 0], { parentId: "handle" }),
      ],
    });
  }
  if (lower.includes("transmission") || lower.includes("derailleur") || lower.includes("drain pump")) {
    const identity = lower.includes("transmission") ? "Transmission" : prompt.replace(/\b\w/g, (letter) => letter.toUpperCase());
    return basePlan(lower.includes("transmission") ? "Transmission" : prompt, {
      requestedObject: { identity, scope: "subsystem" },
      silhouette: { form: "compact mechanical subsystem", proportions: { width: 1.3, height: 0.7, depth: 0.75 }, orientation: "shaft axis horizontal", dominantAxis: "x", symmetry: "none" },
      parts: [
        part("case", `${identity} Housing`, "housing", "box", [0.7, 0.7, 0.7], [0, 0, 0]),
        part("input", `${identity} Input Interface`, "motion", "cylinder", [0.35, 0.16, 0.16], [-0.58, 0, 0], { parentId: "case" }),
        part("output", `${identity} Output Interface`, "motion", "cylinder", [0.38, 0.16, 0.16], [0.58, 0, 0], { parentId: "case" }),
        part("gear", `${identity} Internal Mechanism`, "motion", "cylinder", [0.32, 0.55, 0.4], [0, 0.05, 0], { parentId: "case" }),
      ],
    });
  }
  if (lower.includes("corded drill")) {
    return basePlan("Corded Drill", {
      requestedObject: { identity: "Corded Drill", scope: "tool" },
      silhouette: { form: "pistol grip electric drill with trailing cord", proportions: { width: 1.8, height: 1.1, depth: 0.55 }, orientation: "bit points forward", dominantAxis: "x", symmetry: "none" },
      exclusions: ["battery pack"],
      parts: [
        part("housing", "Motor Housing", "housing", "box", [0.52, 0.42, 0.5], [0, 0.2, 0]),
        part("chuck", "Chuck", "output", "cylinder", [0.18, 0.25, 0.25], [0.48, 0.2, 0], { parentId: "housing" }),
        part("handle", "Grip Handle", "grip", "box", [0.2, 0.58, 0.35], [-0.18, -0.32, 0], { parentId: "housing" }),
        part("cord", "Power Cord", "electrical", "cylinder", [0.48, 0.05, 0.05], [-0.62, -0.58, 0], { parentId: "handle" }),
        part("plug", "Plug", "electrical", "box", [0.13, 0.12, 0.1], [-0.88, -0.7, 0], { parentId: "cord" }),
      ],
    });
  }
  if (lower.includes("espresso") || lower.includes("coffee")) {
    return basePlan("Espresso Machine", {
      requestedObject: { identity: "Espresso Machine", subtype: "fancy", scope: "appliance" },
      exclusions: ["glass carafe", "warming plate"],
      parts: [
        part("body", "Sculpted Body", "housing", "box", [0.56, 0.75, 0.65], [0, 0.1, 0]),
        part("group", "Portafilter Group Head", "output", "cylinder", [0.26, 0.16, 0.16], [0, -0.18, 0.48], { parentId: "body" }),
        part("wand", "Steam Wand", "fluid", "cylinder", [0.04, 0.42, 0.04], [0.42, -0.18, 0.42], { parentId: "body" }),
        part("tank", "Water Reservoir", "fluid", "box", [0.35, 0.58, 0.25], [-0.36, 0.1, -0.22], { parentId: "body" }),
      ],
    });
  }
  if (lower.includes("lamp") || lower.includes("telescope") || lower.includes("horseshoe") || lower.includes("hair dryer") || lower.includes("stapler")) {
    const title = prompt.replace(/\b\w/g, (letter) => letter.toUpperCase());
    return basePlan(prompt, {
      requestedObject: { identity: prompt, scope: lower.includes("lamp") ? "fixture" : lower.includes("hair dryer") ? "appliance" : "complete_object" },
      silhouette: { form: lower.includes("horseshoe") ? "open curved U-shaped loop" : "prompt-specific recognizable object", proportions: lower.includes("telescope") ? { width: 2.2, height: 0.5, depth: 0.5 } : { width: 1.3, height: 1.4, depth: 0.55 }, orientation: "operational", dominantAxis: lower.includes("telescope") ? "x" : "y", symmetry: lower.includes("horseshoe") ? "bilateral" : "none" },
      parts: [
        part("main", lower.includes("lamp") ? "Lamp Shade" : `${title} Main Form`, "housing", lower.includes("horseshoe") ? "cylinder" : "box", [0.55, 0.45, 0.45], [0, 0.25, 0]),
        part("support", lower.includes("lamp") ? "Adjustable Stem" : `${title} Support`, "support", "box", [0.16, 0.75, 0.16], [0, -0.2, 0], { parentId: "main" }),
        part("base", lower.includes("lamp") ? "Weighted Base" : `${title} Functional End`, "output", "cylinder", [0.42, 0.16, 0.42], [0, -0.72, 0], { parentId: "support" }),
      ],
    });
  }
  return basePlan(prompt);
}

function mockAI() {
  return {
    calls: [],
    async run(model, input) {
      this.calls.push({ model, input });
      const prompt = JSON.parse(input.messages[1].content).prompt;
      return { response: JSON.stringify(planFor(prompt)) };
    },
  };
}

function assertValid(project) {
  assert.deepEqual(validateForgeProject(project).filter((check) => !check.ok), []);
}

function names(project) {
  return project.parts.map((part) => part.name);
}

function extents(project) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const part of project.parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], part.position[axis] - part.size[axis] / 2);
      max[axis] = Math.max(max[axis], part.position[axis] + part.size[axis] / 2);
    }
  }
  return max.map((value, axis) => value - min[axis]);
}

test("validates, repairs, and converts structured GeometryPlan data", () => {
  const raw = basePlan("Corded Drill", {
    exclusions: ["battery pack"],
    parts: [
      part("body", "Body", "housing", "box", [0.6, 0.4, 0.4], [0, 0, 0]),
      part("battery", "Battery Pack", "power", "box", [0.3, 0.2, 0.3], [0, -0.5, 0]),
      part("cord", "Power Cord", "electrical", "cylinder", [0.5, 0.04, 0.04], [-0.6, -0.4, 0], { parentId: "body" }),
      part("plug", "Plug", "electrical", "box", [0.12, 0.12, 0.12], [-0.9, -0.5, 0], { parentId: "cord", relatedIds: ["missing", "plug"] }),
    ],
  });
  const result = validateAndSanitizeGeometryPlan(raw, "corded drill without a battery pack");
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((warning) => /excluded part/i.test(warning)));
  assert.ok(!result.plan.parts.some((item) => /battery/i.test(item.name)));

  const project = geometryPlanToProject(result.plan, "corded drill without a battery pack", {
    plannerSource: { source: "workers-ai", model: "mock" },
  });
  assert.equal(project.source, "workers-ai");
  assert.equal(project.planner.source, "workers-ai");
  assertValid(project);
});


test("accepts Workers AI object/string Vec3 layouts and maps them to distinct project positions", () => {
  const raw = {
    schemaVersion: 1,
    requestedObject: { identity: "Washing Machine", scope: "appliance" },
    silhouette: {
      form: "upright boxy appliance",
      proportions: { width: "1.1", height: "1.4", depth: "1.0" },
      orientation: "upright",
      dominantAxis: "y",
      symmetry: "bilateral",
    },
    exclusions: [],
    recognitionCriticalParts: ["drum", "door"],
    parts: [
      {
        id: "cabinet",
        name: "Cabinet",
        role: "housing",
        primitive: "box",
        purpose: "Outer cabinet",
        relativeSize: { width: "0.9", height: "0.95", depth: "0.85" },
        relativePosition: { x: 0, y: 0, z: 0 },
        rotation: [0, 0, 0],
      },
      {
        id: "drum",
        name: "Rotating Drum",
        role: "motion",
        primitive: "cylinder",
        axis: "z",
        purpose: "Holds laundry",
        relative_size: ["0.55", "0.55", "0.5"],
        relative_position: { x: "0", y: "-0.05", z: "0.05" },
        rotation: { x: 0, y: 0, z: 0 },
        parentId: "cabinet",
      },
      {
        id: "door",
        name: "Door",
        role: "surface",
        primitive: "cylinder",
        axis: "z",
        purpose: "Front loading door",
        size: { x: 0.5, y: 0.5, z: 0.08 },
        position: { x: 0, y: 0, z: 0.55 },
        rotation: [0, 0, 0],
        parentId: "cabinet",
      },
      {
        id: "panel",
        name: "Control Panel",
        role: "control",
        primitive: "box",
        purpose: "Top controls",
        relativeSize: [0.7, 0.12, 0.2],
        relativePosition: [0, 0.55, 0.2],
        rotation: [0, 0, 0],
        parentId: "cabinet",
      },
    ],
    relationships: [],
  };

  const result = validateAndSanitizeGeometryPlan(raw, "washing machine");
  assert.equal(result.ok, true, result.warnings.join("; "));
  const byId = Object.fromEntries(result.plan.parts.map((item) => [item.id, item]));
  assert.deepEqual(byId.cabinet.relativeSize, [0.9, 0.95, 0.85]);
  assert.deepEqual(byId.drum.relativeSize, [0.55, 0.55, 0.5]);
  assert.deepEqual(byId.door.relativePosition, [0, 0, 0.55]);
  assert.deepEqual(byId.panel.relativePosition, [0, 0.55, 0.2]);

  const project = geometryPlanToProject(result.plan, "washing machine", {
    plannerSource: { source: "workers-ai", model: "mock" },
  });
  const positions = new Set(project.parts.map((item) => item.position.map((value) => value.toFixed(2)).join(",")));
  const sizes = new Set(project.parts.map((item) => item.size.map((value) => value.toFixed(2)).join(",")));
  assert.ok(positions.size >= 3, `expected spread positions, got ${[...positions]}`);
  assert.ok(sizes.size >= 3, `expected varied sizes, got ${[...sizes]}`);
  assert.ok(!project.parts.every((item) => item.position.every((value) => value === 0)));
  assertValid(project);
});

test("fails closed when every part collapses to the origin with identical sizes", () => {
  const raw = basePlan("Horseshoe", {
    parts: [
      part("main", "Main Body", "structure", "cylinder", [0.35, 0.2, 0.2], [0, 0, 0]),
      part("rim", "Rim", "surface", "cylinder", [0.35, 0.2, 0.2], [0, 0, 0]),
      part("nails", "Nails", "fastener", "box", [0.35, 0.2, 0.2], [0, 0, 0]),
    ],
  });
  const result = validateAndSanitizeGeometryPlan(raw, "horseshoe");
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some((warning) => /collapsed/i.test(warning)));
});

test("fails closed when Workers AI Vec3 fields are unusable and defaults stack at the origin", () => {
  const raw = basePlan("Washing Machine", {
    parts: [
      {
        id: "cabinet",
        name: "Cabinet",
        role: "housing",
        primitive: "box",
        purpose: "Outer cabinet",
        relativeSize: { bogus: true },
        relativePosition: "center",
        rotation: [0, 0, 0],
      },
      {
        id: "drum",
        name: "Drum",
        role: "motion",
        primitive: "cylinder",
        axis: "z",
        purpose: "Drum",
        relativeSize: 0.5,
        relativePosition: null,
        rotation: [0, 0, 0],
      },
      {
        id: "door",
        name: "Door",
        role: "surface",
        primitive: "box",
        purpose: "Door",
        relativeSize: { onlyX: 1 },
        relativePosition: {},
        rotation: [0, 0, 0],
      },
    ],
  });
  const result = validateAndSanitizeGeometryPlan(raw, "washing machine");
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some((warning) => /collapsed/i.test(warning)));
});

test("rejects unsafe GeometryPlan references instead of corrupting projects", () => {
  const raw = basePlan("bad", {
    parts: [
      part("aa", "A", "structure", "box", [0.4, 0.4, 0.4], [0, 0, 0], { parentId: "bb" }),
      part("bb", "B", "structure", "box", [0.4, 0.4, 0.4], [0, 0, 0], { parentId: "aa" }),
      part("cc", "C", "structure", "box", [0.4, 0.4, 0.4], [0, 0, 0]),
    ],
  });
  const result = validateAndSanitizeGeometryPlan(raw, "bad");
  assert.equal(result.ok, false);
  assert.ok(result.warnings.some((warning) => /cycle/i.test(warning)));
});

test("Workers AI planner creates distinct physical projects and preserves constraints", async () => {
  const ai = mockAI();
  const prompts = [
    "eyeglasses",
    "wrench",
    "car transmission",
    "corded drill",
    "fancy espresso machine without a glass carafe",
    "desk lamp",
    "telescope",
    "bicycle derailleur",
    "horseshoe",
    "washing machine drain pump",
    "wall mounted hair dryer",
    "stapler",
  ];
  const projects = [];
  for (const prompt of prompts) {
    const project = await createForgeProjectWithPlanner(prompt, { AI: ai }, { detail: "detailed" });
    assert.equal(project.planner.source, "workers-ai");
    assert.equal(project.source, "workers-ai");
    assert.ok(!names(project).some((name) => /Main Frame|Drive Core|Output Module/.test(name)), prompt);
    assertValid(project);
    projects.push(project);
  }
  assert.equal(new Set(projects.map((project) => names(project).join("|"))).size, prompts.length);

  const glasses = projects[0], wrench = projects[1], transmission = projects[2], drill = projects[3], espresso = projects[4], lamp = projects[5];
  assert.ok(extents(glasses)[0] > extents(glasses)[1] * 2);
  assert.ok(names(glasses).includes("Left Lens") && names(glasses).includes("Right Lens"));
  assert.ok(extents(wrench)[0] > extents(wrench)[1] * 4);
  assert.ok(!names(transmission).some((name) => /wheel|chassis|windshield|bumper/i.test(name)));
  assert.ok(names(drill).some((name) => /cord|plug/i.test(name)));
  assert.ok(!names(drill).some((name) => /battery/i.test(name)));
  assert.ok(!names(espresso).some((name) => /carafe|warming plate/i.test(name)));
  assert.ok(!names(lamp).some((name) => /tabletop|leg|center brace/i.test(name)));
});

test("Workers AI object response is parsed as a successful structured plan", async () => {
  const ai = {
    calls: [],
    async run(model, input) {
      this.calls.push({ model, input });
      return { response: planFor("telescope") };
    },
  };

  const project = await createForgeProjectWithPlanner("telescope", { AI: ai }, { detail: "detailed" });
  assert.equal(ai.calls.length, 1);
  assert.equal(project.source, "workers-ai");
  assert.equal(project.planner.source, "workers-ai");
  assert.ok(!names(project).some((name) => /Main Frame|Drive Core|Output Module/.test(name)));
  assertValid(project);
});

test("successful AI planning for unknown prompts cannot silently become genericRecipe output", async () => {
  const ai = {
    calls: [],
    async run(model, input) {
      this.calls.push({ model, input });
      return { response: JSON.stringify(planFor("motorcycle frame subassembly")) };
    },
  };

  const project = await createForgeProjectWithPlanner("motorcycle frame subassembly", { AI: ai }, { detail: "detailed" });
  const projectNames = names(project);
  assert.equal(ai.calls.length, 1);
  assert.equal(project.source, "workers-ai");
  assert.equal(project.planner.source, "workers-ai");
  assert.equal(project.planner.model, "@cf/meta/llama-3.1-8b-instruct-fast");
  assert.ok(!projectNames.includes("Main Frame"));
  assert.ok(!projectNames.includes("Outer Body"));
  assert.ok(!projectNames.includes("Drive Core"));
  assert.ok(!projectNames.includes("Control Module"));
  assert.ok(!projectNames.includes("Output Module"));
  assertValid(project);
});

test("Workers AI planner falls back to existing semantic planner when model output is invalid", async () => {
  const project = await createForgeProjectWithPlanner("eyeglasses", {
    AI: { async run() { return { response: "{\"parts\": []}" }; } },
  });
  assert.equal(project.source, "procedural-concept");
  assert.equal(project.planner.source, "semantic-fallback");
  assert.ok(project.planner.warnings.some((warning) => /invalid/i.test(warning)));
  assert.ok(names(project).includes("Left Lens"));
  assertValid(project);
});

test("high-confidence recovered recipes run before Workers AI", async () => {
  const ai = mockAI();
  const project = await createForgeProjectWithPlanner("A-72 bowling machine", { AI: ai });
  assert.equal(project.source, "recovered-recipe");
  assert.equal(project.planner.source, "recovered-recipe");
  assert.equal(ai.calls.length, 0);
  assert.ok(names(project).includes("Pin Table"));
  assertValid(project);
});
