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
  return createCoreForgeProject(cleaned, options);
}

export const samplePrompts = [
  "six drawer walnut dresser with brass pulls",
  "blue retractable ballpoint pen with a pocket clip",
  "white 3 drawer nightstand with round knobs",
  ...coreSamplePrompts,
];
