/**
 * Bundled, license-clean spec table. Every value carries the source it came from, that source's license,
 * and a confidence label. Values here are deliberately conservative: most are ShapeForge-authored
 * "typical" envelopes (not measurements of a specific product); fastener head sizes come from the
 * Apache-2.0 cq_warehouse tables. Torque and procedures are never asserted: they default to
 * "verify in service manual".
 *
 * Axis convention for extentMm: x = left/right as viewed, y = up, z = front/back, matching the
 * builder or recipe that renders the item.
 */
export type SpecConfidence = "spec" | "measured" | "typical" | "estimated" | "unknown";

export interface SpecSource {
  id: string;
  title: string;
  url?: string;
  license: string;
}

export interface SpecValue<T> {
  value: T;
  source: string;
  confidence: SpecConfidence;
  note?: string;
}

export interface SpecAttachment {
  a: string;
  b: string;
  kind: "bolted" | "threaded" | "press-fit" | "slip" | "pinned" | "clip" | "seated" | "hinged" | "hydraulic-line" | "welded";
  fastener?: string;
  source: string;
  confidence: SpecConfidence;
}

/** GeometryPlan-style part used when a spec entry ships its own trusted layout. */
export interface SpecLayoutPart {
  id: string;
  name: string;
  role: string;
  primitive: "box" | "cylinder" | "capsule" | "ellipsoid" | "frustum" | "cone" | "wedge";
  axis?: "x" | "y" | "z";
  purpose: string;
  relativeSize: [number, number, number];
  relativePosition: [number, number, number];
  parentId?: string | null;
  relatedIds?: string[];
  color?: string;
  detail?: boolean;
}

export interface SpecEntry {
  id: string;
  label: string;
  match: RegExp;
  exclude?: RegExp;
  extentMm?: { x: SpecValue<number>; y: SpecValue<number>; z: SpecValue<number> };
  parts: SpecValue<string[]>;
  attachments?: SpecAttachment[];
  layout?: {
    identity: string;
    scope: "complete_object" | "component" | "subsystem";
    form: string;
    dominantAxis: "x" | "y" | "z";
    symmetry: "none" | "bilateral" | "radial" | "rotational";
    recognitionCriticalParts: string[];
    parts: SpecLayoutPart[];
  };
  notes?: string;
}

export const SERVICE_DATA_DEFAULT = "verify in service manual" as const;

export const SPEC_SOURCES: Record<string, SpecSource> = {
  "shapeforge-authored": {
    id: "shapeforge-authored",
    title: "ShapeForge authored typical envelope (not a measurement of a specific product)",
    url: "https://github.com/wolfplayz07/shapeforgee/blob/main/lib/spec-table.ts",
    license: "project-authored",
  },
  "cq-warehouse-hex-head": {
    id: "cq-warehouse-hex-head",
    title: "cq_warehouse hex_head_parameters.csv (ISO 4014 columns)",
    url: "https://github.com/gumyr/cq_warehouse/blob/main/src/cq_warehouse/hex_head_parameters.csv",
    license: "Apache-2.0",
  },
  "commons-disc-brake-components": {
    id: "commons-disc-brake-components",
    title: "Wikimedia Commons: Main components of Disc Brake Assembly.gif (part-name cross-check only)",
    url: "https://commons.wikimedia.org/wiki/File:Main_components_of_Disc_Brake_Assembly.gif",
    license: "CC-BY-SA-4.0",
  },
  "nhtsa-vpic": {
    id: "nhtsa-vpic",
    title: "NHTSA vPIC GetCanadianVehicleSpecifications (US DOT public API)",
    url: "https://vpic.nhtsa.dot.gov/api/",
    license: "US-Government-public-API",
  },
};

const authored = <T>(value: T, confidence: SpecConfidence = "typical", note?: string): SpecValue<T> => ({
  value,
  source: "shapeforge-authored",
  confidence,
  ...(note ? { note } : {}),
});

/** ISO 4014 hex head bolt sizes from cq_warehouse (k = head height, s = width across flats), mm. */
export const HEX_HEAD_BOLTS_MM: Record<string, { k: SpecValue<number>; s: SpecValue<number> }> = {
  "M8-1.25": { k: { value: 5.3, source: "cq-warehouse-hex-head", confidence: "spec" }, s: { value: 13, source: "cq-warehouse-hex-head", confidence: "spec" } },
  "M10-1.5": { k: { value: 6.4, source: "cq-warehouse-hex-head", confidence: "spec" }, s: { value: 16, source: "cq-warehouse-hex-head", confidence: "spec" } },
  "M12-1.75": { k: { value: 7.5, source: "cq-warehouse-hex-head", confidence: "spec" }, s: { value: 18, source: "cq-warehouse-hex-head", confidence: "spec" } },
};

export const SPEC_TABLE: SpecEntry[] = [
  {
    id: "brake-caliper",
    label: "Sliding single-piston disc brake caliper",
    match: /\b(brake\s+caliper|caliper|disc\s+brake(?:\s+assembly)?|front\s+brakes?)\b/,
    exclude: /\b(bike|bicycle|vernier|measuring|digital\s+caliper)\b/,
    extentMm: {
      x: authored(180, "estimated", "passenger-car caliper length along the rotor edge"),
      y: authored(120, "estimated", "radial height incl. bracket"),
      z: authored(95, "estimated", "axial width straddling the rotor"),
    },
    parts: {
      value: ["Caliper Body", "Piston", "Inner Brake Pad", "Outer Brake Pad", "Mounting Bracket", "Guide Pin", "Guide Pin Bolt", "Bleeder Screw", "Brake Hose Fitting", "Brake Rotor"],
      source: "shapeforge-authored",
      confidence: "typical",
      note: "names cross-checked against commons-disc-brake-components",
    },
    attachments: [
      { a: "Mounting Bracket", b: "Caliper Body", kind: "slip", fastener: "guide pins + guide pin bolts (size vehicle-specific)", source: "shapeforge-authored", confidence: "typical" },
      { a: "Caliper Body", b: "Piston", kind: "slip", source: "shapeforge-authored", confidence: "typical" },
      { a: "Mounting Bracket", b: "Inner Brake Pad", kind: "seated", source: "shapeforge-authored", confidence: "typical" },
      { a: "Mounting Bracket", b: "Outer Brake Pad", kind: "seated", source: "shapeforge-authored", confidence: "typical" },
      { a: "Caliper Body", b: "Brake Hose Fitting", kind: "hydraulic-line", fastener: "banjo bolt (vehicle-specific)", source: "shapeforge-authored", confidence: "typical" },
    ],
    layout: {
      identity: "Brake Caliper",
      scope: "component",
      form: "C-shaped caliper straddling the top edge of a brake rotor",
      dominantAxis: "x",
      symmetry: "none",
      recognitionCriticalParts: ["Caliper Body", "Piston", "Inner Brake Pad", "Outer Brake Pad", "Brake Rotor"],
      parts: [
        { id: "rotorSection", name: "Brake Rotor (context)", role: "motion", primitive: "cylinder", axis: "z", purpose: "Disc the pads clamp", relativeSize: [1.05, 1.575, 0.1], relativePosition: [0, -1.25, 0], parentId: null, color: "#8d969c" },
        { id: "caliperBody", name: "Caliper Body", role: "housing", primitive: "box", axis: "x", purpose: "Houses the piston and bridges the rotor", relativeSize: [0.62, 0.32, 0.62], relativePosition: [0, 0.22, 0], parentId: null, relatedIds: ["piston", "mountingBracket"], color: "#b34a3c" },
        { id: "piston", name: "Piston", role: "motion", primitive: "cylinder", axis: "z", purpose: "Pushes the inner pad onto the rotor", relativeSize: [0.3, 0.3, 0.2], relativePosition: [0, 0.12, -0.38], parentId: "caliperBody", relatedIds: ["innerPad"], color: "#c9ced2" },
        { id: "innerPad", name: "Inner Brake Pad", role: "surface", primitive: "box", axis: "x", purpose: "Friction pad on the piston side", relativeSize: [0.52, 0.26, 0.07], relativePosition: [0, 0.06, -0.16], parentId: "mountingBracket", relatedIds: ["rotorSection"], color: "#4a4f54" },
        { id: "outerPad", name: "Outer Brake Pad", role: "surface", primitive: "box", axis: "x", purpose: "Friction pad on the fingers side", relativeSize: [0.52, 0.26, 0.07], relativePosition: [0, 0.06, 0.16], parentId: "mountingBracket", relatedIds: ["rotorSection"], color: "#4a4f54" },
        { id: "mountingBracket", name: "Mounting Bracket", role: "support", primitive: "box", axis: "x", purpose: "Bolts to the knuckle and carries the pads", relativeSize: [0.82, 0.12, 0.22], relativePosition: [0, -0.1, -0.34], parentId: null, relatedIds: ["caliperBody"], color: "#5b6167" },
        { id: "guidePinLeft", name: "Guide Pin Left", role: "motion", primitive: "capsule", axis: "z", purpose: "Lets the caliper slide", relativeSize: [0.07, 0.07, 0.42], relativePosition: [-0.36, 0.02, -0.12], parentId: "mountingBracket", relatedIds: ["caliperBody"], color: "#c0a060" },
        { id: "guidePinRight", name: "Guide Pin Right", role: "motion", primitive: "capsule", axis: "z", purpose: "Lets the caliper slide", relativeSize: [0.07, 0.07, 0.42], relativePosition: [0.36, 0.02, -0.12], parentId: "mountingBracket", relatedIds: ["caliperBody"], color: "#c0a060" },
        { id: "guideBoltLeft", name: "Guide Pin Bolt Left", role: "fastener", primitive: "cylinder", axis: "z", purpose: "Holds caliper to the left pin", relativeSize: [0.09, 0.09, 0.1], relativePosition: [-0.36, 0.02, -0.4], parentId: "guidePinLeft", color: "#2d3338", detail: true },
        { id: "guideBoltRight", name: "Guide Pin Bolt Right", role: "fastener", primitive: "cylinder", axis: "z", purpose: "Holds caliper to the right pin", relativeSize: [0.09, 0.09, 0.1], relativePosition: [0.36, 0.02, -0.4], parentId: "guidePinRight", color: "#2d3338", detail: true },
        { id: "bleeder", name: "Bleeder Screw", role: "fluid", primitive: "cylinder", axis: "y", purpose: "Bleeds air from the hydraulics", relativeSize: [0.05, 0.12, 0.05], relativePosition: [0.2, 0.44, -0.22], parentId: "caliperBody", color: "#c9a24a", detail: true },
        { id: "hoseFitting", name: "Brake Hose Fitting", role: "fluid", primitive: "cylinder", axis: "x", purpose: "Feeds brake fluid to the piston", relativeSize: [0.16, 0.08, 0.08], relativePosition: [-0.4, 0.3, -0.22], parentId: "caliperBody", color: "#24292d" },
      ],
    },
  },
  {
    id: "fluid-pump",
    label: "Engine water pump / rotary liquid pump",
    match: /\b(water|coolant|fuel|oil|drain|sump|centrifugal|power\s+steering)\s+pumps?\b/,
    extentMm: {
      x: authored(170, "estimated", "flange width"),
      y: authored(160, "estimated"),
      z: authored(140, "estimated", "pulley face to gasket"),
    },
    parts: authored(["Pump Housing", "Impeller", "Drive Shaft", "Mounting Flange", "Inlet Port", "Outlet Port", "Pulley", "Gasket"]),
    attachments: [
      { a: "Mounting Flange", b: "Gasket", kind: "bolted", fastener: "M8 flange bolts (typical; verify)", source: "shapeforge-authored", confidence: "typical" },
      { a: "Drive Shaft", b: "Impeller", kind: "press-fit", source: "shapeforge-authored", confidence: "typical" },
      { a: "Drive Shaft", b: "Pulley", kind: "bolted", source: "shapeforge-authored", confidence: "typical" },
    ],
  },
  {
    id: "desk-lamp",
    label: "Desk lamp",
    match: /\b(desk|table|reading|task)\s+lamps?\b|\bdesk\s+light\b/,
    extentMm: {
      x: authored(250, "estimated", "shade width"),
      y: authored(450, "estimated"),
      z: authored(180, "estimated", "base depth"),
    },
    parts: authored(["Base", "Stem", "Shade", "Bulb", "Switch", "Power Cord"]),
    attachments: [
      { a: "Base", b: "Stem", kind: "threaded", source: "shapeforge-authored", confidence: "typical" },
      { a: "Stem", b: "Shade", kind: "hinged", source: "shapeforge-authored", confidence: "typical" },
      { a: "Shade", b: "Bulb", kind: "threaded", source: "shapeforge-authored", confidence: "typical" },
    ],
  },
  {
    id: "office-chair",
    label: "Swivel office chair",
    match: /\b(office|task|swivel|desk|computer|ergonomic)\s+chairs?\b/,
    extentMm: {
      x: authored(660, "typical", "five-star base diameter"),
      y: authored(1050, "typical"),
      z: authored(660, "typical"),
    },
    parts: authored(["Seat", "Backrest", "Gas Column", "Star Base", "Caster", "Armrest"]),
    attachments: [
      { a: "Star Base", b: "Gas Column", kind: "press-fit", source: "shapeforge-authored", confidence: "typical" },
      { a: "Gas Column", b: "Seat", kind: "press-fit", source: "shapeforge-authored", confidence: "typical" },
      { a: "Star Base", b: "Caster", kind: "press-fit", source: "shapeforge-authored", confidence: "typical" },
    ],
  },
  {
    id: "cordless-drill",
    label: "Cordless drill/driver",
    match: /\b(cordless|power|electric)\s+drills?\b|\bdrill\s+driver\b/,
    extentMm: {
      x: authored(200, "estimated", "chuck to rear"),
      y: authored(230, "estimated", "incl. battery"),
      z: authored(75, "estimated"),
    },
    parts: authored(["Motor Housing", "Chuck", "Grip Handle", "Trigger", "Battery Pack", "Gearbox"]),
    attachments: [
      { a: "Grip Handle", b: "Battery Pack", kind: "clip", source: "shapeforge-authored", confidence: "typical" },
      { a: "Gearbox", b: "Chuck", kind: "threaded", source: "shapeforge-authored", confidence: "typical" },
    ],
  },
];

export function findSpecEntry(prompt: string): SpecEntry | null {
  const value = prompt.toLowerCase();
  return SPEC_TABLE.find((entry) => entry.match.test(value) && !(entry.exclude?.test(value))) ?? null;
}
