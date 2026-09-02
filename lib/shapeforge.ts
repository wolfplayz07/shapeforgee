export type Vec3 = [number, number, number];
export type PrimitiveKind = "box" | "cylinder";
export type CylinderAxis = "x" | "y" | "z";
export type DetailLevel = "basic" | "detailed";

export interface ForgePart {
  id: string;
  name: string;
  kind: PrimitiveKind;
  axis?: CylinderAxis;
  parent: string | null;
  category: string;
  purpose: string;
  position: Vec3;
  size: Vec3;
  rotation: Vec3;
  explode: Vec3;
  related: string[];
  color: string;
  hidden: boolean;
  detached: boolean;
}

export interface ForgeProject {
  format: "ShapeForge Project";
  formatVersion: 2;
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  source: "recovered-recipe" | "procedural-vehicle" | "procedural-concept" | "imported";
  allocator: { nextComponent: number };
  settings: { scale: number; detail: DetailLevel };
  parts: ForgePart[];
  history: string[];
}

export interface ValidationCheck {
  id: string;
  label: string;
  ok: boolean;
}

interface PartSpec {
  key: string;
  name: string;
  kind?: PrimitiveKind;
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

interface Recipe {
  name: string;
  specs: PartSpec[];
  source?: ForgeProject["source"];
}

const COMPONENT_PREFIX = "COMP-";

const componentId = (index: number) =>
  `${COMPONENT_PREFIX}${String(index).padStart(6, "0")}`;

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
  options: Partial<Pick<PartSpec, "rotation" | "relatedKeys" | "detail">> = {},
): PartSpec => ({
  key,
  name,
  parentKey,
  category,
  purpose,
  position,
  size,
  explode,
  color,
  kind: "box",
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
  axis: CylinderAxis = "z",
  options: Partial<Pick<PartSpec, "rotation" | "relatedKeys" | "detail">> = {},
): PartSpec => ({
  key,
  name,
  parentKey,
  category,
  purpose,
  position,
  size,
  explode,
  color,
  kind: "cylinder",
  axis,
  ...options,
});

function a72Recipe(): Recipe {
  return {
    name: "A-72 Bowling Machine",
    specs: [
      box("base", "Base Frame", undefined, "structure", "Primary machine support structure.", [0, 55, 0], [220, 28, 110], [0, 30, -12], "#6f7d8a", { relatedKeys: ["lift", "table", "return"] }),
      box("cover", "Upper Housing", "base", "cover", "Protects the upper mechanism.", [-70, -80, 38], [185, 58, 75], [-150, -125, 45], "#d4d0c7", { relatedKeys: ["lift", "boom"] }),
      box("lift", "Elevation Lift", "base", "motion", "Raises and lowers the sweep and pin-handling assemblies.", [55, -25, 35], [55, 110, 38], [120, -55, 65], "#56616b", { relatedKeys: ["motor", "boom", "wheelL", "wheelR"] }),
      box("boom", "Boom Arm", "lift", "motion", "Transfers lift motion across the machine.", [0, -15, 58], [150, 20, 24], [35, -140, 75], "#69747d", { relatedKeys: ["lift", "table"] }),
      box("table", "Pin Table", "base", "pin handling", "Supports and positions bowling pins.", [15, 30, 18], [120, 22, 72], [42, 100, 18], "#424b54", { relatedKeys: ["pins", "boom"] }),
      box("pins", "Pin Set", "table", "pin handling", "Simplified ten-pin set for assembly visualization.", [15, 24, 47], [95, 55, 55], [25, 55, 135], "#f1f2ee", { relatedKeys: ["table"], detail: true }),
      cylinder("motor", "Lift Motor", "lift", "controls", "Drives the elevation lift.", [82, 8, 42], [48, 36, 36], [155, 18, 38], "#4398dc", "x", { relatedKeys: ["lift", "wheelL", "wheelR"] }),
      cylinder("wheelL", "Left Drive Wheel", "lift", "motion", "Transfers motor torque to the lift.", [48, -70, 76], [34, 34, 18], [72, -158, 92], "#f2a13f", "z", { relatedKeys: ["motor"], detail: true }),
      cylinder("wheelR", "Right Drive Wheel", "lift", "motion", "Transfers motor torque to the lift.", [105, -70, 76], [34, 34, 18], [160, -150, 92], "#f2a13f", "z", { relatedKeys: ["motor"], detail: true }),
      box("control", "Control Box", "base", "controls", "Houses the machine control electronics.", [-78, 5, 20], [48, 52, 36], [-145, 10, 24], "#3e91d1", { relatedKeys: ["motor"] }),
      box("return", "Ball Return Tunnel", "base", "ball return", "Guides the bowling ball away from the pin deck.", [-55, 65, 14], [105, 28, 45], [-132, 118, 0], "#3f4952", { relatedKeys: ["base"] }),
      box("guard", "Side Safety Guard", "base", "cover", "Protects the moving lift assembly.", [105, 55, 35], [18, 75, 90], [175, 92, 70], "#c9cdca", { relatedKeys: ["lift"], detail: true }),
    ],
  };
}

function fanRecipe(): Recipe {
  return {
    name: "Desk Fan",
    specs: [
      cylinder("base", "Weighted Base", undefined, "support", "Stabilizes the fan.", [0, -78, 0], [100, 18, 78], [0, -75, -15], "#46586a", "y", { relatedKeys: ["stand"] }),
      box("stand", "Support Stand", "base", "support", "Raises the motor and fan head.", [0, -18, 0], [18, 112, 18], [0, -35, 0], "#5d7185", { relatedKeys: ["base", "motor"] }),
      cylinder("motor", "Motor Housing", "stand", "motion", "Turns the fan hub and blades.", [0, 55, 10], [62, 62, 46], [0, 12, 85], "#4b657d", "z", { relatedKeys: ["hub", "guard"] }),
      cylinder("guard", "Safety Guard", "motor", "cover", "Shields the rotating blades.", [0, 55, -18], [158, 158, 12], [0, 0, -95], "#8a99a7", "z", { relatedKeys: ["motor"], detail: true }),
      cylinder("hub", "Blade Hub", "motor", "motion", "Connects the blades to the motor shaft.", [0, 55, -35], [28, 28, 24], [0, 0, -135], "#f3a94c", "z", { relatedKeys: ["bladeA", "bladeB", "bladeC"] }),
      box("bladeA", "Blade A", "hub", "motion", "Moves air through the guard.", [0, 94, -48], [18, 76, 7], [0, 75, -165], "#78b8df", { rotation: [0, 0, 0], relatedKeys: ["hub"], detail: true }),
      box("bladeB", "Blade B", "hub", "motion", "Moves air through the guard.", [34, 34, -48], [18, 76, 7], [78, -40, -165], "#78b8df", { rotation: [0, 0, 120], relatedKeys: ["hub"], detail: true }),
      box("bladeC", "Blade C", "hub", "motion", "Moves air through the guard.", [-34, 34, -48], [18, 76, 7], [-78, -40, -165], "#78b8df", { rotation: [0, 0, 240], relatedKeys: ["hub"], detail: true }),
    ],
  };
}

function tableRecipe(): Recipe {
  return {
    name: "Table",
    specs: [
      box("top", "Tabletop", undefined, "surface", "Provides the primary work surface.", [0, 34, 0], [170, 14, 100], [0, 80, 0], "#a77b52", { relatedKeys: ["legA", "legB", "legC", "legD"] }),
      box("legA", "Front Left Leg", "top", "support", "Supports the tabletop.", [-66, -18, -38], [14, 92, 14], [-95, -115, -72], "#79563a", { relatedKeys: ["top"] }),
      box("legB", "Front Right Leg", "top", "support", "Supports the tabletop.", [66, -18, -38], [14, 92, 14], [95, -115, -72], "#79563a", { relatedKeys: ["top"] }),
      box("legC", "Rear Left Leg", "top", "support", "Supports the tabletop.", [-66, -18, 38], [14, 92, 14], [-95, -115, 72], "#79563a", { relatedKeys: ["top"], detail: true }),
      box("legD", "Rear Right Leg", "top", "support", "Supports the tabletop.", [66, -18, 38], [14, 92, 14], [95, -115, 72], "#79563a", { relatedKeys: ["top"], detail: true }),
      box("brace", "Center Brace", "top", "support", "Keeps the legs aligned.", [0, -28, 0], [130, 12, 12], [0, -145, 0], "#876345", { relatedKeys: ["legA", "legB", "legC", "legD"], detail: true }),
    ],
  };
}

function wheelRecipe(): Recipe {
  return {
    name: "Wheel Assembly",
    specs: [
      cylinder("rim", "Outer Rim", undefined, "structure", "Carries the tire and supports the spokes.", [0, 0, 0], [110, 110, 20], [0, 0, 55], "#596877", "z", { relatedKeys: ["hub", "spokeA", "spokeB", "spokeC", "spokeD"] }),
      cylinder("hub", "Center Hub", "rim", "motion", "Connects the wheel to its axle.", [0, 0, -8], [32, 32, 34], [0, 0, -95], "#f0a443", "z", { relatedKeys: ["rim", "axle"] }),
      cylinder("axle", "Axle", "hub", "motion", "Supports rotation through the hub.", [0, 0, -15], [18, 18, 92], [0, 0, -155], "#9aa7b3", "z", { relatedKeys: ["hub"], detail: true }),
      box("spokeA", "Spoke A", "rim", "structure", "Transfers load between rim and hub.", [0, 28, 0], [8, 48, 8], [0, 92, 10], "#7d8b98", { relatedKeys: ["hub", "rim"], detail: true }),
      box("spokeB", "Spoke B", "rim", "structure", "Transfers load between rim and hub.", [28, 0, 0], [8, 48, 8], [92, 0, 10], "#7d8b98", { rotation: [0, 0, 90], relatedKeys: ["hub", "rim"], detail: true }),
      box("spokeC", "Spoke C", "rim", "structure", "Transfers load between rim and hub.", [0, -28, 0], [8, 48, 8], [0, -92, 10], "#7d8b98", { relatedKeys: ["hub", "rim"], detail: true }),
      box("spokeD", "Spoke D", "rim", "structure", "Transfers load between rim and hub.", [-28, 0, 0], [8, 48, 8], [-92, 0, 10], "#7d8b98", { rotation: [0, 0, 90], relatedKeys: ["hub", "rim"], detail: true }),
    ],
  };
}

function chairRecipe(): Recipe {
  return {
    name: "Chair",
    specs: [
      box("seat", "Seat", undefined, "surface", "Supports the occupant.", [0, 12, 0], [96, 14, 92], [0, 78, 0], "#4e7596", { relatedKeys: ["back", "legA", "legB", "legC", "legD"] }),
      box("back", "Backrest", "seat", "surface", "Supports the occupant's back.", [0, 76, 40], [96, 112, 12], [0, 145, 82], "#5d86a7", { relatedKeys: ["seat"] }),
      box("legA", "Front Left Leg", "seat", "support", "Supports the seat.", [-36, -34, -34], [12, 82, 12], [-78, -120, -78], "#344b60", { relatedKeys: ["seat"] }),
      box("legB", "Front Right Leg", "seat", "support", "Supports the seat.", [36, -34, -34], [12, 82, 12], [78, -120, -78], "#344b60", { relatedKeys: ["seat"] }),
      box("legC", "Rear Left Leg", "seat", "support", "Supports the seat.", [-36, -34, 34], [12, 82, 12], [-78, -120, 78], "#344b60", { relatedKeys: ["seat"], detail: true }),
      box("legD", "Rear Right Leg", "seat", "support", "Supports the seat.", [36, -34, 34], [12, 82, 12], [78, -120, 78], "#344b60", { relatedKeys: ["seat"], detail: true }),
    ],
  };
}

function lampRecipe(): Recipe {
  return {
    name: "Desk Lamp",
    specs: [
      cylinder("base", "Lamp Base", undefined, "support", "Stabilizes the lamp.", [0, -70, 0], [78, 16, 62], [0, -85, 0], "#586b7d", "y", { relatedKeys: ["stem"] }),
      box("stem", "Adjustable Stem", "base", "support", "Positions the lamp head.", [0, -8, 0], [14, 118, 14], [-45, 0, 0], "#7390a8", { rotation: [0, 0, -8], relatedKeys: ["shade"] }),
      box("shade", "Lamp Shade", "stem", "cover", "Directs light toward the work surface.", [34, 58, 0], [78, 48, 62], [95, 88, 0], "#e7a84f", { rotation: [0, 0, -12], relatedKeys: ["bulb"] }),
      cylinder("bulb", "Light Bulb", "shade", "output", "Converts electrical power into light.", [38, 50, -34], [28, 28, 22], [112, 70, -85], "#f4e6ae", "z", { relatedKeys: ["shade"], detail: true }),
    ],
  };
}

function bicycleRecipe(): Recipe {
  return {
    name: "Bicycle",
    specs: [
      box("frame", "Main Frame", undefined, "structure", "Carries the rider and connects the major assemblies.", [0, 0, 0], [112, 14, 14], [0, 25, 45], "#48a6d8", { rotation: [0, 0, -8], relatedKeys: ["frontWheel", "rearWheel", "fork", "crank"] }),
      cylinder("frontWheel", "Front Wheel", "frame", "motion", "Rolls and steers the bicycle.", [76, -38, 0], [74, 74, 12], [145, -88, 0], "#4f5c68", "z", { relatedKeys: ["fork"] }),
      cylinder("rearWheel", "Rear Wheel", "frame", "motion", "Receives drive force and rolls the bicycle.", [-76, -38, 0], [74, 74, 12], [-145, -88, 0], "#4f5c68", "z", { relatedKeys: ["frame", "crank"] }),
      box("fork", "Front Fork", "frame", "steering", "Connects the handlebar to the front wheel.", [58, 4, 0], [12, 88, 12], [118, 35, 0], "#7e96a9", { rotation: [0, 0, -14], relatedKeys: ["frontWheel", "handlebar"] }),
      box("handlebar", "Handlebar", "fork", "steering", "Lets the rider steer the bicycle.", [65, 50, 0], [60, 8, 8], [138, 112, 0], "#a8b2bb", { relatedKeys: ["fork"], detail: true }),
      cylinder("crank", "Crankset", "frame", "drivetrain", "Transfers pedal force toward the rear wheel.", [-5, -12, -12], [30, 30, 16], [0, -92, -70], "#f0a443", "z", { relatedKeys: ["rearWheel"], detail: true }),
      box("seat", "Saddle", "frame", "support", "Supports the rider.", [-28, 44, 0], [48, 12, 28], [-55, 118, 0], "#343b42", { relatedKeys: ["frame"], detail: true }),
    ],
  };
}

function tvRecipe(kind: "tv" | "monitor"): Recipe {
  const isMonitor = kind === "monitor";
  const rootName = isMonitor ? "Monitor" : "Television";
  return {
    name: isMonitor ? "Computer Monitor" : "Television",
    specs: [
      box("rear", "Rear Housing", undefined, "housing", "Protects the internal components.", [0, -24, -18], [isMonitor ? 295 : 316, isMonitor ? 180 : 191, 24], [0, 0, -125], "#303944", { relatedKeys: ["screen", "board", "power"] }),
      box("screen", isMonitor ? "LCD Panel" : "Display Panel", "rear", "display", `Displays the ${rootName.toLowerCase()} image.`, [0, -24, 22], [isMonitor ? 280 : 300, isMonitor ? 165 : 175, 12], [0, 0, 145], "#289ed8", { relatedKeys: ["board", "power"] }),
      box("bezel", "Front Bezel", "rear", "housing", "Frames and protects the display.", [0, -24, 5], [isMonitor ? 305 : 326, isMonitor ? 190 : 201, 16], [0, 0, 85], "#171d24", { relatedKeys: ["screen", "rear"] }),
      box("board", isMonitor ? "Controller Board" : "Main Board", "rear", "electronics", "Processes image, controls, and input signals.", [-30, -20, -2], [112, 64, 8], [-155, -15, -35], "#2f914c", { relatedKeys: ["screen", "power", "speakerL", "speakerR"] }),
      box("power", "Power Module", "rear", "electronics", "Converts and distributes electrical power.", [58, 38, -4], [96, 44, 12], [135, 125, -28], "#913f45", { relatedKeys: ["board", "screen"] }),
      box("stand", "Stand Neck", "rear", "support", `Supports the ${rootName.toLowerCase()}.`, [0, 104, -4], [42, 82, 40], [0, 125, 0], "#424d58", { relatedKeys: ["base"] }),
      box("base", "Stand Base", "stand", "support", `Stabilizes the ${rootName.toLowerCase()}.`, [0, 158, -4], [160, 20, 82], [0, 185, 0], "#4c5863", { relatedKeys: ["stand"] }),
      box("speakerL", "Left Speaker", "rear", "audio", "Produces left-channel sound.", [-126, 18, -3], [36, 88, 18], [-205, 72, 0], "#47535e", { relatedKeys: ["board"], detail: true }),
      box("speakerR", "Right Speaker", "rear", "audio", "Produces right-channel sound.", [126, 18, -3], [36, 88, 18], [205, 72, 0], "#47535e", { relatedKeys: ["board"], detail: true }),
    ],
  };
}

function pcRecipe(): Recipe {
  return {
    name: "Desktop PC",
    specs: [
      box("case", "Outer Case", undefined, "housing", "Contains and protects the computer components.", [0, 0, 0], [220, 300, 180], [0, 0, -145], "#303944", { relatedKeys: ["motherboard", "psu", "gpu"] }),
      box("motherboard", "Motherboard", "case", "electronics", "Connects and controls the major components.", [-20, -5, 15], [150, 210, 8], [-175, 0, 35], "#2e924c", { relatedKeys: ["gpu", "psu", "cooler"] }),
      box("psu", "Power Supply", "case", "electronics", "Supplies electrical power.", [35, 95, 10], [105, 75, 140], [145, 135, 0], "#56515b", { relatedKeys: ["motherboard", "gpu"] }),
      box("gpu", "Graphics Card", "motherboard", "electronics", "Processes graphics and display output.", [-5, 35, 35], [150, 45, 35], [0, 165, 95], "#3e72aa", { relatedKeys: ["motherboard", "psu"] }),
      cylinder("cooler", "CPU Cooler", "motherboard", "cooling", "Removes heat from the processor.", [-20, -50, 45], [74, 74, 55], [0, -165, 95], "#6e7b86", "z", { relatedKeys: ["motherboard"] }),
      cylinder("fanFront", "Front Fan", "case", "cooling", "Moves cool air into the case.", [70, -70, 65], [76, 76, 25], [165, -122, 108], "#526274", "z", { relatedKeys: ["case"], detail: true }),
      cylinder("fanRear", "Rear Fan", "case", "cooling", "Exhausts warm air from the case.", [-75, -70, -65], [72, 72, 25], [-165, -122, -108], "#526274", "z", { relatedKeys: ["case"], detail: true }),
    ],
  };
}

function shaftRecipe(): Recipe {
  return {
    name: "Shaft / Bearing Benchmark",
    specs: [
      cylinder("shaft", "Main Shaft", undefined, "motion", "Transfers rotational force through the assembly.", [0, 0, 0], [210, 36, 36], [0, 0, 0], "#8495a6", "x", { relatedKeys: ["bearingA", "bearingB"] }),
      cylinder("bearingA", "Bearing A", "shaft", "support", "Supports the left side of the shaft.", [-64, 0, 0], [38, 76, 76], [-135, 0, 0], "#d49a4d", "x", { relatedKeys: ["shaft"] }),
      cylinder("bearingB", "Bearing B", "shaft", "support", "Supports the right side of the shaft.", [64, 0, 0], [38, 76, 76], [135, 0, 0], "#d49a4d", "x", { relatedKeys: ["shaft"] }),
    ],
  };
}

function hashText(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function titleFromPrompt(prompt: string) {
  const cleaned = prompt
    .replace(/\b(please|make|create|build|design|generate|show me|a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const value = cleaned || "Concept Assembly";
  return value
    .split(" ")
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function vehiclePaint(prompt: string, fallback: string) {
  const value = prompt.toLowerCase();
  if (/\b(red|crimson|burgundy|maroon)\b/.test(value)) return "#a83b3f";
  if (/\b(black|onyx)\b/.test(value)) return "#252b31";
  if (/\b(white|ivory|cream)\b/.test(value)) return "#d9d7ce";
  if (/\b(blue|navy|cobalt)\b/.test(value)) return "#346b91";
  if (/\b(green|emerald|highland)\b/.test(value)) return "#477657";
  if (/\b(orange|copper)\b/.test(value)) return "#bd6634";
  if (/\b(yellow|gold)\b/.test(value)) return "#c99a38";
  if (/\b(silver|gray|grey)\b/.test(value)) return "#7b858d";
  return fallback;
}

function vehicleRecipe(prompt: string): Recipe {
  const value = prompt.toLowerCase();
  const year = value.match(/\b(19|20)\d{2}\b/)?.[0];
  const isChevelle = /\bchevelle\b/.test(value);
  const isMustang = /\bmustang\b/.test(value);
  const isCamaro = /\bcamaro\b/.test(value);
  const isCharger = /\bcharger\b/.test(value);
  const isCorvette = /\bcorvette\b/.test(value);
  const isSs = /\bss\b|super\s+sport/.test(value);
  const isFastback = /fastback|mach\s*1|boss\s*(302|429)?/.test(value) || isMustang;

  const model = isChevelle
    ? "Chevrolet Chevelle"
    : isMustang
      ? "Ford Mustang"
      : isCamaro
        ? "Chevrolet Camaro"
        : isCharger
          ? "Dodge Charger"
          : isCorvette
            ? "Chevrolet Corvette"
            : titleFromPrompt(prompt);
  const trim = isChevelle && isSs ? " SS" : /mach\s*1/.test(value) ? " Mach 1" : /boss\s*429/.test(value) ? " Boss 429" : /boss\s*302/.test(value) ? " Boss 302" : "";
  const name = `${year ? `${year} ` : ""}${model}${trim}`.trim();

  const chevelle = isChevelle;
  const mustang = isMustang;
  const corvette = isCorvette;
  const bodyColor = vehiclePaint(prompt, chevelle ? "#316785" : mustang ? "#477657" : corvette ? "#a83b3f" : "#5c7290");
  const stripeColor = /\bwhite\b/.test(value) ? "#2e3439" : "#e6e0d4";
  const chrome = "#b8c1c8";
  const rubber = "#20252a";
  const glass = "#244b61";

  const length = chevelle ? 330 : mustang ? 306 : corvette ? 292 : 316;
  const bodyWidth = chevelle ? 126 : mustang ? 116 : corvette ? 120 : 122;
  const wheelbase = chevelle ? 224 : mustang ? 210 : corvette ? 202 : 214;
  const wheelDiameter = chevelle && isSs ? 64 : corvette ? 58 : 60;
  const wheelX = wheelbase / 2;
  const wheelY = -31;
  const wheelZ = bodyWidth / 2 + 3;
  const frontX = length / 2;
  const rearX = -length / 2;
  const hoodLength = chevelle ? 116 : mustang ? 126 : corvette ? 132 : 118;
  const deckLength = chevelle ? 76 : mustang ? 54 : corvette ? 44 : 66;
  const cabinX = chevelle ? -20 : mustang ? -25 : corvette ? -18 : -20;
  const roofLength = chevelle ? 108 : mustang ? 72 : corvette ? 66 : 88;
  const roofY = corvette ? 67 : 79;
  const bodyHeight = corvette ? 34 : 42;

  const specs: PartSpec[] = [
    box("chassis", "Chassis", undefined, "structure", `Carries the ${name} body, suspension, and drivetrain.`, [0, -17, 0], [length - 20, 18, bodyWidth - 18], [0, -80, -25], "#3a4249", { relatedKeys: ["body", "engine", "frontAxle", "rearAxle"] }),
    box("body", "Body Shell", "chassis", "body", `Defines the long, low ${name} exterior proportions.`, [0, 2, 0], [length, bodyHeight, bodyWidth], [0, 75, 0], bodyColor, { relatedKeys: ["hood", "deck", "roof", "frontFascia", "rearFascia"] }),
    box("hood", chevelle && isSs ? "SS Cowl Hood" : "Long Hood", "body", "body", "Covers the front engine bay and establishes the model-specific nose length.", [(frontX - hoodLength / 2) - 13, 31, 0], [hoodLength, corvette ? 10 : 14, bodyWidth - 8], [105, 65, 0], bodyColor, { rotation: [0, 0, corvette ? -4 : -2], relatedKeys: ["engine", "frontFascia"] }),
    box("deck", "Rear Deck", "body", "body", "Forms the distinct rear deck and trunk profile.", [(rearX + deckLength / 2) + 8, 31, 0], [deckLength, 13, bodyWidth - 9], [-110, 62, 0], bodyColor, { rotation: [0, 0, chevelle ? 1 : 3], relatedKeys: ["rearFascia", "roof"] }),
    box("roof", chevelle ? "Notchback Roof" : isFastback ? "Fastback Roof" : "Cabin Roof", "body", "body", "Defines the passenger cabin silhouette.", [cabinX, roofY, 0], [roofLength, corvette ? 8 : 10, bodyWidth - 24], [0, 145, 0], bodyColor, { relatedKeys: ["windshield", "rearGlass", "interior"] }),
    box("windshield", "Raked Windshield", "roof", "glass", "Closes the front of the passenger cabin.", [cabinX + roofLength / 2 + (corvette ? 10 : 9), corvette ? 52 : 58, 0], [corvette ? 52 : 58, 7, bodyWidth - 28], [105, 120, 0], glass, { rotation: [0, 0, corvette ? -55 : -52], relatedKeys: ["roof", "hood"] }),
    box("rearGlass", chevelle ? "Notchback Rear Glass" : "Fastback Rear Glass", "roof", "glass", "Creates the model-specific rear roof slope.", [cabinX - roofLength / 2 - (chevelle ? 8 : 19), chevelle ? 57 : corvette ? 50 : 54, 0], [chevelle ? 49 : isFastback ? 80 : 58, 7, bodyWidth - 29], [-105, 118, 0], glass, { rotation: [0, 0, chevelle ? 55 : corvette ? 36 : 39], relatedKeys: ["roof", "deck"] }),
    box("frontFascia", chevelle ? "Chevelle Front Fascia" : mustang ? "Mustang Nose Panel" : "Front Fascia", "body", "body", "Carries the grille, lamps, and front bumper.", [frontX + 1, 4, 0], [10, 34, bodyWidth - 4], [155, 0, 0], bodyColor, { relatedKeys: ["grille", "frontBumper"] }),
    box("grille", chevelle ? "Twin-Section SS Grille" : mustang ? "Recessed Mustang Grille" : "Front Grille", "frontFascia", "trim", "Feeds cooling air and distinguishes the front-end design.", [frontX + 7, 8, 0], [5, chevelle ? 17 : 22, chevelle ? 88 : 76], [185, 8, 0], "#252c31", { relatedKeys: ["headlampL", "headlampR"] }),
    box("frontBumper", "Front Bumper", "frontFascia", "trim", "Protects the lower front body edge.", [frontX + 8, -10, 0], [8, 8, bodyWidth + 2], [195, -42, 0], chrome, { relatedKeys: ["frontFascia"] }),
    box("rearFascia", chevelle ? "Chevelle Tail Panel" : mustang ? "Mustang Tail Panel" : "Rear Fascia", "body", "body", "Carries the rear lamps and bumper.", [rearX - 1, 3, 0], [10, 32, bodyWidth - 5], [-155, 0, 0], chevelle ? "#292f34" : bodyColor, { relatedKeys: ["rearBumper", "tailLampBar"] }),
    box("rearBumper", "Rear Bumper", "rearFascia", "trim", "Protects the lower rear body edge.", [rearX - 8, -10, 0], [8, 8, bodyWidth + 1], [-195, -42, 0], chrome, { relatedKeys: ["rearFascia"] }),
    box("tailLampBar", chevelle ? "Chevelle Tail Lamps" : mustang ? "Triple Tail Lamps" : "Tail Lamps", "rearFascia", "lighting", "Provides the model-specific rear lighting signature.", [rearX - 7, 5, 0], [4, 13, mustang ? 66 : 82], [-188, 10, 0], "#a73734", { relatedKeys: ["rearFascia"] }),
    cylinder("frontWheelL", "Front Left Wheel", "chassis", "motion", "Supports and steers the front-left corner.", [wheelX, wheelY, -wheelZ], [wheelDiameter, wheelDiameter, 20], [125, -105, -108], rubber, "z", { relatedKeys: ["frontAxle", "steering"] }),
    cylinder("frontWheelR", "Front Right Wheel", "chassis", "motion", "Supports and steers the front-right corner.", [wheelX, wheelY, wheelZ], [wheelDiameter, wheelDiameter, 20], [125, -105, 108], rubber, "z", { relatedKeys: ["frontAxle", "steering"] }),
    cylinder("rearWheelL", "Rear Left Wheel", "chassis", "motion", "Receives power at the rear-left corner.", [-wheelX, wheelY, -wheelZ], [wheelDiameter, wheelDiameter, 22], [-125, -105, -108], rubber, "z", { relatedKeys: ["rearAxle", "driveshaft"] }),
    cylinder("rearWheelR", "Rear Right Wheel", "chassis", "motion", "Receives power at the rear-right corner.", [-wheelX, wheelY, wheelZ], [wheelDiameter, wheelDiameter, 22], [-125, -105, 108], rubber, "z", { relatedKeys: ["rearAxle", "driveshaft"] }),
    cylinder("headlampL", chevelle ? "Outer Left Headlamp" : "Left Headlamp", "frontFascia", "lighting", "Illuminates the road ahead.", [frontX + 9, 10, -bodyWidth * 0.31], [8, 24, 24], [210, 42, -80], "#e8dfba", "x", { relatedKeys: ["grille"] }),
    cylinder("headlampR", chevelle ? "Outer Right Headlamp" : "Right Headlamp", "frontFascia", "lighting", "Illuminates the road ahead.", [frontX + 9, 10, bodyWidth * 0.31], [8, 24, 24], [210, 42, 80], "#e8dfba", "x", { relatedKeys: ["grille"] }),
    box("engine", chevelle && isSs ? "SS Big-Block V8" : mustang ? "Mustang V8" : "Engine", "chassis", "drivetrain", "Provides power beneath the long hood.", [wheelX - 25, 9, 0], [70, 38, 65], [120, 80, 0], "#a8673e", { relatedKeys: ["hood", "driveshaft"], detail: true }),
    cylinder("frontAxle", "Front Axle", "chassis", "suspension", "Locates the front wheels across the chassis.", [wheelX, wheelY, 0], [bodyWidth + 22, 10, 10], [135, -90, 0], "#77828b", "z", { relatedKeys: ["frontWheelL", "frontWheelR"], detail: true }),
    cylinder("rearAxle", "Rear Axle", "chassis", "drivetrain", "Transfers drive force to both rear wheels.", [-wheelX, wheelY, 0], [bodyWidth + 22, 12, 12], [-135, -90, 0], "#77828b", "z", { relatedKeys: ["rearWheelL", "rearWheelR", "driveshaft"], detail: true }),
    cylinder("driveshaft", "Driveshaft", "chassis", "drivetrain", "Connects the transmission to the rear axle.", [-10, -23, 0], [wheelbase - 62, 10, 10], [0, -135, 0], "#8a959e", "x", { relatedKeys: ["engine", "rearAxle"], detail: true }),
    box("interior", "Passenger Interior", "body", "interior", "Contains the seats, controls, and passenger compartment.", [cabinX, 46, 0], [roofLength - 18, 34, bodyWidth - 34], [0, 95, 0], "#443c36", { relatedKeys: ["roof", "steering"], detail: true }),
    cylinder("steering", "Steering Wheel", "interior", "controls", "Controls front-wheel steering.", [cabinX + 28, 51, -28], [28, 28, 7], [58, 115, -80], "#2b3035", "z", { relatedKeys: ["frontWheelL", "frontWheelR"], detail: true }),
  ];

  if (chevelle) {
    specs.push(
      cylinder("headlampInnerL", "Inner Left Headlamp", "frontFascia", "lighting", "Completes the Chevelle quad-headlamp face.", [frontX + 9, 10, -bodyWidth * 0.16], [8, 22, 22], [212, 42, -38], "#e8dfba", "x", { relatedKeys: ["grille"], detail: true }),
      cylinder("headlampInnerR", "Inner Right Headlamp", "frontFascia", "lighting", "Completes the Chevelle quad-headlamp face.", [frontX + 9, 10, bodyWidth * 0.16], [8, 22, 22], [212, 42, 38], "#e8dfba", "x", { relatedKeys: ["grille"], detail: true }),
      box("ssStripe", "SS Body Stripe", "body", "trim", "Marks the Super Sport body treatment.", [3, 12, wheelZ + 8], [length - 54, 5, 3], [0, 50, 145], stripeColor, { relatedKeys: ["body"], detail: true }),
    );
  }

  if (mustang) {
    specs.push(
      box("hoodScoop", "Mustang Hood Scoop", "hood", "body", "Adds the raised performance hood detail.", [75, 42, 0], [48, 9, 34], [145, 95, 0], bodyColor, { rotation: [0, 0, -2], relatedKeys: ["hood"], detail: true }),
      cylinder("ponyBadge", "Pony Grille Emblem", "grille", "trim", "Identifies the Mustang at the center of its recessed grille.", [frontX + 11, 10, 0], [6, 13, 13], [222, 55, 0], chrome, "x", { relatedKeys: ["grille"], detail: true }),
      box("rockerStripe", "Mustang Rocker Stripe", "body", "trim", "Accents the Mustang lower body line.", [2, -3, wheelZ + 8], [length - 62, 5, 3], [0, 35, 145], stripeColor, { relatedKeys: ["body"], detail: true }),
    );
  }

  return { name, specs, source: "procedural-vehicle" };
}

function genericRecipe(prompt: string): Recipe {
  const seed = hashText(prompt.toLowerCase());
  const wide = 125 + (seed % 65);
  const tall = 80 + ((seed >>> 5) % 85);
  const deep = 70 + ((seed >>> 11) % 70);
  const accent = ["#3f9ed5", "#58a987", "#ce8d48", "#7d74c8"][seed % 4];
  const name = titleFromPrompt(prompt);
  return {
    name,
    specs: [
      box("frame", "Main Frame", undefined, "structure", `Carries the primary ${name.toLowerCase()} assembly.`, [0, 0, 0], [wide, tall, deep], [0, 0, -115], "#536371", { relatedKeys: ["body", "core", "control", "output"] }),
      box("body", "Outer Body", "frame", "housing", "Protects and aligns the internal parts.", [0, -4, 18], [wide + 18, tall + 18, 18], [0, 0, 125], accent, { relatedKeys: ["frame", "control"] }),
      cylinder("core", "Drive Core", "frame", "motion", "Provides the central mechanical action for the concept.", [-wide * 0.2, 0, 12], [52, 52, Math.max(38, deep * 0.48)], [-130, -20, 25], "#e0a24b", "z", { relatedKeys: ["frame", "output"] }),
      box("control", "Control Module", "frame", "controls", "Coordinates the concept assembly.", [wide * 0.22, tall * 0.08, 16], [wide * 0.34, tall * 0.34, 28], [125, 58, 35], "#397fb7", { relatedKeys: ["core", "body"] }),
      cylinder("output", "Output Module", "core", "output", "Represents the primary output interface.", [0, -tall * 0.25, -deep * 0.34], [48, 48, 34], [0, -115, -105], "#b9c6cf", "z", { relatedKeys: ["core"] }),
      box("mount", "Mounting Base", "frame", "support", "Stabilizes the generated concept.", [0, tall * 0.62, 0], [wide * 0.75, 18, deep * 0.72], [0, 145, 0], "#424f5a", { relatedKeys: ["frame"] }),
      cylinder("fastenerA", "Fastener A", "body", "fastener", "Secures the body to the main frame.", [-wide * 0.35, -tall * 0.28, 32], [14, 14, 14], [-120, -90, 95], "#d7dde2", "z", { relatedKeys: ["body", "frame"], detail: true }),
      cylinder("fastenerB", "Fastener B", "body", "fastener", "Secures the body to the main frame.", [wide * 0.35, -tall * 0.28, 32], [14, 14, 14], [120, -90, 95], "#d7dde2", "z", { relatedKeys: ["body", "frame"], detail: true }),
    ],
  };
}

function matchRecipe(prompt: string): Recipe | null {
  const value = prompt.toLowerCase();
  if (/\b(chevelle|mustang|camaro|charger|corvette|car|automobile|coupe|sedan|roadster)\b/.test(value)) return vehicleRecipe(prompt);
  if (/a\s*-?\s*72|bowling\s+machine/.test(value)) return a72Recipe();
  if (/desk\s+fan|\bfan\b/.test(value)) return fanRecipe();
  if (/\btable\b|\bdesk\b/.test(value)) return tableRecipe();
  if (/\bwheel\b/.test(value)) return wheelRecipe();
  if (/\bchair\b|\bstool\b/.test(value)) return chairRecipe();
  if (/\blamp\b|desk\s+light/.test(value)) return lampRecipe();
  if (/\bbicycle\b|\bbike\b/.test(value)) return bicycleRecipe();
  if (/\btelevision\b|\btv\b/.test(value)) return tvRecipe("tv");
  if (/\bmonitor\b/.test(value)) return tvRecipe("monitor");
  if (/\bpc\b|computer\s+case|desktop\s+computer/.test(value)) return pcRecipe();
  if (/\bshaft\b|\bbearing\b/.test(value)) return shaftRecipe();
  return null;
}

const scaleVec = (value: Vec3, scale: number): Vec3 =>
  value.map((entry) => entry * scale) as Vec3;

function specsToProject(
  recipe: Recipe,
  prompt: string,
  scale: number,
  detail: DetailLevel,
  source: ForgeProject["source"],
): ForgeProject {
  const selectedSpecs = recipe.specs.filter((item) => detail === "detailed" || !item.detail);
  const keys = new Set(selectedSpecs.map((item) => item.key));
  const idByKey = new Map(selectedSpecs.map((item, index) => [item.key, componentId(index + 1)]));
  const parts: ForgePart[] = selectedSpecs.map((item) => ({
    id: idByKey.get(item.key)!,
    name: item.name,
    kind: item.kind ?? "box",
    axis: item.axis,
    parent: item.parentKey && keys.has(item.parentKey) ? idByKey.get(item.parentKey)! : null,
    category: item.category,
    purpose: item.purpose,
    position: scaleVec(item.position, scale),
    size: scaleVec(item.size, scale),
    rotation: item.rotation ?? [0, 0, 0],
    explode: scaleVec(item.explode, scale),
    related: (item.relatedKeys ?? [])
      .filter((key) => keys.has(key))
      .map((key) => idByKey.get(key)!),
    color: item.color,
    hidden: false,
    detached: false,
  }));

  return {
    format: "ShapeForge Project",
    formatVersion: 2,
    id: "PROJ-000001",
    name: recipe.name,
    prompt,
    createdAt: new Date().toISOString(),
    source,
    allocator: { nextComponent: parts.length + 1 },
    settings: { scale, detail },
    parts,
    history: [`Generated ${recipe.name}`],
  };
}

export function createForgeProject(
  prompt: string,
  options: { scale?: number; detail?: DetailLevel } = {},
): ForgeProject {
  const cleaned = prompt.trim() || "A-72 bowling machine";
  const scale = Math.max(0.5, Math.min(1.8, options.scale ?? 1));
  const detail = options.detail ?? "detailed";
  const recipe = matchRecipe(cleaned);
  return specsToProject(
    recipe ?? genericRecipe(cleaned),
    cleaned,
    scale,
    detail,
    recipe?.source ?? (recipe ? "recovered-recipe" : "procedural-concept"),
  );
}

export function validateForgeProject(project: ForgeProject): ValidationCheck[] {
  const ids = project.parts.map((part) => part.id);
  const idSet = new Set(ids);
  const stableIds = ids.every((id) => /^COMP-\d{6}$/.test(id));

  const hasCycle = project.parts.some((part) => {
    const visited = new Set<string>();
    let current: ForgePart | undefined = part;
    while (current?.parent) {
      if (visited.has(current.parent)) return true;
      visited.add(current.parent);
      current = project.parts.find((candidate) => candidate.id === current?.parent);
    }
    return false;
  });

  return [
    { id: "format", label: "Versioned project format", ok: project.format === "ShapeForge Project" && project.formatVersion === 2 },
    { id: "project", label: "Stable project identity", ok: /^PROJ-\d{6}$/.test(project.id) },
    { id: "ids", label: "Unique stable component IDs", ok: stableIds && idSet.size === ids.length },
    { id: "parents", label: "Parent references resolved", ok: project.parts.every((part) => part.parent === null || idSet.has(part.parent)) },
    { id: "cycles", label: "Hierarchy contains no cycles", ok: !hasCycle },
    { id: "relations", label: "Relationship endpoints resolved", ok: project.parts.every((part) => part.related.every((id) => idSet.has(id))) },
    { id: "self", label: "No self relationships", ok: project.parts.every((part) => !part.related.includes(part.id) && part.parent !== part.id) },
    { id: "geometry", label: "Geometry is finite and positive", ok: project.parts.every((part) => part.size.every((value) => Number.isFinite(value) && value > 0) && part.position.every(Number.isFinite)) },
    { id: "metadata", label: "Required metadata present", ok: project.parts.every((part) => Boolean(part.name && part.category && part.purpose && part.color)) },
  ];
}

export function nextComponentId(project: ForgeProject) {
  return componentId(project.allocator.nextComponent);
}

function loosePartsToProject(
  name: string,
  prompt: string,
  looseParts: Array<{
    key: string;
    name?: string;
    kind?: PrimitiveKind;
    axis?: CylinderAxis;
    parentKey?: string;
    category?: string;
    purpose?: string;
    position?: Vec3;
    size?: Vec3;
    rotation?: Vec3;
    explode?: Vec3;
    relatedKeys?: string[];
    color?: string;
  }>,
): ForgeProject {
  const specs: PartSpec[] = looseParts.map((part) => ({
    key: part.key,
    name: part.name || part.key,
    kind: part.kind || "box",
    axis: part.axis,
    parentKey: part.parentKey,
    category: part.category || "component",
    purpose: part.purpose || "Imported ShapeForge component.",
    position: part.position || [0, 0, 0],
    size: part.size || [40, 40, 40],
    rotation: part.rotation || [0, 0, 0],
    explode: part.explode || [0, 0, 80],
    relatedKeys: part.relatedKeys || [],
    color: part.color || "#6f8192",
  }));
  const project = specsToProject({ name, specs }, prompt, 1, "detailed", "imported");
  project.history = [`Imported and upgraded ${name} to ShapeForge v2`];
  return project;
}

const asVec3 = (value: unknown, fallback: Vec3): Vec3 => {
  if (!Array.isArray(value) || value.length < 3) return fallback;
  const parsed = value.slice(0, 3).map(Number);
  return parsed.every(Number.isFinite) ? (parsed as Vec3) : fallback;
};

export function importForgeProject(value: unknown): ForgeProject {
  if (!value || typeof value !== "object") throw new Error("The file does not contain a project object.");
  const data = value as Record<string, unknown>;

  if (data.formatVersion === 2 && Array.isArray(data.parts)) {
    const rawParts = data.parts as Array<Record<string, unknown>>;
    const keys = new Set(rawParts.map((part, index) => String(part.id ?? `legacy-${index}`)));
    const project = loosePartsToProject(
      String(data.name ?? "Imported ShapeForge Project"),
      String(data.prompt ?? data.name ?? "Imported project"),
      rawParts.map((part, index) => ({
        key: String(part.id ?? `legacy-${index}`),
        name: String(part.name ?? `Component ${index + 1}`),
        kind: part.kind === "cylinder" ? "cylinder" : "box",
        axis: part.axis === "x" || part.axis === "y" || part.axis === "z" ? part.axis : undefined,
        parentKey: part.parent && keys.has(String(part.parent)) ? String(part.parent) : undefined,
        category: String(part.category ?? "component"),
        purpose: String(part.purpose ?? "Imported ShapeForge component."),
        position: asVec3(part.position, [0, 0, 0]),
        size: asVec3(part.size, [40, 40, 40]),
        rotation: asVec3(part.rotation, [0, 0, 0]),
        explode: asVec3(part.explode, [0, 0, 80]),
        relatedKeys: Array.isArray(part.related) ? part.related.map(String).filter((id) => keys.has(id)) : [],
        color: String(part.color ?? "#6f8192"),
      })),
    );
    project.history = Array.isArray(data.history)
      ? [...data.history.map(String), "Validated and loaded in ShapeForge v2"]
      : ["Loaded ShapeForge v2 project"];
    return project;
  }

  if (data.format === "ShapeForge Project" && Array.isArray(data.parts)) {
    const rawParts = data.parts as Array<Record<string, unknown>>;
    const keys = new Set(rawParts.map((part, index) => String(part.id ?? `legacy-${index}`)));
    return loosePartsToProject(
      String(data.root ?? data.objectType ?? "Legacy ShapeForge Project"),
      String(data.objectType ?? "Imported legacy project"),
      rawParts.map((part, index) => ({
        key: String(part.id ?? `legacy-${index}`),
        name: String(part.name ?? `Component ${index + 1}`),
        parentKey: part.parent && keys.has(String(part.parent)) ? String(part.parent) : undefined,
        category: String(part.category ?? "component"),
        purpose: String(part.purpose ?? "Imported legacy component."),
        position: asVec3(part.pos, [0, 0, 0]),
        size: asVec3(part.size, [40, 40, 40]),
        explode: asVec3(part.explodeVector, [0, 0, 80]),
        relatedKeys: Array.isArray(part.related) ? part.related.map(String).filter((id) => keys.has(id)) : [],
        color: String(part.color ?? "#6f8192"),
      })),
    );
  }

  if (data.format_version === 1 && Array.isArray(data.components)) {
    const components = data.components as Array<Record<string, unknown>>;
    return loosePartsToProject(
      String((data.project as Record<string, unknown> | undefined)?.name ?? "Shaft / Bearing Assembly"),
      "Imported v1 component registry",
      components.map((part, index) => {
        const length = Math.max(1, Number(part.length ?? 40));
        const radius = Math.max(1, Number(part.radius ?? 20));
        return {
          key: String(part.id ?? `legacy-${index}`),
          name: String(part.name ?? `Component ${index + 1}`),
          kind: "cylinder" as const,
          axis: "x" as const,
          category: String(part.type ?? "component"),
          purpose: "Imported from the recovered ShapeForge v1 registry.",
          position: [Number(part.x ?? 0), Number(part.y ?? 0), Number(part.z ?? 0)] as Vec3,
          size: [length, radius * 2, radius * 2] as Vec3,
          explode: [Number(part.x ?? 0) < 0 ? -120 : Number(part.x ?? 0) > 0 ? 120 : 0, 0, 0] as Vec3,
          color: part.type === "bearing" ? "#d49a4d" : "#8495a6",
        };
      }),
    );
  }

  if (data.parts && typeof data.parts === "object" && !Array.isArray(data.parts)) {
    const entries = Object.entries(data.parts as Record<string, Record<string, unknown>>);
    return loosePartsToProject(
      String(data.name ?? "Recovered Prompt Prototype"),
      String(data.name ?? "Imported prompt prototype"),
      entries.map(([key, part]) => {
        const kind = part.kind === "cyl" || part.kind === "cylinder" ? "cylinder" : "box";
        const radius = Number(part.r ?? 20);
        return {
          key,
          name: key,
          kind,
          axis: kind === "cylinder" ? "z" : undefined,
          parentKey: part.parent ? String(part.parent) : undefined,
          category: "component",
          purpose: "Imported from the recovered prompt-driven prototype.",
          position: [Number(part.x ?? 0), Number(part.y ?? 0), Number(part.z ?? 0)] as Vec3,
          size: kind === "cylinder"
            ? [radius * 2, radius * 2, Number(part.d ?? 20)] as Vec3
            : [Number(part.w ?? 40), Number(part.h ?? 40), Number(part.d ?? 40)] as Vec3,
          explode: [Number(part.x ?? 0), Number(part.y ?? 0), Number(part.z ?? 80)] as Vec3,
          color: "#6f8192",
        };
      }),
    );
  }

  throw new Error("This is not a supported ShapeForge project file.");
}

export const samplePrompts = [
  "A-72 bowling machine",
  "1969 Chevrolet Chevelle SS",
  "1969 Ford Mustang fastback",
  "desk fan",
  "bicycle",
  "television",
  "desktop PC",
  "wheel assembly",
  "table",
  "chair",
  "desk lamp",
  "shaft with two bearings",
];
