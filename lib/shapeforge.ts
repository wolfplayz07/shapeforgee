export * from "./shapeforge-core.ts";

import {
  createForgeProject as createCoreForgeProject,
  samplePrompts as coreSamplePrompts,
  type CylinderAxis,
  type DetailLevel,
  type ForgePart,
  type ForgeProject,
  type PrimitiveKind,
  type Vec3,
} from "./shapeforge-core.ts";

interface EverydaySpec {
  key: string;
  name: string;
  kind: PrimitiveKind;
  axis?: CylinderAxis;
  parentKey?: string;
  category: string;
  purpose: string;
  position: Vec3;
  size: Vec3;
  rotation?: Vec3;
  explode: Vec3;
  relatedKeys?: string[];
  color: string;
  detail?: boolean;
}

type EverydayArchetype = "handheld" | "panel" | "vessel" | "hinged";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const scaleVec = (value: Vec3, scale: number): Vec3 =>
  value.map((entry) => entry * scale) as Vec3;

const componentId = (index: number) =>
  `COMP-${String(index).padStart(6, "0")}`;

const box = (
  key: string,
  name: string,
  parentKey: string | undefined,
  category: string,
  purpose: string,
  position: Vec3,
  size: Vec3,
  explode: Vec3,
  color: string,
  options: Partial<Pick<EverydaySpec, "rotation" | "relatedKeys" | "detail">> = {},
): EverydaySpec => ({
  key,
  name,
  kind: "box",
  parentKey,
  category,
  purpose,
  position,
  size,
  explode,
  color,
  ...options,
});

const cylinder = (
  key: string,
  name: string,
  parentKey: string | undefined,
  category: string,
  purpose: string,
  position: Vec3,
  size: Vec3,
  explode: Vec3,
  color: string,
  axis: CylinderAxis = "x",
  options: Partial<Pick<EverydaySpec, "rotation" | "relatedKeys" | "detail">> = {},
): EverydaySpec => ({
  key,
  name,
  kind: "cylinder",
  axis,
  parentKey,
  category,
  purpose,
  position,
  size,
  explode,
  color,
  ...options,
});

function colorFromPrompt(prompt: string, fallback: string) {
  const value = prompt.toLowerCase();
  if (/\bwhite|ivory|cream\b/.test(value)) return "#d8d4ca";
  if (/\bblack|onyx\b/.test(value)) return "#30353a";
  if (/\bblue|navy|cobalt\b/.test(value)) return "#3d7194";
  if (/\bgreen|emerald\b/.test(value)) return "#4f7d5e";
  if (/\bred|crimson|burgundy\b/.test(value)) return "#9c4144";
  if (/\bsilver|gray|grey|metal\b/.test(value)) return "#7d8992";
  if (/\bwalnut|dark wood\b/.test(value)) return "#704b33";
  if (/\boak|light wood\b/.test(value)) return "#a77c50";
  return fallback;
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/\b(please|make|create|build|design|generate|show me|a|an|the|with)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "Everyday Object")
    .split(" ")
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildEverydayProject(
  name: string,
  prompt: string,
  specs: EverydaySpec[],
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const scale = clamp(options.scale ?? 1, 0.5, 1.8);
  const detail = options.detail ?? "detailed";
  const selected = specs.filter((spec) => detail === "detailed" || !spec.detail);
  const keys = new Set(selected.map((spec) => spec.key));
  const ids = new Map(selected.map((spec, index) => [spec.key, componentId(index + 1)]));
  const parts: ForgePart[] = selected.map((spec) => ({
    id: ids.get(spec.key)!,
    name: spec.name,
    kind: spec.kind,
    axis: spec.axis,
    parent: spec.parentKey && keys.has(spec.parentKey) ? ids.get(spec.parentKey)! : null,
    category: spec.category,
    purpose: spec.purpose,
    position: scaleVec(spec.position, scale),
    size: scaleVec(spec.size, scale),
    rotation: spec.rotation ?? [0, 0, 0],
    explode: scaleVec(spec.explode, scale),
    related: (spec.relatedKeys ?? [])
      .filter((key) => keys.has(key))
      .map((key) => ids.get(key)!),
    color: spec.color,
    hidden: false,
    detached: false,
  }));

  return {
    format: "ShapeForge Project",
    formatVersion: 2,
    id: "PROJ-000001",
    name,
    prompt,
    createdAt: new Date().toISOString(),
    source: "procedural-concept",
    planner: { source: "semantic-fallback" },
    allocator: { nextComponent: parts.length + 1 },
    settings: { scale, detail },
    parts,
    history: [`Shape-aware everyday generation: ${name}`],
  };
}

function numberFromPrompt(prompt: string, fallback: number) {
  const value = prompt.toLowerCase();
  const digit = value.match(/\b([2-9])\s*[- ]?drawer/);
  if (digit) return Number(digit[1]);
  const words: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
  };
  for (const [word, number] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\s*[- ]?drawer`).test(value)) return number;
  }
  return fallback;
}

function dresserProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const value = prompt.toLowerCase();
  const isNightstand = /nightstand|bedside/.test(value);
  const drawerCount = clamp(numberFromPrompt(prompt, isNightstand ? 2 : 6), 2, 9);
  const doubleColumn = !isNightstand && drawerCount >= 6 && !/tall|vertical|lingerie/.test(value);
  const columns = doubleColumn ? 2 : 1;
  const rows = Math.ceil(drawerCount / columns);
  const width = isNightstand ? 105 : doubleColumn ? 205 : /narrow|tall/.test(value) ? 118 : 150;
  const height = isNightstand ? 105 : /tall|vertical/.test(value) ? 220 : 170;
  const depth = isNightstand ? 82 : 92;
  const bodyColor = colorFromPrompt(prompt, "#8b6342");
  const drawerColor = colorFromPrompt(prompt, "#9d744f");
  const hardware = /brass|gold/.test(value) ? "#b9934d" : "#aeb6bc";
  const rowHeight = (height - 28) / rows;
  const cellWidth = (width - 24) / columns;
  const specs: EverydaySpec[] = [
    box("back", "Back Panel", undefined, "structure", "Squares and closes the rear of the dresser carcass.", [0, 0, -depth / 2 + 4], [width, height, 8], [0, 0, -125], bodyColor, { relatedKeys: ["leftSide", "rightSide", "top", "bottom"] }),
    box("leftSide", "Left Side Panel", "back", "structure", "Forms the left side of the cabinet.", [-width / 2 + 6, 0, 0], [12, height, depth], [-120, 0, 0], bodyColor, { relatedKeys: ["back", "top", "bottom"] }),
    box("rightSide", "Right Side Panel", "back", "structure", "Forms the right side of the cabinet.", [width / 2 - 6, 0, 0], [12, height, depth], [120, 0, 0], bodyColor, { relatedKeys: ["back", "top", "bottom"] }),
    box("top", "Top Panel", "back", "surface", "Provides the finished top surface.", [0, height / 2 - 6, 0], [width + 8, 12, depth + 5], [0, 120, 0], bodyColor, { relatedKeys: ["back"] }),
    box("bottom", "Bottom Panel", "back", "structure", "Ties the cabinet sides together at the base.", [0, -height / 2 + 8, 0], [width - 10, 12, depth - 8], [0, -105, 0], bodyColor, { relatedKeys: ["back"] }),
  ];

  for (let index = 0; index < drawerCount; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = columns === 1 ? 0 : (column === 0 ? -1 : 1) * cellWidth * 0.26;
    const y = height / 2 - 18 - rowHeight * (row + 0.5);
    const drawerWidth = cellWidth - 8;
    const drawerHeight = rowHeight - 8;
    const key = `drawer${index + 1}`;
    const frontKey = `front${index + 1}`;
    const handleKey = `handle${index + 1}`;
    const explodeSide = columns === 1 ? 0 : column === 0 ? -35 : 35;
    specs.push(
      box(key, `Drawer ${index + 1}`, "back", "storage", "Sliding storage box inside the dresser.", [x, y, 3], [drawerWidth - 8, drawerHeight - 8, depth - 22], [explodeSide, 0, 110 + row * 18], "#76553c", { relatedKeys: [frontKey], detail: true }),
      box(frontKey, `Drawer ${index + 1} Front`, key, "surface", "Visible drawer front that establishes the dresser layout.", [x, y, depth / 2 + 3], [drawerWidth, drawerHeight, 7], [explodeSide, 0, 155 + row * 18], drawerColor, { relatedKeys: [key, handleKey] }),
    );

    const useKnob = /knob|round handle/.test(value) || isNightstand;
    if (useKnob) {
      specs.push(cylinder(handleKey, `Drawer ${index + 1} Knob`, frontKey, "hardware", "Small pull knob for opening the drawer.", [x, y, depth / 2 + 10], [9, 9, 10], [explodeSide, 0, 205 + row * 18], hardware, "z", { relatedKeys: [frontKey] }));
    } else {
      specs.push(box(handleKey, `Drawer ${index + 1} Pull`, frontKey, "hardware", "Small horizontal pull for opening the drawer.", [x, y, depth / 2 + 11], [Math.min(34, drawerWidth * 0.35), 6, 7], [explodeSide, 0, 205 + row * 18], hardware, { relatedKeys: [frontKey] }));
    }
  }

  const footX = width / 2 - 18;
  const footZ = depth / 2 - 18;
  [
    ["footFL", -footX, footZ, -70, 75],
    ["footFR", footX, footZ, 70, 75],
    ["footRL", -footX, -footZ, -70, -75],
    ["footRR", footX, -footZ, 70, -75],
  ].forEach(([key, x, z, ex, ez]) => {
    specs.push(box(String(key), String(key).replace("foot", "Foot "), "bottom", "support", "Small foot that lifts the cabinet off the floor.", [Number(x), -height / 2 - 5, Number(z)], [16, 22, 16], [Number(ex), -90, Number(ez)], bodyColor, { detail: true }));
  });

  const name = isNightstand ? `${drawerCount}-Drawer Nightstand` : `${drawerCount}-Drawer Dresser`;
  return buildEverydayProject(name, prompt, specs, options);
}

function penProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const value = prompt.toLowerCase();
  const bodyColor = colorFromPrompt(prompt, "#356f9b");
  const gripColor = /rubber|soft grip/.test(value) ? "#2f363b" : colorFromPrompt(prompt, "#315c78");
  const metal = "#b6c0c7";
  const inkColor = /red ink/.test(value) ? "#923d42" : /green ink/.test(value) ? "#3d7653" : "#2d5f8f";
  const retractable = !/capped|fountain/.test(value);
  const specs: EverydaySpec[] = [
    cylinder("lowerBarrel", "Lower Barrel", undefined, "housing", "Forms the front half of the pen body.", [19, 0, 0], [70, 13, 13], [0, 0, 0], bodyColor, "x", { relatedKeys: ["upperBarrel", "grip", "refill"] }),
    cylinder("upperBarrel", "Upper Barrel", "lowerBarrel", "housing", "Forms the rear half of the pen body.", [-42, 0, 0], [54, 14, 14], [-92, 0, 0], bodyColor, "x", { relatedKeys: ["lowerBarrel", "clip", "clicker"] }),
    cylinder("grip", "Grip Sleeve", "lowerBarrel", "grip", "Provides a thicker textured area for the fingers.", [48, 0, 0], [31, 15, 15], [78, 0, 0], gripColor, "x", { relatedKeys: ["lowerBarrel", "nose"] }),
    cylinder("nose", "Tapered Tip Section", "grip", "tip", "Narrows the body toward the writing point.", [68, 0, 0], [18, 10, 10], [118, 0, 0], metal, "x", { relatedKeys: ["grip", "point"] }),
    cylinder("point", "Writing Point", "nose", "tip", "Holds the small ballpoint at the end of the pen.", [80, 0, 0], [8, 4, 4], [158, 0, 0], metal, "x", { relatedKeys: ["nose", "ball"] }),
    cylinder("ball", "Ballpoint", "point", "tip", "Tiny writing contact at the end of the refill.", [85, 0, 0], [3.5, 3.5, 3.5], [190, 0, 0], "#747d84", "x", { relatedKeys: ["point"] }),
    box("clip", "Pocket Clip", "upperBarrel", "hardware", "Thin spring clip for attaching the pen to a pocket or notebook.", [-43, 10, 0], [42, 3.5, 5], [-68, 42, 0], metal, { rotation: [0, 0, -2], relatedKeys: ["upperBarrel"] }),
    cylinder("refill", "Ink Refill", "lowerBarrel", "ink system", "Narrow internal tube carrying ink to the writing point.", [8, 0, 0], [118, 3.6, 3.6], [0, -48, 0], inkColor, "x", { relatedKeys: ["point", "spring"], detail: true }),
    cylinder("spring", "Return Spring", "refill", "mechanism", "Small spring that returns the retractable refill.", [57, 0, 0], [18, 6, 6], [92, -58, 0], "#8f9aa2", "x", { relatedKeys: ["refill", "clicker"], detail: true }),
  ];

  if (retractable) {
    specs.push(
      cylinder("clicker", "Click Button", "upperBarrel", "mechanism", "Small rear button that extends and retracts the refill.", [-76, 0, 0], [14, 9, 9], [-142, 0, 0], metal, "x", { relatedKeys: ["upperBarrel", "spring"] }),
      cylinder("cam", "Click Cam", "clicker", "mechanism", "Internal cam that locks the refill in and out.", [-66, 0, 0], [13, 7, 7], [-112, -44, 0], "#7b868e", "x", { relatedKeys: ["clicker", "spring"], detail: true }),
    );
  } else {
    specs.push(cylinder("cap", "Pen Cap", "upperBarrel", "cover", "Removable cap that protects the writing tip.", [63, 0, 0], [48, 17, 17], [125, 55, 0], bodyColor, "x", { relatedKeys: ["nose", "clip"] }));
  }

  const name = retractable ? "Retractable Ballpoint Pen" : "Capped Pen";
  return buildEverydayProject(name, prompt, specs, options);
}

function inferEverydayArchetype(prompt: string): EverydayArchetype | null {
  const value = prompt.toLowerCase();
  if (/\b(handheld|handle|grip|trigger|cordless|portable|drill|driver|dryer|sprayer|torch|flashlight|glue gun|heat gun|power tool)\b/.test(value)) return "handheld";
  if (/\b(panel|collector|solar|sign|screen|filter|radiator|board|flat plate)\b/.test(value)) return "panel";
  if (/\b(bottle|jar|cup|mug|canister|thermos|tank|vessel|container|kettle)\b/.test(value)) return "vessel";
  if (/\b(stapler|clamp|hinge|hinged|press|tongs)\b/.test(value)) return "hinged";
  return null;
}

function handheldProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const value = prompt.toLowerCase();
  const bodyColor = colorFromPrompt(prompt, "#c99636");
  const dark = "#2c3339";
  const metal = "#aeb8c0";
  const hasBattery = /\b(cordless|battery|drill|driver|power tool)\b/.test(value);
  const longNozzle = /\b(dryer|sprayer|heat gun|glue gun|torch)\b/.test(value);
  const outputLength = longNozzle ? 62 : 34;
  const specs: EverydaySpec[] = [
    box("body", "Main Body Housing", undefined, "housing", "Defines the primary handheld body silhouette.", [-10, -6, 0], [105, 52, 48], [0, 65, 0], bodyColor, { rotation: [0, 0, -7], relatedKeys: ["front", "handle"] }),
    cylinder("front", "Front Barrel", "body", "housing", "Transitions the main body toward the working end.", [48, -1, 0], [42, 40, 40], [88, 35, 0], bodyColor, "x", { rotation: [0, 0, -7], relatedKeys: ["output"] }),
    cylinder("output", "Working End", "front", "output", "Forms the tool or appliance output interface.", [78 + outputLength * 0.28, 1, 0], [outputLength, 26, 26], [145, 18, 0], dark, "x", { rotation: [0, 0, -7], relatedKeys: ["tip"] }),
    cylinder("tip", "Output Tip", "output", "output", "Represents the smaller end feature at the front of the object.", [102 + outputLength * 0.55, 1, 0], [longNozzle ? 28 : 46, longNozzle ? 15 : 7, longNozzle ? 15 : 7], [205, 12, 0], metal, "x", { rotation: [0, 0, -7], relatedKeys: ["output"] }),
    box("handle", "Angled Handle", "body", "grip", "Creates the pistol-grip or ergonomic handheld stance.", [-28, -55, 0], [36, 88, 40], [-25, -100, 0], bodyColor, { rotation: [0, 0, 18], relatedKeys: ["grip", "trigger"] }),
    box("grip", "Grip Surface", "handle", "grip", "Adds a narrower hand-contact surface to the handle.", [-30, -63, 0], [29, 70, 35], [-38, -138, 0], dark, { rotation: [0, 0, 18], relatedKeys: ["handle"] }),
    box("trigger", "Primary Control", "handle", "controls", "Places the main finger control beneath the body.", [-2, -29, 0], [15, 24, 17], [12, -42, 52], dark, { rotation: [0, 0, 10], relatedKeys: ["handle"] }),
    box("switch", "Secondary Control", "body", "controls", "Adds a small secondary control near the grip transition.", [5, -18, 0], [20, 8, 18], [25, 18, 55], "#59636c", { relatedKeys: ["trigger"], detail: true }),
    box("vent", "Vent Detail", "body", "cooling", "Breaks up the body shell with a small functional vent area.", [9, -2, -26], [30, 17, 4], [18, 38, -58], dark, { rotation: [0, 0, -7], detail: true }),
  ];

  if (hasBattery) {
    specs.push(
      box("powerBase", "Power Base", "handle", "power", "Provides a wider removable or integrated power base.", [-30, -111, 0], [58, 32, 52], [-28, -180, 0], dark, { relatedKeys: ["handle", "release"] }),
      box("release", "Release Latch", "powerBase", "hardware", "Small latch detail on the power base.", [-4, -111, 0], [12, 11, 22], [18, -188, 48], metal, { relatedKeys: ["powerBase"], detail: true }),
    );
  }

  return buildEverydayProject(titleFromPrompt(prompt), prompt, specs, options);
}

function panelProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const value = prompt.toLowerCase();
  const panelColor = colorFromPrompt(prompt, /solar/.test(value) ? "#315a77" : "#c6d1d8");
  const hasStand = /\b(collector|solar|sign|panel|display)\b/.test(value);
  const specs: EverydaySpec[] = [
    box("panel", "Primary Panel", undefined, "surface", "Defines the dominant thin rectangular surface.", [0, 0, 0], [205, 8, 112], [0, 80, 0], panelColor, { rotation: [0, 0, -18], relatedKeys: ["rear", "edge"] }),
    box("rear", "Rear Layer", "panel", "structure", "Adds backing, insulation, or enclosure depth behind the surface.", [0, -10, 7], [196, 22, 102], [0, -70, 28], "#647484", { rotation: [0, 0, -18], relatedKeys: ["panel"] }),
    box("edge", "Lower Edge Channel", "panel", "hardware", "Creates a functional lower rail, gutter, or trim channel.", [35, -59, 0], [190, 13, 18], [0, -105, 32], "#8b9eac", { rotation: [0, 0, -18], relatedKeys: ["panel"] }),
    box("module", "Mounted Module", "rear", "component", "Represents a compact attached module used by the panel assembly.", [45, -12, 58], [30, 18, 14], [75, 20, 95], "#3c82b1", { relatedKeys: ["rear"], detail: true }),
  ];
  if (hasStand) {
    specs.push(
      box("leftLeg", "Left Support", "rear", "support", "Supports the panel at an operating angle.", [-72, -92, -32], [15, 120, 15], [-115, -110, -55], "#4d5d69", { rotation: [0, 0, 12], relatedKeys: ["crossbar"] }),
      box("rightLeg", "Right Support", "rear", "support", "Supports the opposite side of the panel.", [62, -92, 32], [15, 120, 15], [110, -110, 55], "#4d5d69", { rotation: [0, 0, 12], relatedKeys: ["crossbar"] }),
      box("crossbar", "Support Crossbar", "rear", "support", "Stiffens the freestanding support structure.", [-5, -135, 0], [150, 12, 12], [0, -150, 0], "#566977", { relatedKeys: ["leftLeg", "rightLeg"], detail: true }),
    );
  }
  return buildEverydayProject(titleFromPrompt(prompt), prompt, specs, options);
}

function vesselProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const value = prompt.toLowerCase();
  const bodyColor = colorFromPrompt(prompt, "#5d8eaa");
  const tall = /\b(bottle|thermos|tank|canister)\b/.test(value);
  const height = tall ? 150 : 98;
  const width = tall ? 74 : 92;
  const specs: EverydaySpec[] = [
    cylinder("body", "Container Body", undefined, "container", "Defines the main hollow vessel silhouette.", [0, 0, 0], [width, height, width], [0, 55, 0], bodyColor, "y", { relatedKeys: ["neck", "base"] }),
    cylinder("neck", "Upper Neck", "body", "container", "Narrows the vessel toward its opening.", [0, height * 0.47, 0], [width * 0.58, 28, width * 0.58], [0, 115, 0], bodyColor, "y", { relatedKeys: ["cap"] }),
    cylinder("cap", "Cap or Rim", "neck", "closure", "Closes or finishes the vessel opening.", [0, height * 0.61, 0], [width * 0.64, 18, width * 0.64], [0, 160, 0], "#30383f", "y", { relatedKeys: ["neck"] }),
    cylinder("base", "Base Ring", "body", "support", "Provides a stable lower contact surface.", [0, -height * 0.51, 0], [width * 0.9, 12, width * 0.9], [0, -105, 0], "#45535e", "y", { relatedKeys: ["body"] }),
    box("label", "Surface Detail", "body", "surface", "Adds a small front-facing label or control area.", [0, 0, width * 0.51], [width * 0.5, height * 0.3, 3], [0, 0, 95], "#d4dde2", { detail: true }),
  ];
  if (/\b(mug|cup|kettle)\b/.test(value)) {
    specs.push(box("handle", "Side Handle", "body", "grip", "Provides a side grip for lifting the vessel.", [width * 0.62, 2, 0], [22, height * 0.55, 18], [95, 0, 0], "#4b5964", { relatedKeys: ["body"] }));
  }
  return buildEverydayProject(titleFromPrompt(prompt), prompt, specs, options);
}

function hingedProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const bodyColor = colorFromPrompt(prompt, "#667d8d");
  const specs: EverydaySpec[] = [
    box("base", "Lower Base", undefined, "structure", "Forms the stable lower half of a hinged mechanism.", [0, -28, 0], [150, 22, 48], [0, -85, 0], "#414c55", { relatedKeys: ["hinge", "upper"] }),
    box("upper", "Upper Arm", "base", "mechanism", "Forms the moving upper half of the hinged object.", [5, 2, 0], [142, 24, 42], [0, 105, 0], bodyColor, { rotation: [0, 0, -8], relatedKeys: ["hinge", "contact"] }),
    cylinder("hinge", "Pivot Hinge", "base", "mechanism", "Joins the upper arm to the base around a pivot.", [-66, -15, 0], [22, 44, 44], [-120, 0, 0], "#aeb8c0", "x", { relatedKeys: ["base", "upper"] }),
    box("contact", "Working Contact", "upper", "output", "Creates the small functional contact area at the front.", [67, -5, 0], [15, 26, 30], [118, 70, 0], "#2f363b", { relatedKeys: ["upper", "base"] }),
    box("spring", "Return Element", "hinge", "mechanism", "Represents the compact return spring or spacer near the pivot.", [-42, -7, 0], [22, 13, 20], [-72, 52, 0], "#c3a35c", { detail: true }),
  ];
  return buildEverydayProject(titleFromPrompt(prompt), prompt, specs, options);
}

function addSpatial(purpose: string, spatial: string) {
  return `${purpose} Spatial relationship: ${spatial}.`;
}

function hasCoreGenericFallback(project: ForgeProject) {
  const names = new Set(project.parts.map((part) => part.name));
  return (
    names.has("Main Frame") &&
    names.has("Outer Body") &&
    names.has("Drive Core") &&
    names.has("Control Module") &&
    names.has("Output Module")
  );
}

function windowAcSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#d9dde0");
  const dark = "#2f363b";
  const metal = "#8fa1aa";
  return [
    box("cabinet", "Sleeve Cabinet", undefined, "housing", addSpatial("Forms the rectangular wall sleeve around the air conditioner.", "surrounding the internal thermal path and bridging room-side front to outdoor rear"), [0, 0, 0], [190, 82, 112], [0, 0, -135], body, { relatedKeys: ["frontGrille", "condenserCoil", "mountRail"] }),
    box("frontGrille", "Front Intake Grille", "cabinet", "input", addSpatial("Admits room air into the unit.", "attached to the front face, outside the filter"), [0, 0, 61], [178, 62, 7], [0, 0, 118], dark, { relatedKeys: ["airFilter", "blowerFan"] }),
    box("airFilter", "Slide-Out Air Filter", "frontGrille", "input", addSpatial("Captures dust before air reaches the cold coil.", "inside the front grille and in front of the evaporator coil"), [0, -1, 52], [160, 49, 5], [-115, 0, 88], "#cdd6db", { relatedKeys: ["evaporatorCoil"], detail: true }),
    box("evaporatorCoil", "Evaporator Coil", "cabinet", "thermal", addSpatial("Absorbs heat from indoor air.", "behind the filter, above the condensate tray, and connected to the compressor"), [-34, 4, 31], [78, 58, 11], [-84, 32, 55], "#74a7bd", { relatedKeys: ["compressor", "blowerFan"] }),
    cylinder("blowerFan", "Crossflow Blower Fan", "cabinet", "motion", addSpatial("Pulls room air through the filter and pushes cooled air out.", "mounted horizontally behind the front grille and below the control panel"), [38, -5, 34], [92, 20, 20], [88, -16, 65], "#56636b", "x", { relatedKeys: ["frontGrille", "evaporatorCoil"] }),
    cylinder("compressor", "Sealed Compressor", "cabinet", "power", addSpatial("Compresses refrigerant for the cooling loop.", "inside the lower rear compartment and connected between both coils"), [-48, -26, -24], [44, 44, 48], [-96, -72, -42], "#30383f", "y", { relatedKeys: ["evaporatorCoil", "condenserCoil"] }),
    box("condenserCoil", "Rear Condenser Coil", "cabinet", "thermal", addSpatial("Rejects absorbed heat outdoors.", "at the back face, behind the compressor and in front of the exhaust louvers"), [34, 1, -53], [86, 58, 10], [96, 16, -112], metal, { relatedKeys: ["compressor", "rearLouver"] }),
    box("rearLouver", "Rear Exhaust Louver", "cabinet", "output", addSpatial("Lets hot air leave the outdoor side.", "attached outside the rear face behind the condenser coil"), [0, 0, -64], [178, 64, 7], [0, 0, -166], dark, { relatedKeys: ["condenserCoil"] }),
    box("controlPanel", "Control Panel", "frontGrille", "control", addSpatial("Houses buttons, display, and thermostat controls.", "on the upper front edge, above the blower outlet"), [63, 31, 66], [52, 16, 8], [106, 78, 122], "#3b7799", { relatedKeys: ["blowerFan"], detail: true }),
    box("mountRail", "Side Mounting Rails", "cabinet", "support", addSpatial("Supports the cabinet in a window opening.", "attached along both lower outside edges"), [0, -50, 0], [206, 12, 122], [0, -118, 0], "#788690", { relatedKeys: ["cabinet"], detail: true }),
  ];
}

function isCordedPrompt(prompt: string) {
  return /\b(corded|corded\s+electric|plug[- ]?in|mains powered|power cord|with a cord)\b/i.test(prompt);
}

function isCordlessPrompt(prompt: string) {
  return /\b(cordless|battery[- ]?powered|battery pack|rechargeable)\b/i.test(prompt) && !isCordedPrompt(prompt);
}

function drillSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#d2a237");
  const dark = "#2d3338";
  const metal = "#aeb8c0";
  const corded = isCordedPrompt(prompt);
  const cordless = isCordlessPrompt(prompt);
  const powerKeys = corded ? ["cordRelief"] : cordless ? ["batteryPack"] : ["powerInlet"];
  const specs: EverydaySpec[] = [
    box("housing", "Drill Motor Housing", undefined, "housing", addSpatial("Contains the motor and gears in a pistol-shaped body.", "above the handle and behind the chuck"), [-12, 8, 0], [102, 48, 46], [0, 70, 0], body, { rotation: [0, 0, -6], relatedKeys: ["gearbox", "handle"] }),
    cylinder("gearbox", "Front Gearbox Collar", "housing", "motion", addSpatial("Steps motor speed down before the chuck.", "concentric with the chuck at the front of the housing"), [49, 10, 0], [34, 38, 38], [93, 42, 0], metal, "x", { rotation: [0, 0, -6], relatedKeys: ["chuck", "motor"] }),
    cylinder("chuck", "Keyless Chuck", "gearbox", "output", addSpatial("Clamps the drill bit at the working end.", "attached to the front of the gearbox and coaxial with the bit"), [82, 10, 0], [37, 24, 24], [158, 24, 0], dark, "x", { rotation: [0, 0, -6], relatedKeys: ["bit"] }),
    cylinder("bit", "Drill Bit", "chuck", "output", addSpatial("Represents the removable cutting tool.", "projecting forward from the chuck"), [119, 10, 0], [50, 6, 6], [220, 12, 0], metal, "x", { rotation: [0, 0, -6], detail: true }),
    cylinder("motor", "Electric Motor", "housing", "power", addSpatial("Provides rotary drive for drilling.", "inside the rear housing and connected to the gearbox"), [-18, 8, 0], [48, 28, 28], [-54, 18, 0], "#59646c", "x", { relatedKeys: ["gearbox", ...powerKeys], detail: true }),
    box("handle", "Angled Grip Handle", "housing", "support", addSpatial("Positions the hand below the motor body.", "below and slightly behind the housing"), [-32, -46, 0], [34, 84, 38], [-38, -106, 0], body, { rotation: [0, 0, 16], relatedKeys: ["trigger", ...powerKeys] }),
    box("trigger", "Variable-Speed Trigger", "handle", "control", addSpatial("Controls motor speed with finger pressure.", "inside the front of the handle, below the housing"), [-7, -27, 0], [13, 25, 16], [14, -46, 50], dark, { rotation: [0, 0, 11], relatedKeys: ["motor"] }),
    box("vent", "Cooling Vents", "housing", "thermal", addSpatial("Lets motor heat escape.", "on the side wall beside the hidden motor"), [3, 12, -26], [34, 16, 4], [24, 42, -58], "#22282d", { detail: true }),
  ];
  if (corded) {
    specs.push(
      box("cordRelief", "Cord Strain Relief", "handle", "electrical", addSpatial("Protects the mains cable where it enters the drill.", "attached to the bottom rear of the handle and connected to the motor wiring"), [-48, -86, -1], [18, 22, 20], [-80, -150, -25], dark, { relatedKeys: ["cord", "motor"] }),
      cylinder("cord", "Power Cord", "cordRelief", "electrical", addSpatial("Carries external electrical power.", "trailing out behind the handle instead of attaching as a battery"), [-88, -102, -4], [92, 8, 8], [-168, -182, -30], "#171d22", "x", { rotation: [0, 0, -24], relatedKeys: ["plug"] }),
      box("plug", "Two-Prong Plug", "cord", "electrical", addSpatial("Connects the corded drill to a wall outlet.", "at the free end of the power cord behind the tool"), [-136, -122, -4], [24, 18, 16], [-235, -215, -32], "#20272d", { relatedKeys: ["cord"], detail: true }),
    );
  } else if (cordless) {
    specs.push(box("batteryPack", "Slide-On Battery Pack", "handle", "power", addSpatial("Supplies removable cordless power.", "attached below the handle as the lowest mass"), [-30, -101, 0], [61, 31, 54], [-30, -176, 0], dark, { relatedKeys: ["handle", "motor"] }));
  } else {
    specs.push(box("powerInlet", "Power Inlet Module", "handle", "electrical", addSpatial("Represents the electrical feed for the drill.", "inside the handle base and connected to the motor"), [-35, -95, 0], [42, 20, 36], [-44, -164, 0], dark, { relatedKeys: ["handle", "motor"], detail: true }));
  }
  return specs;
}

function coffeeMakerSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#48545d");
  if (hasNegativeConstraint(prompt, /\b(normal|regular|drip|pot|pot of joe|carafe|glass carafe|warming plate|brew basket)\b/)) {
    return [
      box("body", "Sculpted Espresso Body", undefined, "housing", addSpatial("Forms a premium non-drip beverage appliance body.", "behind the group head and surrounding the pump and thermoblock"), [0, 10, 0], [112, 132, 76], [0, 70, -84], body, { relatedKeys: ["reservoir", "pump", "groupHead"] }),
      box("reservoir", "Slim Water Reservoir", "body", "fluid", addSpatial("Stores brew water without using a carafe.", "inside the rear vertical body behind the thermoblock"), [-39, 30, -15], [34, 82, 42], [-92, 68, -52], "#7fa9be", { relatedKeys: ["pump", "thermoblock"] }),
      cylinder("pump", "Pressure Pump", "body", "fluid", addSpatial("Pressurizes water for espresso-style extraction.", "low inside the body and connected between reservoir and thermoblock"), [-28, -36, -6], [48, 24, 24], [-88, -88, -18], "#56636b", "x", { relatedKeys: ["reservoir", "thermoblock"] }),
      cylinder("thermoblock", "Thermoblock Heater", "body", "thermal", addSpatial("Heats pressurized water on demand.", "inside the center body above the pump and before the group head"), [8, -13, 1], [52, 18, 18], [20, -58, 20], "#b77442", "x", { relatedKeys: ["pump", "groupHead"], detail: true }),
      cylinder("groupHead", "Portafilter Group Head", "body", "output", addSpatial("Delivers coffee directly into a cup.", "projecting from the front face above the cup tray"), [38, 7, 45], [42, 28, 28], [104, 18, 104], "#c0c9cf", "z", { relatedKeys: ["portafilter", "cupTray"] }),
      box("portafilter", "Portafilter Handle", "groupHead", "input", addSpatial("Holds grounds at the brew outlet.", "locked under the group head and extending forward"), [53, -8, 64], [62, 12, 16], [138, -15, 142], "#2f363b", { relatedKeys: ["groupHead"] }),
      cylinder("steamWand", "Steam Wand", "body", "output", addSpatial("Froths milk beside the brew outlet.", "attached to the front side and hanging below the control panel"), [-42, 2, 47], [64, 7, 7], [-106, 10, 110], "#c0c9cf", "y", { rotation: [0, 0, -18], relatedKeys: ["thermoblock"] }),
      box("cupTray", "Perforated Cup Tray", "body", "support", addSpatial("Supports a cup directly under the group head.", "on the lower front base below the portafilter"), [26, -61, 47], [82, 10, 52], [66, -132, 110], "#20272c", { relatedKeys: ["groupHead"] }),
      box("controlPanel", "Brew Mode Controls", "body", "control", addSpatial("Selects extraction and steam modes.", "on the upper front face above the group head"), [-18, 45, 43], [62, 23, 7], [-52, 104, 96], "#3d7795", { relatedKeys: ["pump"], detail: true }),
    ];
  }
  return [
    box("housing", "Countertop Brewer Housing", undefined, "housing", addSpatial("Forms the upright body of the coffee maker.", "behind the carafe and surrounding the heating and water path"), [0, 14, 0], [118, 142, 78], [0, 70, -86], body, { relatedKeys: ["reservoir", "brewBasket", "warmingPlate"] }),
    box("reservoir", "Water Reservoir", "housing", "fluid", addSpatial("Stores incoming water before brewing.", "inside the rear upper housing above the heater tube"), [-33, 42, -12], [42, 76, 46], [-85, 82, -50], "#7fa9be", { relatedKeys: ["heater", "brewBasket"] }),
    cylinder("heater", "Heating Element", "housing", "thermal", addSpatial("Heats water before it rises to the brew head.", "below the reservoir and inside the base"), [-31, -43, 0], [60, 12, 12], [-72, -92, 0], "#b77442", "x", { relatedKeys: ["reservoir", "warmingPlate"], detail: true }),
    box("brewBasket", "Brew Basket", "housing", "input", addSpatial("Holds the filter and ground coffee.", "front upper bay above the carafe mouth"), [24, 37, 44], [60, 34, 28], [74, 74, 90], "#2f363b", { relatedKeys: ["dripSpout", "carafe"] }),
    cylinder("dripSpout", "Drip Spout", "brewBasket", "output", addSpatial("Directs brewed coffee downward.", "below the brew basket and above the carafe opening"), [24, 12, 55], [18, 8, 8], [75, 20, 128], "#c0c9cf", "y", { relatedKeys: ["carafe"] }),
    box("warmingPlate", "Warming Plate", "housing", "thermal", addSpatial("Keeps the carafe warm.", "on the lower front base directly below the carafe"), [22, -53, 42], [76, 9, 58], [55, -116, 78], "#20272c", { relatedKeys: ["carafe", "heater"] }),
    box("carafe", "Glass Carafe", "warmingPlate", "vessel", addSpatial("Collects brewed coffee.", "outside the front housing, sitting on the warming plate"), [22, -17, 47], [70, 62, 52], [82, -28, 122], "#adc8d4", { relatedKeys: ["handle", "dripSpout"] }),
    box("handle", "Carafe Handle", "carafe", "support", addSpatial("Provides a grip for pouring.", "attached to the outside right side of the carafe"), [63, -17, 47], [18, 48, 14], [134, -18, 118], "#2f363b", { relatedKeys: ["carafe"] }),
    box("controlPanel", "Brew Control Panel", "housing", "control", addSpatial("Houses buttons and indicators.", "on the front face beside the brew basket"), [-31, 3, 43], [38, 24, 7], [-70, 5, 96], "#3d7795", { detail: true }),
  ];
}

function negativeText(prompt: string) {
  const matches = prompt.toLowerCase().match(/\b(?:not|without|no|instead of)\b[^,.;]*/g);
  return matches?.join(" ") ?? "";
}

function hasNegativeConstraint(prompt: string, pattern: RegExp) {
  return pattern.test(negativeText(prompt));
}

type SemanticFamily =
  | "thermalAppliance"
  | "poweredHandTool"
  | "beverageAppliance"
  | "printer"
  | "pump"
  | "blender"
  | "pairedWearable"
  | "elongatedHandTool"
  | "mechanicalSubassembly"
  | "lightingFixture"
  | "loopObject"
  | "genericAssembly";

interface SemanticPlan {
  family: SemanticFamily;
  name: string;
  subject: string;
  corePrompt?: string;
}

function semanticPlan(prompt: string): SemanticPlan {
  const value = prompt.toLowerCase();
  const title = titleFromPrompt(prompt);
  if (/\b(window|room|portable)?\s*(unit\s*)?(air\s*conditioner|ac\b|a\/c|hvac)\b/.test(value)) return { family: "thermalAppliance", name: title, subject: "air conditioner" };
  if (/\b(cordless\s*)?(drill|driver|power\s*drill)\b/.test(value)) return { family: "poweredHandTool", name: title, subject: "drill" };
  if (/\b(coffee\s*maker|coffee\s*machine|espresso|brewer|drip\s*coffee)\b/.test(value)) return { family: "beverageAppliance", name: title, subject: "coffee maker" };
  if (/\b(desktop\s*)?(printer|scanner\s*printer|inkjet|laser\s*printer)\b/.test(value)) return { family: "printer", name: title, subject: "printer" };
  if (/\b(blender|food\s*processor|smoothie\s*maker)\b/.test(value)) return { family: "blender", name: title, subject: "blender" };
  if (/\b(bicycle|bike)?\s*(pump|floor\s*pump|tire\s*pump)|drain\s+pump|water\s+pump|fuel\s+pump\b/.test(value)) return { family: "pump", name: title, subject: "pump" };
  if (/\b(transmission|gearbox|differential|clutch|reducer|drive\s+unit|motor\s+assembly|pump\s+assembly|valve\s+body)\b/.test(value)) return { family: "mechanicalSubassembly", name: title, subject: "subassembly" };
  if (/\b(eye\s*glasses|eyeglasses|spectacles|sunglasses|goggles|glasses)\b/.test(value)) return { family: "pairedWearable", name: title, subject: "eyewear" };
  if (/\b(wrench|spanner|screwdriver|ratchet|chisel|file|scraper|pry\s*bar|hand\s+tool)\b/.test(value)) return { family: "elongatedHandTool", name: title, subject: "hand tool" };
  if (/\b(lamp|light|sconce|lantern)\b/.test(value)) return { family: "lightingFixture", name: title, subject: "lamp", corePrompt: "lamp" };
  if (/\b(hoop|ring|loop|gasket|bracelet)\b/.test(value)) return { family: "loopObject", name: title, subject: "loop" };
  return { family: "genericAssembly", name: title, subject: title.toLowerCase() };
}

function eyewearSpecs(prompt: string): EverydaySpec[] {
  const frame = colorFromPrompt(prompt, "#30353a");
  const lens = /sunglasses|tinted|dark/i.test(prompt) ? "#59666f" : "#a8c7d6";
  return [
    cylinder("leftLens", "Left Lens", undefined, "output", addSpatial("Provides the left optical surface.", "left of the bridge and matching the right lens bilaterally"), [-43, 5, 0], [52, 34, 5], [-96, 18, 0], lens, "z", { relatedKeys: ["bridge", "leftRim"] }),
    cylinder("rightLens", "Right Lens", undefined, "output", addSpatial("Provides the right optical surface.", "right of the bridge and matching the left lens bilaterally"), [43, 5, 0], [52, 34, 5], [96, 18, 0], lens, "z", { relatedKeys: ["bridge", "rightRim"] }),
    cylinder("leftRim", "Left Rim", "leftLens", "structure", addSpatial("Frames and protects the left lens.", "surrounding the left lens on the outside edge"), [-43, 5, -1], [62, 42, 6], [-118, 42, -15], frame, "z", { relatedKeys: ["leftLens", "bridge"] }),
    cylinder("rightRim", "Right Rim", "rightLens", "structure", addSpatial("Frames and protects the right lens.", "surrounding the right lens on the outside edge"), [43, 5, -1], [62, 42, 6], [118, 42, -15], frame, "z", { relatedKeys: ["rightLens", "bridge"] }),
    box("bridge", "Nose Bridge", undefined, "support", addSpatial("Joins the two lens rims.", "centered between left and right lenses above the nose pads"), [0, 5, 0], [26, 9, 8], [0, 56, 0], frame, { relatedKeys: ["leftRim", "rightRim", "nosePads"] }),
    box("leftTemple", "Left Temple Arm", "leftRim", "support", addSpatial("Holds the frame on the left ear.", "hinged to the outside of the left rim and extending backward"), [-82, 3, -43], [78, 7, 8], [-175, 4, -86], frame, { rotation: [0, -18, 0], relatedKeys: ["leftRim"] }),
    box("rightTemple", "Right Temple Arm", "rightRim", "support", addSpatial("Holds the frame on the right ear.", "hinged to the outside of the right rim and extending backward"), [82, 3, -43], [78, 7, 8], [175, 4, -86], frame, { rotation: [0, 18, 0], relatedKeys: ["rightRim"] }),
    box("nosePads", "Paired Nose Pads", "bridge", "support", addSpatial("Rest the glasses on the nose.", "below the bridge and between both lenses"), [0, -17, 6], [22, 12, 6], [0, -62, 42], "#d6dde1", { relatedKeys: ["bridge"], detail: true }),
  ];
}

function elongatedToolSpecs(prompt: string): EverydaySpec[] {
  const metal = colorFromPrompt(prompt, "#9aa5ad");
  const dark = "#30363c";
  const isScrew = /\b(screwdriver|driver)\b/i.test(prompt);
  return [
    box("handle", isScrew ? "Long Grip Handle" : "Slim Handle Beam", undefined, "support", addSpatial("Creates the long hand-tool leverage body.", "between the working end and the rear end, much longer than it is tall"), [0, 0, 0], [178, 16, 18], [0, 0, 0], isScrew ? dark : metal, { relatedKeys: ["frontHead", "rearEnd"] }),
    box("neck", "Tapered Neck", "handle", "structure", addSpatial("Narrows the handle into the working head.", "attached to the front of the elongated handle"), [88, 0, 0], [38, 12, 15], [126, 20, 0], metal, { relatedKeys: ["frontHead"] }),
    cylinder("frontHead", isScrew ? "Driver Tip" : "Open Jaw Head", "neck", "output", addSpatial("Provides the primary working contact.", "at the front end of the tool, aligned with the handle"), [119, 0, 0], [42, isScrew ? 8 : 36, isScrew ? 8 : 13], [205, 32, 0], metal, "x", { relatedKeys: ["neck"] }),
    cylinder("rearEnd", isScrew ? "Rear Cap" : "Box End Ring", "handle", "output", addSpatial("Adds a secondary working or hanging feature.", "at the rear end opposite the main head"), [-94, 0, 0], [32, isScrew ? 22 : 34, isScrew ? 22 : 8], [-175, -25, 0], metal, isScrew ? "x" : "z", { relatedKeys: ["handle"] }),
    box("gripTexture", "Grip Texture Flats", "handle", "grip", addSpatial("Improves hand contact.", "on the upper and lower faces along the center handle"), [-18, 0, 11], [82, 4, 4], [-40, 34, 48], dark, { relatedKeys: ["handle"], detail: true }),
  ];
}

function mechanicalSubassemblySpecs(prompt: string): EverydaySpec[] {
  const value = prompt.toLowerCase();
  const title = titleFromPrompt(prompt).replace(/\b(Car|Auto|Vehicle)\s+/i, "");
  const casingName = /\b(transmission|gearbox|reducer)\b/.test(value) ? "Transmission Gear Case" : `${title} Housing`;
  return [
    box("case", casingName, undefined, "housing", addSpatial("Contains the requested mechanical subsystem only.", "surrounding internal shafts and gears without expanding into the parent machine"), [0, 0, 0], [118, 58, 74], [0, 0, -92], "#6b747c", { relatedKeys: ["inputShaft", "outputShaft", "gearCluster"] }),
    cylinder("inputShaft", "Input Shaft", "case", "motion", addSpatial("Receives rotation from the upstream machine.", "projecting from the front-left side of the subsystem case"), [-68, 3, 0], [62, 12, 12], [-132, 12, 0], "#b5bec5", "x", { relatedKeys: ["gearCluster"] }),
    cylinder("outputShaft", "Output Shaft", "case", "motion", addSpatial("Sends rotation out of the subsystem.", "projecting from the opposite side of the case and coaxial with the gear train"), [70, -2, 0], [68, 14, 14], [142, -6, 0], "#c0c8ce", "x", { relatedKeys: ["gearCluster"] }),
    cylinder("gearCluster", "Gear Cluster", "case", "motion", addSpatial("Represents meshing reduction elements.", "inside the case between input and output shafts"), [0, 0, 2], [50, 48, 26], [0, 62, 26], "#d19a48", "z", { relatedKeys: ["inputShaft", "outputShaft"] }),
    box("mountFlange", "Mounting Flange", "case", "support", addSpatial("Bolts the subsystem to its parent machine.", "around the outer case perimeter rather than forming the whole parent"), [0, -35, 0], [132, 12, 86], [0, -104, 0], "#505b64", { relatedKeys: ["case"] }),
    box("sensorConnector", "Electrical Connector", "case", "control", addSpatial("Carries control or sensor signals.", "attached to the outside top of the case"), [-28, 36, 33], [34, 18, 16], [-78, 92, 68], "#2f7896", { relatedKeys: ["case"], detail: true }),
  ];
}

function lightingFixtureSpecs(prompt: string): EverydaySpec[] {
  const core = createCoreForgeProject("lamp");
  return core.parts.map((part, index) => ({
    key: part.id,
    name: part.name,
    kind: part.kind,
    axis: part.axis,
    parentKey: index === 0 ? undefined : core.parts.find((candidate) => candidate.id === part.parent)?.id,
    category: part.category,
    purpose: addSpatial(part.purpose, "arranged as a lamp fixture, not as furniture"),
    position: part.position,
    size: part.size,
    rotation: part.rotation,
    explode: part.explode,
    relatedKeys: part.related,
    color: part.color,
  }));
}

function loopObjectSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#667d8d");
  const specs: EverydaySpec[] = [
    cylinder("frontArc", "Front Curved Segment", undefined, "structure", addSpatial("Forms the front part of the circular silhouette.", "attached around the loop perimeter and concentric with the rear segment"), [0, 0, 58], [126, 9, 9], [0, 0, 142], body, "x", { relatedKeys: ["rearArc", "leftArc", "rightArc"] }),
    cylinder("rearArc", "Rear Curved Segment", undefined, "structure", addSpatial("Forms the rear part of the circular silhouette.", "opposite the front segment around the loop perimeter"), [0, 0, -58], [126, 9, 9], [0, 0, -142], body, "x", { relatedKeys: ["frontArc"] }),
    cylinder("leftArc", "Left Curved Segment", undefined, "structure", addSpatial("Completes the left side of the loop.", "connected between front and rear segments"), [-58, 0, 0], [126, 9, 9], [-142, 0, 0], body, "z", { relatedKeys: ["frontArc", "rearArc"] }),
    cylinder("rightArc", "Right Curved Segment", undefined, "structure", addSpatial("Completes the right side of the loop.", "connected between front and rear segments"), [58, 0, 0], [126, 9, 9], [142, 0, 0], body, "z", { relatedKeys: ["frontArc", "rearArc"] }),
    cylinder("surfaceMark", "Alignment Mark", "frontArc", "surface", addSpatial("Adds a small visible orientation detail.", "on the outside front segment"), [0, 8, 64], [26, 5, 5], [0, 44, 160], "#cbd4da", "x", { detail: true }),
  ];
  return specs;
}

function generalSemanticSpecs(prompt: string): EverydaySpec[] {
  const name = titleFromPrompt(prompt);
  const body = colorFromPrompt(prompt, "#6e7d88");
  const lower = name.toLowerCase();
  return [
    box("primaryStructure", `${name} Primary Structure`, undefined, "structure", addSpatial(`Defines the main load path for the ${lower}.`, "scaled from the inferred subject rather than a universal outer box"), [0, 0, 0], [132, 38, 48], [0, 0, -82], body, { relatedKeys: ["workingCore", "interfaceA", "interfaceB"] }),
    cylinder("workingCore", `${name} Working Core`, "primaryStructure", "motion", addSpatial(`Represents the central functional mechanism of the ${lower}.`, "inside or attached to the main structure according to the object's role"), [-16, 0, 0], [54, 26, 26], [-74, 12, 0], "#d19a48", "x", { relatedKeys: ["interfaceA", "interfaceB"] }),
    box("interfaceA", `${name} Input Interface`, "primaryStructure", "input", addSpatial(`Shows where force, material, or user intent enters the ${lower}.`, "attached near one end of the primary structure"), [-68, 8, 28], [38, 22, 8], [-124, 42, 80], "#cbd4da", { relatedKeys: ["workingCore"] }),
    box("interfaceB", `${name} Output Interface`, "primaryStructure", "output", addSpatial(`Shows where the ${lower} produces its result.`, "attached near the opposite end and connected from the core"), [66, -4, 28], [42, 24, 8], [126, -24, 82], "#b5c4cc", { relatedKeys: ["workingCore"] }),
    box("serviceMount", `${name} Service Mount`, "primaryStructure", "fastener", addSpatial(`Provides attachment or service access for the ${lower}.`, "on the outside surface near a structural edge"), [0, -26, 0], [74, 9, 34], [0, -86, 0], "#424c55", { relatedKeys: ["primaryStructure"], detail: true }),
  ];
}

function printerSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#d5d9dc");
  const dark = "#343b42";
  return [
    box("chassis", "Printer Chassis", undefined, "housing", addSpatial("Forms the low rectangular desktop printer body.", "surrounding the paper path from lower front tray to upper output tray"), [0, 0, 0], [190, 62, 128], [0, 0, -120], body, { relatedKeys: ["paperTray", "scannerLid", "outputTray"] }),
    box("paperTray", "Front Paper Tray", "chassis", "input", addSpatial("Feeds blank paper into the machine.", "sliding out from the lower front face"), [0, -29, 76], [158, 18, 74], [0, -64, 148], "#bcc5ca", { relatedKeys: ["feedRoller"] }),
    cylinder("feedRoller", "Paper Feed Roller", "chassis", "motion", addSpatial("Pulls sheets from the tray through the print path.", "inside the lower front bay above the paper tray"), [0, -15, 38], [136, 13, 13], [0, -38, 82], dark, "x", { relatedKeys: ["paperTray", "printHead"] }),
    box("printHead", "Print Head Carriage", "chassis", "output", addSpatial("Moves ink across the page.", "inside the middle bay spanning left to right above the paper path"), [0, 2, 10], [118, 22, 20], [0, 18, 58], "#52606a", { relatedKeys: ["inkCartridge", "feedRoller"] }),
    box("inkCartridge", "Ink Cartridge Set", "printHead", "fluid", addSpatial("Stores colored ink for the print head.", "mounted on top of the moving print head carriage"), [36, 18, 10], [48, 20, 22], [76, 48, 60], "#2e6f93", { relatedKeys: ["printHead"] }),
    box("outputTray", "Output Tray", "chassis", "output", addSpatial("Catches printed sheets.", "extending from the upper front face above the input tray"), [0, 18, 86], [154, 11, 72], [0, 64, 155], "#aeb8be", { relatedKeys: ["paperTray"] }),
    box("scannerLid", "Flatbed Scanner Lid", "chassis", "structure", addSpatial("Covers the scanner glass on multifunction printers.", "hinged on the top surface above the chassis"), [0, 40, -5], [182, 16, 118], [0, 112, -15], "#eef1f2", { relatedKeys: ["hinge"] }),
    cylinder("hinge", "Rear Lid Hinge", "scannerLid", "motion", addSpatial("Lets the scanner lid open.", "along the rear edge of the top lid"), [0, 32, -70], [168, 10, 10], [0, 74, -132], dark, "x", { relatedKeys: ["scannerLid"], detail: true }),
    box("controlPanel", "Status Control Panel", "chassis", "control", addSpatial("Shows printer status and accepts controls.", "on the upper front right corner"), [64, 39, 66], [48, 12, 18], [110, 91, 122], "#3b7894", { detail: true }),
  ];
}

function pumpSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#5f7f92");
  const dark = "#293138";
  return [
    cylinder("barrel", "Pump Barrel", undefined, "fluid", addSpatial("Compresses air as the plunger moves.", "vertical center tube between the base and handle"), [0, 5, 0], [36, 144, 36], [0, 20, 0], body, "y", { relatedKeys: ["plungerRod", "baseFoot", "hose"] }),
    cylinder("plungerRod", "Plunger Rod", "barrel", "motion", addSpatial("Transfers handle motion into the barrel.", "concentric inside the pump barrel and extending above it"), [0, 83, 0], [12, 120, 12], [0, 146, 0], "#b7c0c6", "y", { relatedKeys: ["handle", "barrel"] }),
    box("handle", "T-Handle Grip", "plungerRod", "support", addSpatial("Gives both hands leverage for pumping.", "attached across the top of the plunger rod"), [0, 148, 0], [112, 18, 24], [0, 222, 0], dark, { relatedKeys: ["plungerRod"] }),
    box("baseFoot", "Wide Base Foot", "barrel", "support", addSpatial("Stabilizes the pump under foot pressure.", "attached below the vertical barrel at floor level"), [0, -78, 0], [118, 12, 54], [0, -144, 0], dark, { relatedKeys: ["barrel"] }),
    cylinder("hose", "Flexible Air Hose", "barrel", "fluid", addSpatial("Carries compressed air to the tire valve.", "connected near the lower barrel and curving outward to the side"), [54, -42, 0], [72, 9, 9], [124, -82, 35], "#20262b", "x", { rotation: [0, 0, -22], relatedKeys: ["valveChuck"] }),
    cylinder("valveChuck", "Valve Chuck", "hose", "fastener", addSpatial("Locks onto a bicycle tire valve.", "attached to the free end of the hose"), [98, -70, 0], [24, 15, 15], [178, -122, 46], "#c4a24d", "x", { relatedKeys: ["hose"] }),
    cylinder("gauge", "Pressure Gauge", "barrel", "control", addSpatial("Displays tire pressure during pumping.", "mounted on the front of the lower barrel"), [0, -37, 22], [34, 10, 34], [0, -72, 72], "#e6edf0", "z", { relatedKeys: ["barrel"], detail: true }),
  ];
}

function blenderSpecs(prompt: string): EverydaySpec[] {
  const base = colorFromPrompt(prompt, "#656f77");
  return [
    box("motorBase", "Motor Base", undefined, "power", addSpatial("Houses the electric motor and supports the pitcher.", "below the pitcher and surrounding the drive coupler"), [0, -48, 0], [104, 64, 86], [0, -126, 0], base, { relatedKeys: ["pitcher", "controlPanel", "driveCoupler"] }),
    cylinder("driveCoupler", "Drive Coupler", "motorBase", "motion", addSpatial("Transfers motor torque into the blades.", "centered on top of the base and concentric with the blade hub"), [0, -10, 0], [34, 16, 34], [0, -34, 0], "#2b333a", "y", { relatedKeys: ["bladeAssembly"] }),
    box("pitcher", "Clear Pitcher Jar", "motorBase", "vessel", addSpatial("Contains ingredients during blending.", "above the motor base and surrounding the blade assembly"), [0, 35, 0], [92, 112, 78], [0, 76, 0], "#9dc2d1", { relatedKeys: ["bladeAssembly", "lid", "jarHandle"] }),
    cylinder("bladeAssembly", "Blade Assembly", "pitcher", "output", addSpatial("Chops and circulates contents.", "inside the bottom of the pitcher and attached to the drive coupler"), [0, -10, 0], [58, 8, 58], [0, 5, 0], "#c0c8ce", "y", { relatedKeys: ["driveCoupler"], detail: true }),
    box("lid", "Pitcher Lid", "pitcher", "housing", addSpatial("Closes the top of the jar.", "attached above the pitcher opening"), [0, 98, 0], [98, 14, 82], [0, 166, 0], "#2c3339", { relatedKeys: ["capPlug"] }),
    cylinder("capPlug", "Center Cap Plug", "lid", "input", addSpatial("Lets ingredients be added through the lid.", "concentric in the top lid"), [0, 109, 0], [30, 12, 30], [0, 196, 0], "#444d55", "y", { detail: true }),
    box("jarHandle", "Pitcher Handle", "pitcher", "support", addSpatial("Provides a side grip for lifting and pouring.", "attached to the outside right wall of the pitcher"), [58, 35, 0], [18, 74, 20], [118, 72, 0], "#2f363b", { relatedKeys: ["pitcher"] }),
    box("controlPanel", "Speed Control Panel", "motorBase", "control", addSpatial("Selects blending speeds.", "on the front face of the motor base"), [0, -43, 48], [58, 24, 7], [0, -94, 106], "#3b7894", { relatedKeys: ["motorBase"], detail: true }),
  ];
}

function inferGeneralUnknownSpecs(prompt: string): EverydaySpec[] {
  const plan = semanticPlan(prompt);
  switch (plan.family) {
    case "thermalAppliance":
      return windowAcSpecs(prompt);
    case "poweredHandTool":
      return drillSpecs(prompt);
    case "beverageAppliance":
      return coffeeMakerSpecs(prompt);
    case "printer":
      return printerSpecs(prompt);
    case "pump":
      return pumpSpecs(prompt);
    case "blender":
      return blenderSpecs(prompt);
    case "pairedWearable":
      return eyewearSpecs(prompt);
    case "elongatedHandTool":
      return elongatedToolSpecs(prompt);
    case "mechanicalSubassembly":
      return mechanicalSubassemblySpecs(prompt);
    case "lightingFixture":
      return lightingFixtureSpecs(prompt);
    case "loopObject":
      return loopObjectSpecs(prompt);
    case "genericAssembly":
      return generalSemanticSpecs(prompt);
  }
}

function matchesGeneralUnknownProfile(prompt: string) {
  return semanticPlan(prompt).family !== "genericAssembly";
}

function generalUnknownProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const plan = semanticPlan(prompt);
  const project = buildEverydayProject(plan.name, prompt, inferGeneralUnknownSpecs(prompt), options);
  project.history = [
    `General semantic decomposition: ${project.name}`,
    `Semantic plan: ${plan.family} subject=${plan.subject}`,
  ];
  return project;
}

function coreRecipeMatchesPrompt(project: ForgeProject, prompt: string) {
  const plan = semanticPlan(prompt);
  if (plan.family !== "genericAssembly") return false;
  const value = prompt.toLowerCase();
  const name = project.name.toLowerCase();
  if (name === "table" && /\b(lamp|light|sconce|lantern)\b/.test(value)) return false;
  if (/vehicle|car|automobile|coupe|sedan|roadster/.test(name) && /\b(transmission|gearbox|differential|clutch)\b/.test(value)) return false;
  if (/\bbicycle\b|\bbike\b/.test(name) && /\b(derailleur|brake|caliper|fork|crankset|cassette|chainring|shifter|hub|bottom bracket)\b/.test(value)) return false;
  return true;
}

export function tryRecoveredRecipeProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel } = {},
): ForgeProject | null {
  const cleaned = prompt.trim() || "A-72 bowling machine";
  const coreProject = createCoreForgeProject(cleaned, options);
  if (hasCoreGenericFallback(coreProject) || !coreRecipeMatchesPrompt(coreProject, cleaned)) return null;
  coreProject.planner = { source: "recovered-recipe" };
  return coreProject;
}

export function createSemanticFallbackProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel } = {},
  warnings: string[] = [],
): ForgeProject {
  const project = generalUnknownProject(prompt, options);
  project.planner = { source: "semantic-fallback", warnings };
  return project;
}

function matchesDresser(prompt: string) {
  return /\b(dresser|chest of drawers|nightstand|bedside cabinet)\b/i.test(prompt);
}

function matchesPen(prompt: string) {
  return /\b(ballpoint|retractable pen|click pen|ink pen|pen)\b/i.test(prompt);
}

export function createForgeProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel } = {},
): ForgeProject {
  const cleaned = prompt.trim() || "A-72 bowling machine";
  if (matchesDresser(cleaned)) return dresserProject(cleaned, options);
  if (matchesPen(cleaned)) return penProject(cleaned, options);
  if (matchesGeneralUnknownProfile(cleaned)) return generalUnknownProject(cleaned, options);

  const coreProject = tryRecoveredRecipeProject(cleaned, options);
  if (coreProject) return coreProject;

  return generalUnknownProject(cleaned, options);
}

export const samplePrompts = [
  "six drawer walnut dresser with brass pulls",
  "blue retractable ballpoint pen with a pocket clip",
  "white 3 drawer nightstand with round knobs",
  "cordless handheld drill",
  "portable hair dryer with handle",
  "passive flat panel collector with support frame",
  "steel reusable bottle with cap",
  "desktop stapler",
  ...coreSamplePrompts,
];
