import { z } from "zod";
import { validateForgeProject } from "../../lib/shapeforge.ts";

export const assemblyId = z.string().regex(/^PROJ-\d{6}$/);
export const requestId = z.string().uuid();
export const vector = z.tuple([z.number().finite().min(-20000).max(20000), z.number().finite().min(-20000).max(20000), z.number().finite().min(-20000).max(20000)]);
export const size = z.tuple([z.number().finite().positive().max(20000), z.number().finite().positive().max(20000), z.number().finite().positive().max(20000)]);
export const componentId = z.string().regex(/^COMP-\d{6}$/);
export const partSchema = z.object({
  id: componentId,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["box", "cylinder"]),
  axis: z.enum(["x", "y", "z"]).optional(),
  parent: componentId.nullable(),
  category: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(500),
  position: vector,
  size,
  rotation: vector,
  explode: vector,
  related: z.array(componentId).max(200),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hidden: z.boolean(),
  detached: z.boolean(),
}).strict();
export const partsSchema = z.array(partSchema).min(1).max(200);
export const createSchema = z.object({
  request_id: requestId,
  prompt: z.string().trim().min(1).max(1200),
  name: z.string().trim().min(1).max(120).optional(),
  detail: z.enum(["basic", "detailed"]).default("detailed"),
  scale: z.number().finite().min(0.5).max(1.8).default(1),
}).strict();
export const saveSchema = z.object({
  request_id: requestId,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1200),
  parts: partsSchema,
}).strict();
export const getSchema = z.object({ id: assemblyId, revision: z.number().int().positive().optional() }).strict();
export const listSchema = z.object({ query: z.string().max(120).default(""), limit: z.number().int().min(1).max(50).default(20), offset: z.number().int().min(0).max(1000000).default(0) }).strict();
export const updateSchema = z.object({
  request_id: requestId,
  id: assemblyId,
  expected_revision: z.number().int().positive(),
  component_id: componentId,
  changes: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    position: vector.optional(),
    size: size.optional(),
    rotation: vector.optional(),
    explode: vector.optional(),
    hidden: z.boolean().optional(),
    detached: z.boolean().optional(),
  }).strict(),
}).strict();

export class AssemblyError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function validate(project) {
  partsSchema.parse(project.parts);
  const failed = validateForgeProject(project).filter(check => !check.ok);
  if (failed.length) throw new AssemblyError("INVALID_ASSEMBLY", failed.map(check => check.label).join("; "));
  return project;
}

export function summary(record) {
  const p = record.project;
  return {
    id: p.id, name: p.name, revision: record.revision,
    updated_at: record.updated_at, part_count: p.parts.length, source: p.source,
    warning: p.source === "procedural-concept"
      ? "Unsupported prompt: this is a generic placeholder, not a faithful model. Use save_assembly with explicitly designed parts for a custom project."
      : p.source === "imported"
        ? "Custom concept assembled from supplied primitives; dimensions and engineering validity are not verified."
        : "Stylized procedural assembly, not engineering-accurate CAD or guaranteed model-year geometry.",
  };
}
