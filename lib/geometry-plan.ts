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
const allowedPrimitives = new Set<PrimitiveKind>(["box", "cylinder"]);
const allowedAxes = new Set<CylinderAxis>(["x", "y", "z"]);
const partIdPattern = /^[a-z][a-z0-9_-]{1,40}$/i;

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
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asVec3(value: unknown, fallback: Vec3, min: number, max: number): Vec3 {
  if (!Array.isArray(value) || value.length !== 3) return fallback;
  return value.map((entry, index) => clamp(asFiniteNumber(entry, fallback[index]), min, max)) as Vec3;
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
    const role = allowedRoles.has(entry.role as PartRole) ? entry.role as PartRole : "other";
    const part: GeometryPlanPart = {
      id,
      name,
      role,
      primitive,
      axis: primitive === "cylinder" && allowedAxes.has(entry.axis as CylinderAxis) ? entry.axis as CylinderAxis : undefined,
      purpose: asString(entry.purpose, `Represents the ${name.toLowerCase()} in the requested object.`),
      relativeSize: asVec3(entry.relativeSize, [0.35, 0.2, 0.2], 0.03, 1.8),
      relativePosition: asVec3(entry.relativePosition, [0, 0, 0], -1.5, 1.5),
      rotation: asVec3(entry.rotation, [0, 0, 0], -180, 180),
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

  if (hasHierarchyCycle(parts)) return { ok: false, warnings: [...warnings, "Planner hierarchy contains a cycle."] };

  const relationships = Array.isArray(raw.relationships)
    ? raw.relationships.filter(isObject).map((item) => ({
      from: asString(item.from),
      to: asString(item.to),
      type: asString(item.type, "related"),
      description: asString(item.description),
    })).filter((item) => seen.has(item.from) && seen.has(item.to) && item.from !== item.to).slice(0, 64)
    : [];

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
        symmetry,
      },
      exclusions,
      recognitionCriticalParts: asStringArray(raw.recognitionCriticalParts),
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
      axis: part.primitive === "cylinder" ? part.axis ?? plan.silhouette.dominantAxis : undefined,
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
