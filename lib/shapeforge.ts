export * from "./shapeforge-core";

import {
  createForgeProject as createCoreForgeProject,
  samplePrompts as coreSamplePrompts,
  type CylinderAxis,
  type DetailLevel,
  type ForgePart,
  type ForgeProject,
  type PrimitiveKind,
  type Vec3,
} from "./shapeforge-core";

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

function drillSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#d2a237");
  const dark = "#2d3338";
  const metal = "#aeb8c0";
  return [
    box("housing", "Drill Motor Housing", undefined, "housing", addSpatial("Contains the motor and gears in a pistol-shaped body.", "above the handle and behind the chuck"), [-12, 8, 0], [102, 48, 46], [0, 70, 0], body, { rotation: [0, 0, -6], relatedKeys: ["gearbox", "handle"] }),
    cylinder("gearbox", "Front Gearbox Collar", "housing", "motion", addSpatial("Steps motor speed down before the chuck.", "concentric with the chuck at the front of the housing"), [49, 10, 0], [34, 38, 38], [93, 42, 0], metal, "x", { rotation: [0, 0, -6], relatedKeys: ["chuck", "motor"] }),
    cylinder("chuck", "Keyless Chuck", "gearbox", "output", addSpatial("Clamps the drill bit at the working end.", "attached to the front of the gearbox and coaxial with the bit"), [82, 10, 0], [37, 24, 24], [158, 24, 0], dark, "x", { rotation: [0, 0, -6], relatedKeys: ["bit"] }),
    cylinder("bit", "Drill Bit", "chuck", "output", addSpatial("Represents the removable cutting tool.", "projecting forward from the chuck"), [119, 10, 0], [50, 6, 6], [220, 12, 0], metal, "x", { rotation: [0, 0, -6], detail: true }),
    cylinder("motor", "Electric Motor", "housing", "power", addSpatial("Provides rotary drive for drilling.", "inside the rear housing and connected to the gearbox"), [-18, 8, 0], [48, 28, 28], [-54, 18, 0], "#59646c", "x", { relatedKeys: ["gearbox", "batteryPack"], detail: true }),
    box("handle", "Angled Grip Handle", "housing", "support", addSpatial("Positions the hand below the motor body.", "below and slightly behind the housing"), [-32, -46, 0], [34, 84, 38], [-38, -106, 0], body, { rotation: [0, 0, 16], relatedKeys: ["trigger", "batteryPack"] }),
    box("trigger", "Variable-Speed Trigger", "handle", "control", addSpatial("Controls motor speed with finger pressure.", "inside the front of the handle, below the housing"), [-7, -27, 0], [13, 25, 16], [14, -46, 50], dark, { rotation: [0, 0, 11], relatedKeys: ["motor"] }),
    box("batteryPack", "Slide-On Battery Pack", "handle", "power", addSpatial("Supplies removable cordless power.", "attached below the handle as the lowest mass"), [-30, -101, 0], [61, 31, 54], [-30, -176, 0], dark, { relatedKeys: ["handle", "motor"] }),
    box("vent", "Cooling Vents", "housing", "thermal", addSpatial("Lets motor heat escape.", "on the side wall beside the hidden motor"), [3, 12, -26], [34, 16, 4], [24, 42, -58], "#22282d", { detail: true }),
  ];
}

function coffeeMakerSpecs(prompt: string): EverydaySpec[] {
  const body = colorFromPrompt(prompt, "#48545d");
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

function defaultUnknownSpecs(prompt: string): EverydaySpec[] {
  const name = titleFromPrompt(prompt);
  const body = colorFromPrompt(prompt, "#6e7d88");
  const lower = name.toLowerCase();
  return [
    box("outerShell", `${name} Outer Shell`, undefined, "housing", addSpatial(`Protects the major ${lower} subsystems.`, "surrounding the internal structure and presenting the recognizable exterior"), [0, 0, 0], [150, 82, 92], [0, 0, -118], body, { relatedKeys: ["supportFrame", "inputInterface", "outputInterface"] }),
    box("supportFrame", `${name} Internal Support Frame`, "outerShell", "structure", addSpatial(`Keeps the ${lower} aligned under use.`, "inside the shell and attached to the lower base"), [0, -6, -4], [128, 58, 72], [0, -42, -38], "#53616b", { relatedKeys: ["outerShell", "functionalCore"] }),
    cylinder("functionalCore", `${name} Functional Core`, "supportFrame", "motion", addSpatial(`Represents the primary working mechanism of the ${lower}.`, "inside the support frame and connected between input and output interfaces"), [-28, 1, 4], [52, 36, 36], [-86, 10, 12], "#d19a48", "x", { relatedKeys: ["inputInterface", "outputInterface"] }),
    box("inputInterface", `${name} Input Interface`, "outerShell", "input", addSpatial(`Shows where material, force, or user intent enters the ${lower}.`, "attached to the front-left exterior and connected to the core"), [-46, 16, 50], [54, 28, 9], [-102, 42, 98], "#cbd4da", { relatedKeys: ["functionalCore"] }),
    box("outputInterface", `${name} Output Interface`, "outerShell", "output", addSpatial(`Shows where the ${lower} produces its result.`, "attached to the front-right exterior and connected from the core"), [47, -9, 50], [54, 28, 9], [106, -24, 100], "#b5c4cc", { relatedKeys: ["functionalCore"] }),
    box("controlArea", `${name} Control Area`, "outerShell", "control", addSpatial(`Provides user control for the ${lower}.`, "on the upper exterior surface, above the core"), [38, 39, 38], [48, 14, 10], [84, 90, 82], "#3c7fa0", { relatedKeys: ["functionalCore"], detail: true }),
    box("baseSupport", `${name} Base Support`, "supportFrame", "support", addSpatial(`Stabilizes the ${lower} during operation.`, "below the shell and attached to the frame"), [0, -53, 0], [118, 14, 78], [0, -120, 0], "#424c55", { relatedKeys: ["supportFrame"] }),
    cylinder("serviceFastener", `${name} Service Fastener`, "outerShell", "fastener", addSpatial(`Represents removable hardware for servicing the ${lower}.`, "on the outer shell near a panel edge"), [-62, 32, 48], [12, 12, 12], [-120, 80, 92], "#d7dde2", "z", { relatedKeys: ["outerShell"], detail: true }),
  ];
}

function inferGeneralUnknownSpecs(prompt: string): EverydaySpec[] {
  const value = prompt.toLowerCase();
  if (/\b(window|room|portable)?\s*(unit\s*)?(air\s*conditioner|ac\b|a\/c|hvac)\b/.test(value)) return windowAcSpecs(prompt);
  if (/\b(cordless\s*)?(drill|driver|power\s*drill)\b/.test(value)) return drillSpecs(prompt);
  if (/\b(coffee\s*maker|coffee\s*machine|brewer|drip\s*coffee)\b/.test(value)) return coffeeMakerSpecs(prompt);
  if (/\b(desktop\s*)?(printer|scanner\s*printer|inkjet|laser\s*printer)\b/.test(value)) return printerSpecs(prompt);
  if (/\b(bicycle|bike)?\s*(pump|floor\s*pump|tire\s*pump)\b/.test(value)) return pumpSpecs(prompt);
  if (/\b(blender|food\s*processor|smoothie\s*maker)\b/.test(value)) return blenderSpecs(prompt);
  return defaultUnknownSpecs(prompt);
}

function matchesGeneralUnknownProfile(prompt: string) {
  const value = prompt.toLowerCase();
  return (
    /\b(window|room|portable)?\s*(unit\s*)?(air\s*conditioner|ac\b|a\/c|hvac)\b/.test(value) ||
    /\b(cordless\s*)?(drill|driver|power\s*drill)\b/.test(value) ||
    /\b(coffee\s*maker|coffee\s*machine|brewer|drip\s*coffee)\b/.test(value) ||
    /\b(desktop\s*)?(printer|scanner\s*printer|inkjet|laser\s*printer)\b/.test(value) ||
    /\b(bicycle|bike)?\s*(pump|floor\s*pump|tire\s*pump)\b/.test(value) ||
    /\b(blender|food\s*processor|smoothie\s*maker)\b/.test(value)
  );
}

function generalUnknownProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel },
): ForgeProject {
  const project = buildEverydayProject(titleFromPrompt(prompt), prompt, inferGeneralUnknownSpecs(prompt), options);
  project.history = [`General semantic decomposition: ${project.name}`];
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

  const coreProject = createCoreForgeProject(cleaned, options);
  if (!hasCoreGenericFallback(coreProject)) return coreProject;

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
