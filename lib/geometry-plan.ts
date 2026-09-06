import type {
  CylinderAxis,
  DetailLevel,
  ForgePart,
  ForgeProject,
  PrimitiveKind,
  Vec3,
} from "./shapeforge-core.ts";

export const GEOMETRY_PLAN_SCHEMA_VERSION = 1;

export type ObjectScope =
  | "complete_object"
  | "component"
  | "subsystem"
  | "attachment"
  | "fixture"
  | "tool"
  | "wearable"
  | "appliance";

export type SymmetryKind = "none" | "bilateral" | "radial" | "rotational";

export type PartRole =
  | "structure"
  | "housing"
  | "power"
  | "motion"
  | "control"
  | "input"
  | "output"
  | "thermal"
  | "fluid"
  | "electrical"
  | "support"
  | "fastener"
  | "surface"
  | "grip"
  | "optical"
  | "storage"
  | "other";

export interface GeometryPlanPart {
  id: string;
  name: string;
  role: PartRole;
  primitive: PrimitiveKind;
  axis?: CylinderAxis;
  purpose: string;
  relativeSize: Vec3;
  relativePosition: Vec3;
  rotation: Vec3;
  parentId?: string | null;
  relatedIds?: string[];
  spatialRelationships?: string[];
  mirroredFrom?: string;
  repeatGroup?: string;
  color?: string;
  detail?: boolean;
}

export interface GeometryPlan {
  schemaVersion: 1;
  requestedObject: {
    identity: string;
    subtype?: string;
    scope: ObjectScope;
  };
  silhouette: {
    form: string;
    proportions: { width: number; height: number; depth: number };
    orientation: string;
    dominantAxis: CylinderAxis;
    symmetry: SymmetryKind;
  };
  exclusions: string[];
  recognitionCriticalParts: string[];
  parts: GeometryPlanPart[];
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    description?: string;
  }>;
  plannerNotes?: string;
}

export interface PlanValidationResult {
  ok: boolean;
  plan?: GeometryPlan;
  warnings: string[];
}

const allowedScopes = new Set<ObjectScope>([
  "complete_object",
  "component",
  "subsystem",
  "attachment",
  "fixture",
  "tool",
  "wearable",
  "appliance",
]);

const allowedSymmetry = new Set<SymmetryKind>(["none", "bilateral", "radial", "rotational"]);
const allowedRoles = new Set<PartRole>([
  "structure",
  "housing",
  "power",
  "motion",
  "control",
  "input",
  "output",
  "thermal",
  "fluid",
  "electrical",
  "support",
  "fastener",
  "surface",
  "grip",
  "optical",
  "storage",
  "other",
]);
export const ALLOWED_PLAN_PRIMITIVES = [
  "box",
  "cylinder",
  "capsule",
  "ellipsoid",
  "frustum",
  "cone",
  "wedge",
] as const satisfies readonly PrimitiveKind[];

const allowedPrimitives = new Set<PrimitiveKind>(ALLOWED_PLAN_PRIMITIVES);
const allowedAxes = new Set<CylinderAxis>(["x", "y", "z"]);
const partIdPattern = /^[a-z][a-z0-9_-]{1,40}$/i;

/** Fail closed when part centers barely spread (tiny jitter / mush). Relative units. */
export const MIN_PLAN_POSITION_SPAN = 0.08;
/** Fail closed when union AABB of part extents is weakly spread on every axis. */
export const MIN_PLAN_EXTENT_SPAN = 0.12;

const axialPrimitive = (primitive: PrimitiveKind) => primitive !== "box";

const vec3Schema = {
  type: "array",
  items: { type: "number" },
  minItems: 3,
  maxItems: 3,
} as const;

/** JSON Schema for Workers AI response_format.type = json_schema. */
export const GEOMETRY_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "requestedObject",
    "silhouette",
    "exclusions",
    "recognitionCriticalParts",
    "parts",
    "relationships",
  ],
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    requestedObject: {
      type: "object",
      additionalProperties: false,
      required: ["identity", "scope"],
      properties: {
        identity: { type: "string" },
        subtype: { type: "string" },
        scope: {
          type: "string",
          enum: [
            "complete_object",
            "component",
            "subsystem",
            "attachment",
            "fixture",
            "tool",
            "wearable",
            "appliance",
          ],
        },
      },
    },
    silhouette: {
      type: "object",
      additionalProperties: false,
      required: ["form", "proportions", "orientation", "dominantAxis", "symmetry"],
      properties: {
        form: { type: "string" },
        proportions: {
          type: "object",
          additionalProperties: false,
          required: ["width", "height", "depth"],
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            depth: { type: "number" },
          },
        },
        orientation: { type: "string" },
        dominantAxis: { type: "string", enum: ["x", "y", "z"] },
        symmetry: { type: "string", enum: ["none", "bilateral", "radial", "rotational"] },
      },
    },
    exclusions: { type: "array", items: { type: "string" } },
    recognitionCriticalParts: { type: "array", items: { type: "string" } },
    parts: {
      type: "array",
      minItems: 3,
      maxItems: 32,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "name",
          "role",
          "primitive",
          "purpose",
          "relativeSize",
          "relativePosition",
          "rotation",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: {
            type: "string",
            enum: [
              "structure",
              "housing",
              "power",
              "motion",
              "control",
              "input",
              "output",
              "thermal",
              "fluid",
              "electrical",
              "support",
              "fastener",
              "surface",
              "grip",
              "optical",
              "storage",
              "other",
            ],
          },
          primitive: { type: "string", enum: [...ALLOWED_PLAN_PRIMITIVES] },
          axis: { type: "string", enum: ["x", "y", "z"] },
          purpose: { type: "string" },
          relativeSize: vec3Schema,
          relativePosition: vec3Schema,
          rotation: vec3Schema,
          parentId: { type: ["string", "null"] },
          relatedIds: { type: "array", items: { type: "string" } },
          spatialRelationships: { type: "array", items: { type: "string" } },
          mirroredFrom: { type: "string" },
          repeatGroup: { type: "string" },
          color: { type: "string" },
          detail: { type: "boolean" },
        },
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "type"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          type: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    plannerNotes: { type: "string" },
  },
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const componentId = (index: number) =>
  `COMP-${String(index).padStart(6, "0")}`;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;

const asStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 24)
    : [];

function asFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Normalize Workers AI Vec3 shapes: number[] | string[] | {x,y,z} | {width,height,depth}. */
function extractVec3Entries(value: unknown): unknown[] | null {
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3);
  if (!isObject(value)) return null;
  const x = value.x ?? value.width ?? value["0"];
  const y = value.y ?? value.height ?? value["1"];
  const z = value.z ?? value.depth ?? value["2"];
  if (x === undefined || y === undefined || z === undefined) return null;
  return [x, y, z];
}

function asVec3(value: unknown, fallback: Vec3, min: number, max: number): Vec3 {
  const entries = extractVec3Entries(value);
  if (!entries) return fallback;
  return entries.map((entry, index) => clamp(asFiniteNumber(entry, fallback[index]), min, max)) as Vec3;
}

function pickVec3Field(
  entry: Record<string, unknown>,
  keys: string[],
  fallback: Vec3,
  min: number,
  max: number,
): { value: Vec3; usedFallback: boolean } {
  for (const key of keys) {
    if (entry[key] === undefined || entry[key] === null) continue;
    const entries = extractVec3Entries(entry[key]);
    if (!entries) continue;
    return {
      value: entries.map((component, index) => clamp(asFiniteNumber(component, fallback[index]), min, max)) as Vec3,
      usedFallback: false,
    };
  }
  return { value: fallback, usedFallback: true };
}

function axisSpan(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

function centerAxisSpans(parts: GeometryPlanPart[]) {
  return [0, 1, 2].map((axis) => axisSpan(parts.map((part) => part.relativePosition[axis])));
}

function extentAxisSpans(parts: GeometryPlanPart[]) {
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      const half = part.relativeSize[axis] / 2;
      mins[axis] = Math.min(mins[axis], part.relativePosition[axis] - half);
      maxs[axis] = Math.max(maxs[axis], part.relativePosition[axis] + half);
    }
  }
  return mins.map((min, axis) => maxs[axis] - min);
}

function hasNearIdenticalSizes(parts: GeometryPlanPart[]) {
  const signature = (part: GeometryPlanPart) =>
    part.relativeSize.map((value) => value.toFixed(3)).join(",");
  const first = signature(parts[0]);
  return parts.every((part) => signature(part) === first);
}

function hasCollapsedSpatialLayout(parts: GeometryPlanPart[]): { collapsed: boolean; reason?: string } {
  if (parts.length < 2) return { collapsed: false };
  const allAtOrigin = parts.every((part) =>
    part.relativePosition.every((value) => Math.abs(value) < 1e-6),
  );
  if (allAtOrigin) {
    return { collapsed: true, reason: "all parts share the origin" };
  }
  const signature = (part: GeometryPlanPart) =>
    `${part.relativePosition.map((value) => value.toFixed(4)).join(",")}|${part.relativeSize.map((value) => value.toFixed(4)).join(",")}`;
  const first = signature(parts[0]);
  if (parts.every((part) => signature(part) === first)) {
    return { collapsed: true, reason: "all parts share identical origin/size" };
  }

  const centerSpans = centerAxisSpans(parts);
  const maxCenterSpan = Math.max(...centerSpans);
  if (maxCenterSpan < MIN_PLAN_POSITION_SPAN) {
    return {
      collapsed: true,
      reason: `part centers span only ${maxCenterSpan.toFixed(4)} (min ${MIN_PLAN_POSITION_SPAN})`,
    };
  }

  const extentSpans = extentAxisSpans(parts);
  const maxExtentSpan = Math.max(...extentSpans);
  if (maxExtentSpan < MIN_PLAN_EXTENT_SPAN) {
    return {
      collapsed: true,
      reason: `union AABB span only ${maxExtentSpan.toFixed(4)} (min ${MIN_PLAN_EXTENT_SPAN})`,
    };
  }

  // Tiny positional jitter with cloned sizes still collapses into stacked mush.
  if (hasNearIdenticalSizes(parts) && maxCenterSpan < MIN_PLAN_POSITION_SPAN * 2) {
    return {
      collapsed: true,
      reason: `near-identical sizes with weak center span ${maxCenterSpan.toFixed(4)}`,
    };
  }

  return { collapsed: false };
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function excludedByPrompt(part: GeometryPlanPart, exclusions: string[]) {
  if (!exclusions.length) return false;
  const haystack = normalizeToken(`${part.name} ${part.purpose} ${(part.spatialRelationships ?? []).join(" ")}`);
  return exclusions.some((exclusion) => {
    const normalized = normalizeToken(exclusion);
    return normalized.length >= 4 && haystack.includes(normalized);
  });
}

function hasHierarchyCycle(parts: GeometryPlanPart[]) {
  const byId = new Map(parts.map((part) => [part.id, part]));
  return parts.some((part) => {
    const visited = new Set<string>();
    let current: GeometryPlanPart | undefined = part;
    while (current?.parentId) {
      if (visited.has(current.parentId)) return true;
      visited.add(current.parentId);
      current = byId.get(current.parentId);
    }
    return false;
  });
}


function reflectVec3AcrossAxis(value: Vec3, axis: 0 | 1 | 2): Vec3 {
  const next: Vec3 = [value[0], value[1], value[2]];
  next[axis] = -next[axis];
  return next;
}

function reflectRotationAcrossAxis(value: Vec3, axis: 0 | 1 | 2): Vec3 {
  if (axis === 0) return [value[0], -value[1], -value[2]];
  if (axis === 1) return [-value[0], value[1], -value[2]];
  return [-value[0], -value[1], value[2]];
}

function oppositeSideName(name: string) {
  if (/\bleft\b/i.test(name)) return name.replace(/\bleft\b/gi, (match) => (match[0] === "L" ? "Right" : "right"));
  if (/\bright\b/i.test(name)) return name.replace(/\bright\b/gi, (match) => (match[0] === "R" ? "Left" : "left"));
  return null;
}

function oppositeSideId(id: string) {
  if (/left/i.test(id)) return id.replace(/left/gi, (match) => (match[0] === "L" ? "Right" : "right"));
  if (/right/i.test(id)) return id.replace(/right/gi, (match) => (match[0] === "R" ? "Left" : "left"));
  return null;
}

/** Enforce / complete bilateral mirrors (mirroredFrom + Left/Right pairs). Mirror axis is X. */
export function sanitizeBilateralMirrors(
  parts: GeometryPlanPart[],
  symmetry: SymmetryKind,
  warnings: string[],
): SymmetryKind {
  const byId = new Map(parts.map((part) => [part.id, part]));
  const byName = new Map(parts.map((part) => [part.name.toLowerCase(), part]));
  const axis: 0 | 1 | 2 = 0;

  const enforcePair = (part: GeometryPlanPart, source: GeometryPlanPart) => {
    if (source.mirroredFrom !== part.id) source.mirroredFrom = part.id;
    part.mirroredFrom = source.id;

    let repaired = false;
    if (part.relativeSize.some((value, index) => Math.abs(value - source.relativeSize[index]) > 1e-3)) {
      part.relativeSize = [source.relativeSize[0], source.relativeSize[1], source.relativeSize[2]];
      repaired = true;
    }
    const expectedPosition = reflectVec3AcrossAxis(source.relativePosition, axis);
    if (part.relativePosition.some((value, index) => Math.abs(value - expectedPosition[index]) > 0.05)) {
      part.relativePosition = expectedPosition;
      repaired = true;
    }
    const expectedRotation = reflectRotationAcrossAxis(source.rotation, axis);
    if (part.rotation.some((value, index) => Math.abs(value - expectedRotation[index]) > 0.5)) {
      part.rotation = expectedRotation;
      repaired = true;
    }
    if (part.primitive !== source.primitive) {
      part.primitive = source.primitive;
      part.axis = source.axis;
      repaired = true;
    }
    if (repaired) warnings.push(`Repaired bilateral mirror ${part.id} from ${source.id} across X.`);
  };

  for (const part of parts) {
    if (!part.mirroredFrom) continue;
    const source = byId.get(part.mirroredFrom);
    if (!source || source.id === part.id) {
      delete part.mirroredFrom;
      continue;
    }
    enforcePair(part, source);
  }

  if (symmetry === "bilateral") {
    for (const part of parts) {
      if (part.mirroredFrom) continue;
      const oppositeName = oppositeSideName(part.name);
      const oppositeId = oppositeSideId(part.id);
      const mate =
        (oppositeName ? byName.get(oppositeName.toLowerCase()) : undefined)
        ?? (oppositeId ? byId.get(oppositeId) : undefined);
      if (!mate || mate.id === part.id) continue;
      if (part.relativePosition[axis] > mate.relativePosition[axis]) continue;
      enforcePair(mate, part);
      warnings.push(`Linked bilateral pair ${part.id} ↔ ${mate.id}.`);
    }

    const hasMirrorLink = parts.some((part) => Boolean(part.mirroredFrom));
    const xs = parts.map((part) => part.relativePosition[0]);
    const hasBothSides = xs.some((value) => value < -0.05) && xs.some((value) => value > 0.05);
    if (!hasMirrorLink && !hasBothSides) {
      warnings.push("Bilateral silhouette had no left/right span or mirrored pairs; downgraded symmetry to none.");
      return "none";
    }
  }

  return symmetry;
}


function partMatchesCriticalToken(part: GeometryPlanPart, token: string) {
  const needle = normalizeToken(token);
  if (!needle) return false;
  const haystack = normalizeToken(`${part.id} ${part.name} ${part.purpose}`);
  return haystack.includes(needle);
}

/** Fail closed when recognitionCriticalParts are empty or none match any part. */
export function assertRecognitionCriticalCoverage(
  parts: GeometryPlanPart[],
  critical: string[],
  warnings: string[],
): { ok: boolean; critical: string[] } {
  let cleaned = critical.map((item) => item.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    cleaned = parts.slice(0, 3).map((part) => part.name);
    warnings.push("Seeded recognitionCriticalParts from leading part names.");
    return { ok: true, critical: cleaned };
  }
  const uncovered = cleaned.filter((token) => !parts.some((part) => partMatchesCriticalToken(part, token)));
  if (uncovered.length === cleaned.length) {
    warnings.push(`recognitionCriticalParts unmatched: ${uncovered.slice(0, 6).join(", ")}.`);
    return { ok: false, critical: cleaned };
  }
  if (uncovered.length) {
    warnings.push(`Some recognitionCriticalParts unmatched: ${uncovered.slice(0, 6).join(", ")}.`);
  }
  return { ok: true, critical: cleaned };
}

type SpatialRelationKind = "above" | "below" | "inside" | "front" | "back" | "attached";

function parseSpatialCue(text: string): { kind: SpatialRelationKind; target?: string } | null {
  const value = text.toLowerCase();
  const kind: SpatialRelationKind | null =
    /\babove\b/.test(value) ? "above"
    : /\bbelow\b/.test(value) ? "below"
    : /\binside\b/.test(value) ? "inside"
    : /\bfront\b/.test(value) ? "front"
    : /\bback\b|\brear\b/.test(value) ? "back"
    : /\battached\b|\bconnected\b|\bhinged\b/.test(value) ? "attached"
    : null;
  if (!kind) return null;
  const targetMatch = value.match(/\b(?:above|below|inside|front|back|rear|attached to|connected to|hinged (?:at|to))\s+([a-z0-9 _-]+)/i);
  const target = targetMatch?.[1]?.trim().replace(/\s+/g, " ");
  return { kind, target: target || undefined };
}

function findRelatedPart(parts: GeometryPlanPart[], part: GeometryPlanPart, target?: string) {
  if (target) {
    const needle = normalizeToken(target);
    const hit = parts.find((candidate) => candidate.id !== part.id && (
      normalizeToken(candidate.id) === needle
      || normalizeToken(candidate.name).includes(needle)
      || needle.includes(normalizeToken(candidate.id))
    ));
    if (hit) return hit;
  }
  if (part.parentId) {
    const parent = parts.find((candidate) => candidate.id === part.parentId);
    if (parent) return parent;
  }
  return parts.find((candidate) => candidate.id !== part.id && (part.relatedIds ?? []).includes(candidate.id));
}

/** Holodeck-style soft constraint repair from spatialRelationships / relationship types. */
export function applyHolodeckConstraintRepairs(
  parts: GeometryPlanPart[],
  relationships: Array<{ from: string; to: string; type: string; description?: string }>,
  warnings: string[],
) {
  const byId = new Map(parts.map((part) => [part.id, part]));

  const applyKind = (part: GeometryPlanPart, anchor: GeometryPlanPart, kind: SpatialRelationKind) => {
    const gap = Math.max(0.08, (anchor.relativeSize[1] + part.relativeSize[1]) * 0.35);
    const depthGap = Math.max(0.08, (anchor.relativeSize[2] + part.relativeSize[2]) * 0.35);
    const next: Vec3 = [part.relativePosition[0], part.relativePosition[1], part.relativePosition[2]];
    if (kind === "above") next[1] = anchor.relativePosition[1] + gap;
    if (kind === "below") next[1] = anchor.relativePosition[1] - gap;
    if (kind === "inside") {
      next[0] = anchor.relativePosition[0];
      next[1] = anchor.relativePosition[1];
      next[2] = anchor.relativePosition[2];
    }
    if (kind === "front") next[2] = anchor.relativePosition[2] + depthGap;
    if (kind === "back") next[2] = anchor.relativePosition[2] - depthGap;
    if (kind === "attached") {
      // Keep current offset unless nearly coincident with unrelated mush.
      if (Math.hypot(next[0] - anchor.relativePosition[0], next[1] - anchor.relativePosition[1], next[2] - anchor.relativePosition[2]) < 0.02) {
        next[1] = anchor.relativePosition[1] + gap * 0.5;
      }
    }
    const moved = next.some((value, index) => Math.abs(value - part.relativePosition[index]) > 0.04);
    if (moved) {
      part.relativePosition = [
        clamp(next[0], -1.5, 1.5),
        clamp(next[1], -1.5, 1.5),
        clamp(next[2], -1.5, 1.5),
      ];
      warnings.push(`Holodeck repair: moved ${part.id} ${kind} relative to ${anchor.id}.`);
    }
  };

  for (const part of parts) {
    for (const cueText of part.spatialRelationships ?? []) {
      const cue = parseSpatialCue(cueText);
      if (!cue) continue;
      const anchor = findRelatedPart(parts, part, cue.target);
      if (!anchor) {
        warnings.push(`Holodeck constraint unmatched for ${part.id}: "${cueText}".`);
        continue;
      }
      applyKind(part, anchor, cue.kind);
    }
  }

  for (const rel of relationships) {
    const from = byId.get(rel.from);
    const to = byId.get(rel.to);
    if (!from || !to) continue;
    const cue = parseSpatialCue(`${rel.type} ${rel.description ?? ""}`)
      ?? (/\babove\b/i.test(rel.type) ? { kind: "above" as const, target: undefined }
        : /\bbelow\b/i.test(rel.type) ? { kind: "below" as const, target: undefined }
        : /\binside\b/i.test(rel.type) ? { kind: "inside" as const, target: undefined }
        : /\battached|hinged|connected\b/i.test(rel.type) ? { kind: "attached" as const, target: undefined }
        : null);
    if (!cue) continue;
    applyKind(from, to, cue.kind);
  }
}

export function validateAndSanitizeGeometryPlan(raw: unknown, prompt: string): PlanValidationResult {
  const warnings: string[] = [];
  if (!isObject(raw)) return { ok: false, warnings: ["Planner output was not an object."] };

  const requested = isObject(raw.requestedObject) ? raw.requestedObject : {};
  const rawSilhouette = isObject(raw.silhouette) ? raw.silhouette : {};
  const rawProportions = isObject(rawSilhouette.proportions) ? rawSilhouette.proportions : {};
  const scope = allowedScopes.has(requested.scope as ObjectScope) ? requested.scope as ObjectScope : "complete_object";
  if (!allowedScopes.has(requested.scope as ObjectScope)) warnings.push("Repaired missing or invalid object scope.");

  const dominantAxis = allowedAxes.has(rawSilhouette.dominantAxis as CylinderAxis) ? rawSilhouette.dominantAxis as CylinderAxis : "x";
  const symmetry = allowedSymmetry.has(rawSilhouette.symmetry as SymmetryKind) ? rawSilhouette.symmetry as SymmetryKind : "none";
  const proportions = {
    width: clamp(asFiniteNumber(rawProportions.width, 1), 0.2, 4),
    height: clamp(asFiniteNumber(rawProportions.height, 1), 0.2, 4),
    depth: clamp(asFiniteNumber(rawProportions.depth, 1), 0.2, 4),
  };

  const exclusions = asStringArray(raw.exclusions);
  const rawParts = Array.isArray(raw.parts) ? raw.parts : [];
  if (rawParts.length < 3) return { ok: false, warnings: ["Planner returned fewer than 3 parts."] };
  if (rawParts.length > 32) warnings.push("Trimmed planner output to the first 32 parts.");

  const seen = new Set<string>();
  const parts: GeometryPlanPart[] = [];
  for (const entry of rawParts.slice(0, 32)) {
    if (!isObject(entry)) {
      warnings.push("Dropped non-object part.");
      continue;
    }
    const id = asString(entry.id);
    if (!partIdPattern.test(id) || seen.has(id)) {
      warnings.push(`Dropped part with invalid or duplicate id: ${id || "(missing)"}.`);
      continue;
    }
    const name = asString(entry.name);
    if (!name) {
      warnings.push(`Dropped ${id} because it has no name.`);
      continue;
    }
    const primitive = allowedPrimitives.has(entry.primitive as PrimitiveKind) ? entry.primitive as PrimitiveKind : "box";
    if (!allowedPrimitives.has(entry.primitive as PrimitiveKind) && entry.primitive !== undefined) {
      warnings.push(`Repaired unsupported primitive for ${id}; defaulted to box.`);
    }
    const role = allowedRoles.has(entry.role as PartRole) ? entry.role as PartRole : "other";
    const sizeField = pickVec3Field(entry, ["relativeSize", "relative_size", "size", "dimensions"], [0.35, 0.2, 0.2], 0.03, 1.8);
    const positionField = pickVec3Field(entry, ["relativePosition", "relative_position", "position", "offset"], [0, 0, 0], -1.5, 1.5);
    const rotationField = pickVec3Field(entry, ["rotation", "rotate"], [0, 0, 0], -180, 180);
    if (sizeField.usedFallback) warnings.push(`Repaired missing/unusable relativeSize for ${id}.`);
    if (positionField.usedFallback) warnings.push(`Repaired missing/unusable relativePosition for ${id}.`);
    const part: GeometryPlanPart = {
      id,
      name,
      role,
      primitive,
      axis: axialPrimitive(primitive) && allowedAxes.has(entry.axis as CylinderAxis) ? entry.axis as CylinderAxis : undefined,
      purpose: asString(entry.purpose, `Represents the ${name.toLowerCase()} in the requested object.`),
      relativeSize: sizeField.value,
      relativePosition: positionField.value,
      rotation: rotationField.value,
      parentId: typeof entry.parentId === "string" ? entry.parentId : null,
      relatedIds: asStringArray(entry.relatedIds),
      spatialRelationships: asStringArray(entry.spatialRelationships),
      mirroredFrom: typeof entry.mirroredFrom === "string" ? entry.mirroredFrom : undefined,
      repeatGroup: typeof entry.repeatGroup === "string" ? entry.repeatGroup : undefined,
      color: /^#[0-9a-f]{6}$/i.test(String(entry.color)) ? String(entry.color) : undefined,
      detail: Boolean(entry.detail),
    };
    if (excludedByPrompt(part, exclusions)) {
      warnings.push(`Dropped excluded part: ${part.name}.`);
      continue;
    }
    seen.add(id);
    parts.push(part);
  }

  if (parts.length < 3) return { ok: false, warnings: [...warnings, "Too few valid parts remained after validation."] };

  for (const part of parts) {
    if (part.parentId && !seen.has(part.parentId)) {
      part.parentId = null;
      warnings.push(`Cleared missing parent for ${part.id}.`);
    }
    part.relatedIds = (part.relatedIds ?? []).filter((id) => id !== part.id && seen.has(id));
    if (part.mirroredFrom && !seen.has(part.mirroredFrom)) delete part.mirroredFrom;
  }

  const resolvedSymmetry = sanitizeBilateralMirrors(parts, symmetry, warnings);

  if (hasHierarchyCycle(parts)) return { ok: false, warnings: [...warnings, "Planner hierarchy contains a cycle."] };
  const spatialCollapse = hasCollapsedSpatialLayout(parts);
  if (spatialCollapse.collapsed) {
    return {
      ok: false,
      warnings: [
        ...warnings,
        `Planner layout is collapsed: ${spatialCollapse.reason} (invalid spatial assembly).`,
      ],
    };
  }

  const relationships = Array.isArray(raw.relationships)
    ? raw.relationships.filter(isObject).map((item) => ({
      from: asString(item.from),
      to: asString(item.to),
      type: asString(item.type, "related"),
      description: asString(item.description),
    })).filter((item) => seen.has(item.from) && seen.has(item.to) && item.from !== item.to).slice(0, 64)
    : [];

  const recognitionCriticalPartsRaw = asStringArray(raw.recognitionCriticalParts);
  const criticalCoverage = assertRecognitionCriticalCoverage(parts, recognitionCriticalPartsRaw, warnings);
  if (!criticalCoverage.ok) {
    return {
      ok: false,
      warnings: [...warnings, "Planner recognizability failed: recognitionCriticalParts coverage invalid."],
    };
  }
  const recognitionCriticalParts = criticalCoverage.critical;

  applyHolodeckConstraintRepairs(parts, relationships, warnings);
  const postConstraintCollapse = hasCollapsedSpatialLayout(parts);
  if (postConstraintCollapse.collapsed) {
    return {
      ok: false,
      warnings: [
        ...warnings,
        `Planner layout collapsed after Holodeck constraint repair: ${postConstraintCollapse.reason}.`,
      ],
    };
  }

  return {
    ok: true,
    warnings,
    plan: {
      schemaVersion: GEOMETRY_PLAN_SCHEMA_VERSION,
      requestedObject: {
        identity: asString(requested.identity, prompt.trim() || "Generated Object"),
        subtype: asString(requested.subtype),
        scope,
      },
      silhouette: {
        form: asString(rawSilhouette.form, "composite object"),
        proportions,
        orientation: asString(rawSilhouette.orientation, "upright or operational orientation"),
        dominantAxis,
        symmetry: resolvedSymmetry,
      },
      exclusions,
      recognitionCriticalParts,
      parts,
      relationships,
      plannerNotes: asString(raw.plannerNotes),
    },
  };
}

const palette = ["#667d8d", "#44515b", "#8d9aa3", "#c59644", "#3b7894", "#2f363b", "#b8c3ca"];

function scaleVec(value: Vec3, scale: number): Vec3 {
  return value.map((entry) => entry * scale) as Vec3;
}

export function geometryPlanToProject(
  plan: GeometryPlan,
  prompt: string,
  options: { scale?: number; detail?: DetailLevel; plannerSource?: ForgeProject["planner"] } = {},
): ForgeProject {
  const scale = clamp(options.scale ?? 1, 0.5, 1.8);
  const detail = options.detail ?? "detailed";
  const selected = plan.parts.filter((part) => detail === "detailed" || !part.detail);
  const selectedIds = new Set(selected.map((part) => part.id));
  const idByPlanId = new Map(selected.map((part, index) => [part.id, componentId(index + 1)]));
  const base = 150;
  const objectSize: Vec3 = [
    plan.silhouette.proportions.width * base,
    plan.silhouette.proportions.height * base,
    plan.silhouette.proportions.depth * base,
  ];

  const parts: ForgePart[] = selected.map((part, index) => {
    const position = part.relativePosition.map((value, axis) => value * objectSize[axis] * 0.55) as Vec3;
    const size = part.relativeSize.map((value, axis) => Math.max(3, value * objectSize[axis])) as Vec3;
    const outward = position.map((value, axis) => {
      if (Math.abs(value) > 3) return value * 0.85;
      return (index % 2 === 0 ? 1 : -1) * (axis === 1 ? 45 : 70);
    }) as Vec3;
    const spatial = part.spatialRelationships?.length ? ` Spatial relationships: ${part.spatialRelationships.join("; ")}.` : "";
    return {
      id: idByPlanId.get(part.id)!,
      name: part.name,
      kind: part.primitive,
      axis: axialPrimitive(part.primitive) ? part.axis ?? plan.silhouette.dominantAxis : undefined,
      parent: part.parentId && selectedIds.has(part.parentId) ? idByPlanId.get(part.parentId)! : null,
      category: part.role,
      purpose: `${part.purpose}${spatial}`,
      position: scaleVec(position, scale),
      size: scaleVec(size, scale),
      rotation: part.rotation,
      explode: scaleVec(outward, scale),
      related: (part.relatedIds ?? []).filter((id) => selectedIds.has(id)).map((id) => idByPlanId.get(id)!),
      color: part.color ?? palette[index % palette.length],
      hidden: false,
      detached: false,
    };
  });

  return {
    format: "ShapeForge Project",
    formatVersion: 2,
    id: "PROJ-000001",
    name: plan.requestedObject.subtype
      ? `${plan.requestedObject.subtype} ${plan.requestedObject.identity}`.trim()
      : plan.requestedObject.identity,
    prompt,
    createdAt: new Date().toISOString(),
    source: options.plannerSource?.source === "workers-ai" ? "workers-ai" : "procedural-concept",
    planner: options.plannerSource,
    allocator: { nextComponent: parts.length + 1 },
    settings: { scale, detail },
    parts,
    history: [
      `Physical-object plan: ${plan.requestedObject.identity}`,
      `Silhouette: ${plan.silhouette.form}; symmetry=${plan.silhouette.symmetry}; axis=${plan.silhouette.dominantAxis}`,
    ],
  };
}
