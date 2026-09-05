import {
  GEOMETRY_PLAN_SCHEMA_VERSION,
  geometryPlanToProject,
  validateAndSanitizeGeometryPlan,
  type GeometryPlan,
} from "../lib/geometry-plan.ts";
import {
  createSemanticFallbackProject,
  tryRecoveredRecipeProject,
  type DetailLevel,
  type ForgeProject,
} from "../lib/shapeforge.ts";

export const DEFAULT_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const DEFAULT_TIMEOUT_MS = 8_000;

export interface WorkersAIBinding {
  run(model: string, input: unknown): Promise<unknown>;
}

export interface GeometryPlannerProvider {
  readonly source: "workers-ai";
  readonly model: string;
  plan(prompt: string, options?: { signal?: AbortSignal }): Promise<GeometryPlan>;
}

export interface PlannerEnv {
  AI?: WorkersAIBinding;
  SHAPEFORGE_AI_MODEL?: string;
}

type PlannerLogEvent =
  | "planner.recipe"
  | "planner.ai.start"
  | "planner.ai.success"
  | "planner.ai.error"
  | "planner.ai.parse_error"
  | "planner.validation.success"
  | "planner.validation.error"
  | "planner.conversion.success"
  | "planner.conversion.error"
  | "planner.fallback";

type PlannerLogger = (event: PlannerLogEvent, details?: Record<string, unknown>) => void;

function logPlanner(event: PlannerLogEvent, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    event,
    ...details,
  }));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function responseShape(result: unknown) {
  if (typeof result === "string") return { resultType: "string", resultLength: result.length };
  if (!result || typeof result !== "object") return { resultType: typeof result };
  const value = result as Record<string, unknown>;
  return {
    resultType: "object",
    keys: Object.keys(value).slice(0, 8),
    responseType: typeof value.response,
    resultFieldType: typeof value.result,
    choices: Array.isArray(value.choices) ? value.choices.length : undefined,
  };
}

const geometryPlanContract = {
  schemaVersion: GEOMETRY_PLAN_SCHEMA_VERSION,
  requestedObject: {
    identity: "specific requested object, not a parent machine unless requested",
    subtype: "optional subtype/style",
    scope: "complete_object | component | subsystem | attachment | fixture | tool | wearable | appliance",
  },
  silhouette: {
    form: "recognizable overall physical form before decomposition",
    proportions: { width: "number", height: "number", depth: "number" },
    orientation: "operating orientation",
    dominantAxis: "x | y | z",
    symmetry: "none | bilateral | radial | rotational",
  },
  exclusions: ["negative constraints from the prompt"],
  recognitionCriticalParts: ["parts that make the object recognizable"],
  parts: [{
    id: "stable short id like mainBody",
    name: "human readable component name",
    role: "structure | housing | power | motion | control | input | output | thermal | fluid | electrical | support | fastener | surface | grip | optical | storage | other",
    primitive: "box | cylinder",
    axis: "x | y | z, required for cylinders",
    purpose: "physical function",
    relativeSize: ["width fraction", "height fraction", "depth fraction"],
    relativePosition: ["x from center", "y from center", "z from center"],
    rotation: ["x degrees", "y degrees", "z degrees"],
    parentId: "optional parent part id",
    relatedIds: ["optional related part ids"],
    spatialRelationships: ["front/back/inside/outside/above/below/concentric/attached/connected"],
    mirroredFrom: "optional mirrored source part id",
    repeatGroup: "optional group id for repeated parts",
    color: "optional #rrggbb",
    detail: "optional boolean for basic-vs-detailed filtering",
  }],
  relationships: [{ from: "part id", to: "part id", type: "spatial or functional relationship", description: "optional" }],
  plannerNotes: "brief reasoned summary",
};

function plannerSystemPrompt() {
  return [
    "You are ShapeForge's physical-object geometry planner.",
    "Return only strict JSON matching the provided GeometryPlan contract.",
    "Reason about the object's silhouette, proportions, axes, symmetry, and scope before listing parts.",
    "Identify the actual requested subject. A requested component or subsystem must not expand into its parent machine.",
    "Preserve modifiers such as corded, handheld, wall-mounted, folding, compact, wearable, or fancy.",
    "Treat negative constraints such as not, no, without, excluding, and instead of as hard exclusions when practical.",
    "Avoid generic Main Frame / Drive Core / Output Module decompositions.",
    "Avoid a dominant rectangular outer shell unless the real object is box-shaped.",
    "Use only box and cylinder primitives, with relative dimensions and positions normalized around the object center.",
    "Keep 4 to 18 parts unless the object truly needs more.",
    "Do not emit code, markdown, prose, comments, or trailing commas.",
  ].join("\n");
}

function plannerUserPrompt(prompt: string) {
  return JSON.stringify({
    task: "Create a structured physical GeometryPlan for this ShapeForge prompt.",
    prompt,
    contract: geometryPlanContract,
  });
}

function extractJsonText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const value = result as Record<string, unknown>;
  if (typeof value.response === "string") return value.response;
  if (value.response && typeof value.response === "object") return JSON.stringify(value.response);
  if (typeof value.result === "string") return value.result;
  if (value.result && typeof value.result === "object") return JSON.stringify(value.result);
  if (Array.isArray(value.choices)) {
    const first = value.choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === "string") return message.content;
    if (typeof first?.text === "string") return first.text;
  }
  return "";
}

function parsePlannerResult(result: unknown) {
  const text = extractJsonText(result).trim();
  if (!text) throw new Error("EMPTY_MODEL_RESPONSE");
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("MALFORMED_MODEL_JSON");
    return JSON.parse(match[0]);
  }
}

export class CloudflareWorkersAIProvider implements GeometryPlannerProvider {
  readonly source = "workers-ai" as const;
  readonly model: string;
  readonly ai: WorkersAIBinding;
  readonly logger: PlannerLogger;

  constructor(ai: WorkersAIBinding, model = DEFAULT_WORKERS_AI_MODEL, logger: PlannerLogger = logPlanner) {
    this.ai = ai;
    this.model = model;
    this.logger = logger;
  }

  async plan(prompt: string): Promise<GeometryPlan> {
    this.logger("planner.ai.start", { model: this.model, promptLength: prompt.length });
    let result: unknown;
    try {
      result = await this.ai.run(this.model, {
        messages: [
          { role: "system", content: plannerSystemPrompt() },
          { role: "user", content: plannerUserPrompt(prompt) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 2400,
      });
    } catch (error) {
      this.logger("planner.ai.error", { model: this.model, error: errorMessage(error) });
      throw error;
    }
    this.logger("planner.ai.success", { model: this.model, ...responseShape(result) });

    let parsed: unknown;
    try {
      parsed = parsePlannerResult(result);
    } catch (error) {
      this.logger("planner.ai.parse_error", { model: this.model, error: errorMessage(error), ...responseShape(result) });
      throw error;
    }

    const validation = validateAndSanitizeGeometryPlan(parsed, prompt);
    if (!validation.ok || !validation.plan) {
      this.logger("planner.validation.error", { model: this.model, warnings: validation.warnings });
      throw new Error(`INVALID_GEOMETRY_PLAN: ${validation.warnings.join("; ")}`);
    }
    this.logger("planner.validation.success", {
      model: this.model,
      identity: validation.plan.requestedObject.identity,
      scope: validation.plan.requestedObject.scope,
      partCount: validation.plan.parts.length,
      warnings: validation.warnings,
    });
    return validation.plan;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("WORKERS_AI_TIMEOUT")), timeoutMs);
    }),
  ]);
}

export async function createForgeProjectWithPlanner(
  prompt: string,
  env: PlannerEnv,
  options: { scale?: number; detail?: DetailLevel; timeoutMs?: number; logger?: PlannerLogger } = {},
): Promise<ForgeProject> {
  const logger = options.logger ?? logPlanner;
  const recovered = tryRecoveredRecipeProject(prompt, options);
  if (recovered) {
    logger("planner.recipe", { matched: true, source: recovered.source, plannerSource: recovered.planner?.source, partCount: recovered.parts.length });
    return recovered;
  }
  logger("planner.recipe", { matched: false });

  const warnings: string[] = [];
  const model = env.SHAPEFORGE_AI_MODEL || DEFAULT_WORKERS_AI_MODEL;
  if (env.AI) {
    try {
      const provider = new CloudflareWorkersAIProvider(env.AI, model, logger);
      const plan = await withTimeout(provider.plan(prompt), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      let project: ForgeProject;
      try {
        project = geometryPlanToProject(plan, prompt, {
          scale: options.scale,
          detail: options.detail,
          plannerSource: { source: "workers-ai", model },
        });
      } catch (error) {
        logger("planner.conversion.error", { model, error: errorMessage(error) });
        throw error;
      }
      logger("planner.conversion.success", { model, projectSource: project.source, partCount: project.parts.length });
      project.history = [...project.history, `Planner source: Workers AI (${model})`];
      return project;
    } catch (error) {
      warnings.push(errorMessage(error));
    }
  } else {
    warnings.push("Workers AI binding is unavailable.");
  }

  const fallback = createSemanticFallbackProject(prompt, options, warnings);
  fallback.planner = { source: "semantic-fallback", model: env.AI ? model : undefined, warnings };
  fallback.history = [...fallback.history, "Planner source: semantic fallback"];
  logger("planner.fallback", {
    source: fallback.source,
    plannerSource: fallback.planner?.source,
    model: fallback.planner?.model,
    warnings,
    partCount: fallback.parts.length,
  });
  return fallback;
}
