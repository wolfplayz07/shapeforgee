/**
 * General spec lookup that runs before generation:
 *   1. bundled license-clean spec table (lib/spec-table.ts), synchronous
 *   2. NHTSA vPIC Canadian vehicle specifications for "<year> <make> <model>" vehicle prompts, bounded by a timeout
 * Results are applied conservatively (proportions only on generated geometry, annotations on hand-tuned recipes)
 * and always recorded as project.planner.spec provenance. Nothing here may block generation: every network call is
 * time-boxed and every failure degrades to "no spec".
 */
import { isVehicleComponentPrompt, type ForgeProject, type PlannerSpec, type Vec3 } from "./shapeforge-core.ts";
import { findSpecEntry, SERVICE_DATA_DEFAULT, SPEC_SOURCES, type SpecEntry } from "./spec-table.ts";

export const VPIC_TIMEOUT_MS = 2500;
const VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/GetCanadianVehicleSpecifications/";
const PROPORTION_TOLERANCE = 0.08;
const FACTOR_RANGE: [number, number] = [0.7, 1.45];

type FetchLike = (input: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface SpecLookupOptions {
  fetch?: FetchLike;
  vehicleTimeoutMs?: number;
  vehicleLookup?: boolean;
}

export interface SpecLookupResult {
  entry: SpecEntry | null;
  spec: PlannerSpec;
}

const vehicleCache = new Map<string, PlannerSpec["vehicle"] | null>();

function baseSpec(): PlannerSpec {
  return {
    matched: null,
    applied: [],
    lookups: [],
    sources: [],
    torque: SERVICE_DATA_DEFAULT,
    procedures: SERVICE_DATA_DEFAULT,
  };
}

function addSource(spec: PlannerSpec, id: string) {
  const source = SPEC_SOURCES[id];
  if (source && !spec.sources.some((entry) => entry.id === id)) spec.sources.push({ ...source });
}

const VEHICLE_WORDS = /\b(car|truck|suv|van|coupe|sedan|roadster|hatchback|wagon|pickup)\b/;
const YEAR_MAKE_MODEL = /\b(19[7-9]\d|20[0-4]\d)\s+([a-z][a-z-]+)\s+([a-z0-9][a-z0-9-]*)/;

export function parseVehiclePrompt(prompt: string): { year: number; make: string; model: string } | null {
  const value = prompt.toLowerCase();
  if (isVehicleComponentPrompt(value)) return null;
  const match = value.match(YEAR_MAKE_MODEL);
  if (!match) return null;
  const [, year, make, model] = match;
  if (VEHICLE_WORDS.test(model)) return null;
  return { year: Number(year), make, model };
}

async function fetchWithTimeout(fetchImpl: FetchLike, url: string, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetchImpl(url, { signal: controller.signal, headers: { "User-Agent": "ShapeForge spec lookup" } }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("SPEC_LOOKUP_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function lookupVehicle(
  vehicle: { year: number; make: string; model: string },
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<{ status: "hit" | "miss" | "timeout" | "error"; value?: PlannerSpec["vehicle"]; note?: string }> {
  const key = `${vehicle.year}|${vehicle.make}|${vehicle.model}`;
  if (vehicleCache.has(key)) {
    const cached = vehicleCache.get(key);
    return cached ? { status: "hit", value: cached, note: "cached" } : { status: "miss", note: "cached" };
  }
  const url = `${VPIC_URL}?Year=${vehicle.year}&Make=${encodeURIComponent(vehicle.make)}&Model=${encodeURIComponent(vehicle.model)}&units=&format=json`;
  try {
    const response = await fetchWithTimeout(fetchImpl, url, timeoutMs);
    if (!response.ok) return { status: "error", note: "HTTP error" };
    const body = (await response.json()) as { Results?: Array<{ Specs?: Array<{ Name: string; Value: string }> }> };
    const specs = body.Results?.[0]?.Specs;
    const read = (name: string) => {
      const raw = specs?.find((entry) => entry.Name === name)?.Value;
      const number = raw === undefined ? NaN : Number(raw);
      return Number.isFinite(number) && number > 0 ? number : undefined;
    };
    const length = read("OL");
    const width = read("OW");
    const height = read("OH");
    if (!specs || !length || !width || !height) {
      vehicleCache.set(key, null);
      return { status: "miss" };
    }
    const wheelbase = read("WB");
    const value: PlannerSpec["vehicle"] = {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: specs.find((entry) => entry.Name === "Model")?.Value,
      // vPIC Canadian specifications report centimetres.
      lengthMm: length * 10,
      widthMm: width * 10,
      heightMm: height * 10,
      ...(wheelbase ? { wheelbaseMm: wheelbase * 10 } : {}),
      source: "nhtsa-vpic",
      confidence: "spec",
    };
    vehicleCache.set(key, value);
    return { status: "hit", value };
  } catch (error) {
    const timeout = error instanceof Error && error.message === "SPEC_LOOKUP_TIMEOUT";
    return { status: timeout ? "timeout" : "error", note: error instanceof Error ? error.message : String(error) };
  }
}

/** Look up trusted specs for a prompt. Never throws; worst case returns an empty spec with "miss" lookups. */
export async function lookupSpec(prompt: string, options: SpecLookupOptions = {}): Promise<SpecLookupResult> {
  const spec = baseSpec();
  const started = Date.now();
  const entry = findSpecEntry(prompt);
  spec.lookups.push({ source: "spec-table", status: entry ? "hit" : "miss", ms: Date.now() - started });
  if (entry) {
    spec.matched = entry.id;
    spec.label = entry.label;
    if (entry.extentMm) {
      spec.extentMm = { x: { ...entry.extentMm.x }, y: { ...entry.extentMm.y }, z: { ...entry.extentMm.z } };
      for (const axis of ["x", "y", "z"] as const) addSource(spec, entry.extentMm[axis].source);
    }
    spec.parts = { names: [...entry.parts.value], source: entry.parts.source, confidence: entry.parts.confidence };
    addSource(spec, entry.parts.source);
    if (entry.parts.note?.includes("commons-disc-brake-components")) addSource(spec, "commons-disc-brake-components");
    if (entry.attachments?.length) {
      spec.attachments = entry.attachments.map((attachment) => ({ ...attachment, linked: false }));
      for (const attachment of entry.attachments) addSource(spec, attachment.source);
    }
  }

  const vehicle = parseVehiclePrompt(prompt);
  const fetchImpl = options.fetch ?? (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined);
  if (!vehicle) {
    spec.lookups.push({ source: "nhtsa-vpic", status: "skipped", note: "not a <year> <make> <model> vehicle prompt" });
  } else if (options.vehicleLookup === false || !fetchImpl) {
    spec.lookups.push({ source: "nhtsa-vpic", status: "skipped", note: "vehicle lookup disabled" });
  } else {
    const vehicleStarted = Date.now();
    const result = await lookupVehicle(vehicle, fetchImpl, options.vehicleTimeoutMs ?? VPIC_TIMEOUT_MS);
    spec.lookups.push({ source: "nhtsa-vpic", status: result.status, ms: Date.now() - vehicleStarted, ...(result.note ? { note: result.note } : {}) });
    if (result.value) {
      spec.vehicle = result.value;
      if (!spec.matched) {
        spec.matched = `vehicle:${vehicle.year}-${vehicle.make}-${vehicle.model}`;
        spec.label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
      }
      addSource(spec, "nhtsa-vpic");
    }
  }
  spec.lookups.push({ source: "web-reference", status: "skipped", note: "deferred: no license-clean general lookup wired yet" });
  return { entry, spec };
}

/* ---------------------------------------------------------------- application ---------------------------------------------------------------- */

const tokens = (name: string) =>
  name.toLowerCase().replace(/\(.*?\)/g, " ").split(/[^a-z0-9]+/).filter(Boolean).map((token) => token.replace(/s$/, ""));

function matchPart(project: ForgeProject, specName: string) {
  const want = tokens(specName);
  return project.parts.filter((part) => {
    const have = new Set(tokens(part.name));
    return want.every((token) => have.has(token));
  });
}

function extents(project: ForgeProject): Vec3 {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const part of project.parts) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], part.position[axis] - part.size[axis] / 2);
      max[axis] = Math.max(max[axis], part.position[axis] + part.size[axis] / 2);
    }
  }
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
}

function targetExtent(spec: PlannerSpec, project: ForgeProject): Vec3 | null {
  if (spec.vehicle && project.source === "procedural-vehicle") {
    // Vehicle recipe convention: x = length, y = height, z = width.
    return [spec.vehicle.lengthMm, spec.vehicle.heightMm, spec.vehicle.widthMm];
  }
  if (spec.extentMm) return [spec.extentMm.x.value, spec.extentMm.y.value, spec.extentMm.z.value];
  return null;
}

/** Per-axis factors that move the project's bounding-box ratios toward the sourced ratios (clamped). */
export function proportionFactors(current: Vec3, target: Vec3): Vec3 {
  const currentMax = Math.max(...current);
  const targetMax = Math.max(...target);
  if (!(currentMax > 0) || !(targetMax > 0)) return [1, 1, 1];
  return current.map((value, axis) => {
    if (!(value > 0) || !(target[axis] > 0)) return 1;
    const factor = (target[axis] / targetMax) / (value / currentMax);
    return Math.max(FACTOR_RANGE[0], Math.min(FACTOR_RANGE[1], factor));
  }) as Vec3;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Apply a spec lookup to a finished project. Hand-tuned recovered recipes are annotated only (their proportions are
 * reported, not changed); generated geometry (semantic fallback, Workers AI, spec layout, procedural vehicle with vPIC
 * dimensions) gets clamped per-axis proportion correction. Attachments link matching parts via `related`.
 */
export function applySpecToProject(project: ForgeProject, lookup: SpecLookupResult): ForgeProject {
  const spec: PlannerSpec = JSON.parse(JSON.stringify(lookup.spec));
  const plannerSource = project.planner?.source;

  if (spec.parts) {
    const present: string[] = [];
    const missing: string[] = [];
    for (const name of spec.parts.names) (matchPart(project, name).length ? present : missing).push(name);
    spec.partCoverage = { present, missing };
    spec.applied.push(`part coverage ${present.length}/${spec.parts.names.length}`);
  }

  if (spec.attachments) {
    let linked = 0;
    for (const attachment of spec.attachments) {
      const a = matchPart(project, attachment.a)[0];
      const b = matchPart(project, attachment.b)[0];
      if (!a || !b || a.id === b.id) continue;
      if (!a.related.includes(b.id)) a.related.push(b.id);
      if (!b.related.includes(a.id)) b.related.push(a.id);
      attachment.linked = true;
      linked += 1;
    }
    if (linked) spec.applied.push(`linked ${linked} sourced attachment(s)`);
  }

  const target = targetExtent(spec, project);
  if (target && project.parts.length) {
    const current = extents(project);
    const factors = proportionFactors(current, target);
    const deviates = factors.some((factor) => Math.abs(factor - 1) > PROPORTION_TOLERANCE);
    const handTuned = plannerSource === "recovered-recipe" && project.source !== "procedural-vehicle";
    const authoredFromSpec = plannerSource === "spec-table";
    const vehicleWithoutVpic = project.source === "procedural-vehicle" && !spec.vehicle;
    if (authoredFromSpec) {
      spec.applied.push("layout authored from this spec entry; proportions not re-applied");
    } else if (deviates && !handTuned && !vehicleWithoutVpic) {
      for (const part of project.parts) {
        part.position = part.position.map((value, axis) => round(value * factors[axis])) as Vec3;
        part.size = part.size.map((value, axis) => round(value * factors[axis])) as Vec3;
        part.explode = part.explode.map((value, axis) => round(value * factors[axis])) as Vec3;
      }
      spec.applied.push(`proportions x${factors.map((factor) => factor.toFixed(2)).join("/")} toward sourced ${spec.vehicle ? "vehicle" : "extent"} ratios`);
    } else if (deviates) {
      spec.applied.push(`proportion check only (hand-tuned recipe kept): sourced/current ratio x${factors.map((factor) => factor.toFixed(2)).join("/")}`);
    } else {
      spec.applied.push("proportions already within tolerance");
    }
  }

  if (!spec.matched) spec.applied.push("no trusted spec found; recipe/shape rules used as-is");
  project.planner = { ...(project.planner ?? { source: "semantic-fallback" }), spec };
  project.history = [...project.history, spec.matched ? `Spec lookup: ${spec.label} (${spec.applied.join("; ")})` : "Spec lookup: no trusted spec"];
  return project;
}

/** Raw GeometryPlan built from a spec entry's trusted layout, for validateAndSanitizeGeometryPlan. */
export function specLayoutPlan(entry: SpecEntry): Record<string, unknown> | null {
  if (!entry.layout) return null;
  const layout = entry.layout;
  const extent = entry.extentMm;
  const maxExtent = extent ? Math.max(extent.x.value, extent.y.value, extent.z.value) : 1;
  const proportions = extent
    ? { width: round((extent.x.value / maxExtent) * 1.2), height: round((extent.y.value / maxExtent) * 1.2), depth: round((extent.z.value / maxExtent) * 1.2) }
    : { width: 1, height: 1, depth: 1 };
  const idByName = new Map(layout.parts.map((part) => [part.name.toLowerCase(), part.id]));
  const findId = (name: string) => {
    const want = tokens(name);
    for (const [partName, id] of idByName) {
      const have = new Set(tokens(partName));
      if (want.every((token) => have.has(token))) return id;
    }
    return undefined;
  };
  return {
    schemaVersion: 1,
    requestedObject: { identity: layout.identity, scope: layout.scope },
    silhouette: { form: layout.form, proportions, orientation: "as installed", dominantAxis: layout.dominantAxis, symmetry: layout.symmetry },
    exclusions: [],
    recognitionCriticalParts: layout.recognitionCriticalParts,
    parts: layout.parts.map((part) => ({
      id: part.id,
      name: part.name,
      role: part.role,
      primitive: part.primitive,
      axis: part.axis,
      purpose: part.purpose,
      relativeSize: part.relativeSize,
      relativePosition: part.relativePosition,
      rotation: [0, 0, 0],
      parentId: part.parentId ?? null,
      relatedIds: part.relatedIds ?? [],
      spatialRelationships: [],
      ...(part.color ? { color: part.color } : {}),
      ...(part.detail ? { detail: true } : {}),
    })),
    relationships: (entry.attachments ?? [])
      .map((attachment) => ({ from: findId(attachment.b), to: findId(attachment.a), type: attachment.kind }))
      .filter((relationship) => relationship.from && relationship.to),
    plannerNotes: `Spec table layout: ${entry.label}`,
  };
}

/** Compact grounding text for the Workers AI planner when a spec matched but has no layout. */
export function specPromptHints(lookup: SpecLookupResult): Record<string, unknown> | undefined {
  const { spec } = lookup;
  if (!spec.matched) return undefined;
  return {
    sourcedParts: spec.parts?.names,
    sourcedExtentMm: spec.extentMm ? { x: spec.extentMm.x.value, y: spec.extentMm.y.value, z: spec.extentMm.z.value } : undefined,
    vehicleMm: spec.vehicle ? { length: spec.vehicle.lengthMm, width: spec.vehicle.widthMm, height: spec.vehicle.heightMm } : undefined,
    instruction: "Use these sourced part names and proportions; do not invent torque values.",
  };
}
