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

function namesOf(project) {
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

test("replaces generic fallback with prompt-specific semantic decompositions", () => {
  const cases = [
    ["window unit air conditioner", ["Sleeve Cabinet", "Front Intake Grille", "Evaporator Coil", "Sealed Compressor", "Rear Condenser Coil"], ["thermal", "input", "output"]],
    ["cordless drill", ["Drill Motor Housing", "Front Gearbox Collar", "Keyless Chuck", "Variable-Speed Trigger", "Slide-On Battery Pack"], ["power", "motion", "control"]],
    ["coffee maker", ["Countertop Brewer Housing", "Water Reservoir", "Heating Element", "Brew Basket", "Glass Carafe"], ["fluid", "thermal", "vessel"]],
    ["desktop printer", ["Printer Chassis", "Front Paper Tray", "Paper Feed Roller", "Print Head Carriage", "Ink Cartridge Set"], ["input", "motion", "output"]],
    ["bicycle pump", ["Pump Barrel", "Plunger Rod", "T-Handle Grip", "Flexible Air Hose", "Valve Chuck"], ["fluid", "motion", "fastener"]],
    ["blender", ["Motor Base", "Drive Coupler", "Clear Pitcher Jar", "Blade Assembly", "Speed Control Panel"], ["power", "motion", "vessel"]],
  ];
  const genericNames = new Set(["Main Frame", "Outer Body", "Drive Core", "Control Module", "Output Module"]);
  const signatures = new Set();

  for (const [prompt, expectedNames, expectedCategories] of cases) {
    const project = createForgeProject(prompt, { detail: "detailed" });
    const names = new Set(project.parts.map((part) => part.name));
    const categories = new Set(project.parts.map((part) => part.category));

    for (const genericName of genericNames) {
      assert.ok(!names.has(genericName), `${prompt} reused generic ${genericName}`);
    }
    for (const expectedName of expectedNames) {
      assert.ok(names.has(expectedName), `${prompt} missing ${expectedName}`);
    }
    for (const category of expectedCategories) {
      assert.ok(categories.has(category), `${prompt} missing ${category} category`);
    }

    assert.ok(project.parts.some((part) => part.parent), `${prompt} should infer parent-child relationships`);
    assert.ok(project.parts.some((part) => part.related.length > 0), `${prompt} should infer related-component relationships`);
    assert.ok(project.parts.some((part) => /front|behind|inside|above|below|attached|concentric|surrounding|connected/i.test(part.purpose)), `${prompt} should encode spatial relationships`);
    signatures.add(project.parts.map((part) => part.name).join("|"));
    assertValid(project);
  }

  assert.equal(signatures.size, cases.length);
});

test("semantic planner fixes observed subject, modifier, and exclusion regressions", () => {
  const glasses = createForgeProject("eye glasses", { detail: "detailed" });
  const glassesNames = namesOf(glasses);
  const glassesExtents = extents(glasses);
  assert.ok(glassesNames.includes("Left Lens"));
  assert.ok(glassesNames.includes("Right Lens"));
  assert.ok(glassesNames.includes("Left Temple Arm"));
  assert.ok(glassesNames.includes("Right Temple Arm"));
  assert.ok(!glassesNames.some((name) => /Outer Shell/.test(name)));
  assert.ok(glassesExtents[0] > glassesExtents[1] * 2, "eyewear should be wide and thin");
  assert.ok(glassesExtents[0] > glassesExtents[2] * 1.4, "eyewear should not be box-deep");
  const leftLens = glasses.parts.find((part) => part.name === "Left Lens");
  const rightLens = glasses.parts.find((part) => part.name === "Right Lens");
  assert.equal(leftLens.position[0], -rightLens.position[0], "lenses should be bilaterally placed");
  assertValid(glasses);

  const wrench = createForgeProject("wrench", { detail: "detailed" });
  const wrenchNames = namesOf(wrench);
  const wrenchExtents = extents(wrench);
  assert.ok(wrenchNames.includes("Slim Handle Beam"));
  assert.ok(wrenchNames.includes("Open Jaw Head"));
  assert.ok(wrenchNames.includes("Box End Ring"));
  assert.ok(!wrenchNames.some((name) => /Outer Shell/.test(name)));
  assert.ok(wrenchExtents[0] > wrenchExtents[1] * 4, "wrench should be elongated");
  assert.ok(wrenchExtents[0] > wrenchExtents[2] * 4, "wrench should not be a boxy housing");
  assertValid(wrench);

  const transmission = createForgeProject("car transmission", { detail: "detailed" });
  const transmissionNames = namesOf(transmission);
  assert.ok(transmissionNames.includes("Transmission Gear Case"));
  assert.ok(transmissionNames.includes("Input Shaft"));
  assert.ok(transmissionNames.includes("Output Shaft"));
  assert.ok(!transmissionNames.some((name) => /wheel|chassis|door|fascia|bumper|windshield/i.test(name)));
  assert.ok(/transmission/i.test(transmission.name));
  assertValid(transmission);

  const corded = createForgeProject("corded drill", { detail: "detailed" });
  const cordedNames = namesOf(corded);
  assert.ok(cordedNames.includes("Cord Strain Relief"));
  assert.ok(cordedNames.includes("Power Cord"));
  assert.ok(cordedNames.includes("Two-Prong Plug"));
  assert.ok(!cordedNames.includes("Slide-On Battery Pack"));
  assertValid(corded);

  const fancy = createForgeProject("fancy coffee maker not a normal coffee machine with the regular pot of joe", { detail: "detailed" });
  const fancyNames = namesOf(fancy);
  assert.ok(fancyNames.includes("Sculpted Espresso Body"));
  assert.ok(fancyNames.includes("Portafilter Group Head"));
  assert.ok(fancyNames.includes("Steam Wand"));
  assert.ok(!fancyNames.some((name) => /glass carafe|warming plate|brew basket|carafe handle/i.test(name)));
  assertValid(fancy);

  const lamp = createForgeProject("desk lamp", { detail: "detailed" });
  const lampNames = namesOf(lamp);
  assert.ok(lampNames.includes("Lamp Base"));
  assert.ok(lampNames.includes("Adjustable Stem"));
  assert.ok(lampNames.includes("Lamp Shade"));
  assert.ok(!lampNames.some((name) => /tabletop|front left leg|center brace/i.test(name)));
  assertValid(lamp);
});

test("semantic planner generalizes across unseen component, wearable, tool, appliance, and non-box prompts", () => {
  const drainPump = createForgeProject("washing machine drain pump", { detail: "detailed" });
  const drainPumpNames = namesOf(drainPump);
  assert.ok(drainPumpNames.some((name) => /Pump Barrel|Housing|Shaft|Gear Case/.test(name)));
  assert.ok(!drainPumpNames.some((name) => /washer cabinet|drum|door|control console/i.test(name)));
  assertValid(drainPump);

  const goggles = createForgeProject("safety goggles", { detail: "detailed" });
  assert.ok(namesOf(goggles).includes("Paired Nose Pads"));
  assert.ok(extents(goggles)[0] > extents(goggles)[1] * 2);
  assertValid(goggles);

  const scraper = createForgeProject("paint scraper hand tool", { detail: "detailed" });
  assert.ok(namesOf(scraper).includes("Slim Handle Beam"));
  assert.ok(extents(scraper)[0] > extents(scraper)[2] * 4);
  assertValid(scraper);

  const espresso = createForgeProject("compact espresso brewer without a glass carafe", { detail: "detailed" });
  assert.ok(namesOf(espresso).includes("Portafilter Group Head"));
  assert.ok(!namesOf(espresso).some((name) => /carafe|warming plate/i.test(name)));
  assertValid(espresso);

  const hoop = createForgeProject("folding hula hoop", { detail: "detailed" });
  const hoopNames = namesOf(hoop);
  const hoopExtents = extents(hoop);
  assert.ok(hoopNames.includes("Front Curved Segment"));
  assert.ok(hoopNames.includes("Left Curved Segment"));
  assert.ok(!hoopNames.some((name) => /Outer Shell/.test(name)));
  assert.ok(hoopExtents[0] > hoopExtents[1] * 8);
  assert.ok(hoopExtents[2] > hoopExtents[1] * 8);
  assertValid(hoop);
});
