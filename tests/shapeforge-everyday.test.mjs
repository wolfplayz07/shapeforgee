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
const { createForgeProject, validateForgeProject } = shapeforge;

after(async () => {
  await vite.close();
});

function assertValid(project) {
  const failed = validateForgeProject(project).filter((check) => !check.ok);
  assert.deepEqual(failed, []);
}

test("preserves the known A-72 bowling machine while adding new inference paths", () => {
  const project = createForgeProject("A-72 bowling machine", { detail: "detailed" });
  const names = new Set(project.parts.map((part) => part.name));

  assert.equal(project.name, "A-72 Bowling Machine");
  assert.equal(project.parts.length, 12);
  assert.equal(project.source, "recovered-recipe");

  for (const expected of [
    "Base Frame",
    "Upper Housing",
    "Elevation Lift",
    "Boom Arm",
    "Pin Table",
    "Pin Set",
    "Lift Motor",
    "Left Drive Wheel",
    "Right Drive Wheel",
    "Control Box",
    "Ball Return Tunnel",
    "Side Safety Guard",
  ]) {
    assert.ok(names.has(expected), `missing ${expected}`);
  }

  assertValid(project);
});

test("builds a six-drawer dresser from a plain request with small hardware", () => {
  const project = createForgeProject(
    "make me a six drawer walnut dresser with brass pulls",
    { detail: "detailed" },
  );

  assert.equal(project.name, "6-Drawer Dresser");
  assert.equal(project.parts.filter((part) => /Drawer \d+ Front/.test(part.name)).length, 6);
  assert.equal(project.parts.filter((part) => /Drawer \d+ Pull/.test(part.name)).length, 6);
  assert.equal(project.parts.filter((part) => /^Drawer \d+$/.test(part.name)).length, 6);
  assert.ok(project.parts.some((part) => part.name === "Back Panel"));
  assert.ok(project.parts.some((part) => part.name === "Top Panel"));
  assert.ok(project.parts.some((part) => /Pull/.test(part.name) && Math.min(...part.size) <= 7));
  assertValid(project);
});

test("understands drawer count and knob style from another dresser request", () => {
  const project = createForgeProject("a white 4 drawer dresser with round knobs");

  assert.equal(project.name, "4-Drawer Dresser");
  assert.equal(project.parts.filter((part) => /Drawer \d+ Front/.test(part.name)).length, 4);
  assert.equal(project.parts.filter((part) => /Drawer \d+ Knob/.test(part.name)).length, 4);
  assert.equal(project.parts.filter((part) => part.kind === "cylinder" && /Knob/.test(part.name)).length, 4);
  assertValid(project);
});

test("builds a retractable pen with recognizable tiny external and internal parts", () => {
  const project = createForgeProject(
    "blue retractable ballpoint pen with a pocket clip",
    { detail: "detailed" },
  );
  const names = new Set(project.parts.map((part) => part.name));

  for (const expected of [
    "Lower Barrel",
    "Upper Barrel",
    "Grip Sleeve",
    "Tapered Tip Section",
    "Writing Point",
    "Ballpoint",
    "Pocket Clip",
    "Ink Refill",
    "Return Spring",
    "Click Button",
    "Click Cam",
  ]) {
    assert.ok(names.has(expected), `missing ${expected}`);
  }

  const barrel = project.parts.find((part) => part.name === "Lower Barrel");
  const ballpoint = project.parts.find((part) => part.name === "Ballpoint");
  assert.ok(barrel.size[0] / barrel.size[1] > 5);
  assert.ok(Math.max(...ballpoint.size) <= 4);
  assertValid(project);
});

test("basic pen detail keeps the silhouette but removes tiny internals", () => {
  const project = createForgeProject("a simple retractable pen", { detail: "basic" });
  const names = new Set(project.parts.map((part) => part.name));

  assert.ok(names.has("Lower Barrel"));
  assert.ok(names.has("Pocket Clip"));
  assert.ok(names.has("Writing Point"));
  assert.ok(names.has("Click Button"));
  assert.ok(!names.has("Ink Refill"));
  assert.ok(!names.has("Return Spring"));
  assert.ok(!names.has("Click Cam"));
  assertValid(project);
});

test("uses one generalized handheld silhouette for unrelated handheld requests", () => {
  const drill = createForgeProject("yellow cordless handheld drill", { detail: "detailed" });
  const dryer = createForgeProject("portable blue hair dryer with handle", { detail: "detailed" });

  for (const project of [drill, dryer]) {
    const names = new Set(project.parts.map((part) => part.name));
    assert.ok(names.has("Main Body Housing"));
    assert.ok(names.has("Front Barrel"));
    assert.ok(names.has("Angled Handle"));
    assert.ok(names.has("Grip Surface"));
    assert.ok(names.has("Primary Control"));
    assertValid(project);
  }

  assert.ok(drill.parts.some((part) => part.name === "Power Base"));
  assert.ok(!dryer.parts.some((part) => part.name === "Power Base"));
  assert.ok(dryer.parts.find((part) => part.name === "Working End").size[0] > drill.parts.find((part) => part.name === "Working End").size[0]);
});

test("uses a thin-panel silhouette instead of the old generic box assembly", () => {
  const project = createForgeProject("passive flat panel collector with support frame");
  const panel = project.parts.find((part) => part.name === "Primary Panel");
  const names = new Set(project.parts.map((part) => part.name));

  assert.ok(panel);
  assert.ok(panel.size[0] / panel.size[1] > 20);
  assert.ok(names.has("Rear Layer"));
  assert.ok(names.has("Left Support"));
  assert.ok(names.has("Right Support"));
  assertValid(project);
});

test("uses a vessel silhouette for containers and adds handles only when appropriate", () => {
  const bottle = createForgeProject("steel reusable bottle with cap");
  const mug = createForgeProject("blue coffee mug with handle");

  assert.ok(bottle.parts.some((part) => part.name === "Container Body" && part.kind === "cylinder"));
  assert.ok(!bottle.parts.some((part) => part.name === "Side Handle"));
  assert.ok(mug.parts.some((part) => part.name === "Side Handle"));
  assertValid(bottle);
  assertValid(mug);
});

test("uses a hinged-mechanism silhouette for a stapler-like request", () => {
  const project = createForgeProject("compact desktop stapler");
  const names = new Set(project.parts.map((part) => part.name));

  assert.ok(names.has("Lower Base"));
  assert.ok(names.has("Upper Arm"));
  assert.ok(names.has("Pivot Hinge"));
  assert.ok(names.has("Working Contact"));
  assertValid(project);
});
