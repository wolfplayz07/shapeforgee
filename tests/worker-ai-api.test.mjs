import assert from "node:assert/strict";
import test from "node:test";

function aiPlan() {
  return {
    schemaVersion: 1,
    requestedObject: { identity: "Horseshoe", scope: "complete_object" },
    silhouette: {
      form: "open U-shaped metal loop",
      proportions: { width: 1.2, height: 1.3, depth: 0.12 },
      orientation: "upright open end downward",
      dominantAxis: "y",
      symmetry: "bilateral",
    },
    exclusions: [],
    recognitionCriticalParts: ["left curved arm", "right curved arm", "toe bend"],
    parts: [
      { id: "leftArm", name: "Left Curved Arm", role: "structure", primitive: "cylinder", axis: "y", purpose: "Forms the left side of the U-shaped shoe.", relativeSize: [0.08, 0.72, 0.08], relativePosition: [-0.36, 0, 0], rotation: [0, 0, -16], relatedIds: ["toe", "rightArm"], spatialRelationships: ["left of center", "mirrored with right arm"] },
      { id: "rightArm", name: "Right Curved Arm", role: "structure", primitive: "cylinder", axis: "y", purpose: "Forms the right side of the U-shaped shoe.", relativeSize: [0.08, 0.72, 0.08], relativePosition: [0.36, 0, 0], rotation: [0, 0, 16], relatedIds: ["toe", "leftArm"], spatialRelationships: ["right of center", "mirrored with left arm"], mirroredFrom: "leftArm" },
      { id: "toe", name: "Rounded Toe Bend", role: "structure", primitive: "cylinder", axis: "x", purpose: "Joins both arms in the rounded toe.", relativeSize: [0.62, 0.08, 0.08], relativePosition: [0, 0.42, 0], rotation: [0, 0, 0], relatedIds: ["leftArm", "rightArm"], spatialRelationships: ["above and connected to both arms"] },
      { id: "nailHoles", name: "Nail Hole Pattern", role: "fastener", primitive: "box", purpose: "Marks the attachment holes around the shoe.", relativeSize: [0.78, 0.05, 0.04], relativePosition: [0, 0, 0.08], rotation: [0, 0, 0], parentId: "toe", relatedIds: ["leftArm", "rightArm"], spatialRelationships: ["on front face"] },
    ],
    relationships: [
      { from: "leftArm", to: "toe", type: "connected-to" },
      { from: "rightArm", to: "toe", type: "connected-to" },
    ],
  };
}

test("Worker /api/forge uses server-side Workers AI binding when available", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const calls = [];
  const logs = [];
  const originalLog = console.log;
  console.log = (message, ...args) => {
    if (typeof message === "string") {
      try {
        logs.push(JSON.parse(message));
      } catch {
        originalLog(message, ...args);
      }
      return;
    }
    originalLog(message, ...args);
  };

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "kinetic sculpture", detail: "detailed", scale: 1 }),
      }),
      {
        AI: {
          async run(model, input) {
            calls.push({ model, input });
            return { response: JSON.stringify(aiPlan()) };
          },
        },
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      {
        waitUntil() {},
        passThroughOnException() {},
      },
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "@cf/meta/llama-3.1-8b-instruct-fast");
    assert.equal(body.project.source, "workers-ai");
    assert.equal(body.project.planner.source, "workers-ai");
    assert.ok(body.project.parts.some((part) => part.name === "Rounded Toe Bend"));
    assert.ok(!body.project.parts.some((part) => /Main Frame|Drive Core|Output Module/.test(part.name)));
  } finally {
    console.log = originalLog;
  }

  const eventNames = logs.map((entry) => entry.event);
  assert.deepEqual(eventNames, [
    "forge.request",
    "planner.recipe",
    "planner.ai.start",
    "planner.ai.success",
    "planner.validation.success",
    "planner.conversion.success",
    "forge.result",
  ]);
  const resultLog = logs.find((entry) => entry.event === "forge.result");
  assert.equal(resultLog.projectSource, "workers-ai");
  assert.equal(resultLog.plannerSource, "workers-ai");
  assert.equal(resultLog.plannerModel, "@cf/meta/llama-3.1-8b-instruct-fast");
  assert.deepEqual(resultLog.plannerWarnings, []);
  assert.equal(resultLog.partCount, 4);
  assert.equal(resultLog.genericMainFrameSignature, false);
});

async function forgeWithMockAI(prompt) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const { default: worker } = await import(workerUrl.href);
  const calls = [];
  const response = await worker.fetch(
    new Request("http://localhost/api/forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, detail: "detailed", scale: 1 }),
    }),
    {
      AI: {
        async run(model, input) {
          calls.push({ model, input });
          return { response: JSON.stringify(aiPlan()) };
        },
      },
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const body = await response.json();
  return { status: response.status, body, calls };
}

test("known recovered recipes short-circuit Workers AI", async () => {
  for (const prompt of ["a hammer", "stapler", "cordless drill"]) {
    const { status, body, calls } = await forgeWithMockAI(prompt);
    assert.equal(status, 200, prompt);
    assert.equal(calls.length, 0, `${prompt} must not wait on Workers AI`);
    assert.equal(body.project.planner.source, "recovered-recipe", prompt);
    assert.ok(!body.project.parts.some((part) => /Primary Structure|Working Core|Main Frame/.test(part.name)), prompt);
  }
});

test("known semantic families skip Workers AI instead of timing out into generic mush", async () => {
  const { status, body, calls } = await forgeWithMockAI("coffee maker");
  assert.equal(status, 200);
  assert.equal(calls.length, 0);
  assert.equal(body.project.planner.source, "semantic-fallback");
  assert.ok(body.project.planner.warnings.some((warning) => /known semantic family/i.test(warning)));
  assert.ok(body.project.parts.some((part) => /Carafe|Reservoir|Brew/.test(part.name)));
  assert.ok(!body.project.parts.some((part) => /Primary Structure|Working Core|Main Frame/.test(part.name)));
});
