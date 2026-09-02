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
