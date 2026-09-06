import {
  ALLOWED_PLAN_PRIMITIVES,
  GEOMETRY_PLAN_JSON_SCHEMA,
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


/** LayoutGPT-inspired few-shot GeometryPlans (UCSB-AI/LayoutGPT style: concrete numeric layout + recognition-critical parts). */
const LAYOUTGPT_FEW_SHOTS: Array<{ prompt: string; plan: Record<string, unknown> }> = [
  {
    prompt: "desk lamp",
    plan: {
      schemaVersion: GEOMETRY_PLAN_SCHEMA_VERSION,
      requestedObject: { identity: "Desk Lamp", scope: "complete_object", subtype: "adjustable" },
      silhouette: {
        form: "weighted base with slender stem and flared shade",
        proportions: { width: 0.7, height: 1.4, depth: 0.7 },
        orientation: "upright",
        dominantAxis: "y",
        symmetry: "radial",
      },
      exclusions: [],
      recognitionCriticalParts: ["shade", "stem", "base"],
      parts: [
        {
          id: "base",
          name: "Weighted Base",
          role: "support",
          primitive: "cylinder",
          axis: "y",
          purpose: "Anchors the lamp on the desk",
          relativeSize: [0.42, 0.1, 0.42],
          relativePosition: [0, -0.55, 0],
          rotation: [0, 0, 0],
          parentId: null,
          relatedIds: ["stem"],
          spatialRelationships: ["below stem"],
        },
        {
          id: "stem",
          name: "Stem",
          role: "support",
          primitive: "capsule",
          axis: "y",
          purpose: "Raises the shade above the base",
          relativeSize: [0.08, 0.7, 0.08],
          relativePosition: [0, -0.05, 0],
          rotation: [0, 0, 0],
          parentId: "base",
          relatedIds: ["shade", "base"],
          spatialRelationships: ["above base", "below shade"],
        },
        {
          id: "shade",
          name: "Lamp Shade",
          role: "housing",
          primitive: "frustum",
          axis: "y",
          purpose: "Diffuses light downward",
          relativeSize: [0.45, 0.35, 0.45],
          relativePosition: [0, 0.55, 0],
          rotation: [0, 0, 0],
          parentId: "stem",
          relatedIds: ["bulb"],
          spatialRelationships: ["above stem"],
        },
        {
          id: "bulb",
          name: "Bulb",
          role: "optical",
          primitive: "ellipsoid",
          axis: "y",
          purpose: "Emits light inside the shade",
          relativeSize: [0.16, 0.2, 0.16],
          relativePosition: [0, 0.38, 0],
          rotation: [0, 0, 0],
          parentId: "shade",
          relatedIds: ["shade"],
          spatialRelationships: ["inside shade"],
          detail: true,
        },
      ],
      relationships: [
        { from: "stem", to: "base", type: "attached", description: "stem mounts on base" },
        { from: "shade", to: "stem", type: "attached", description: "shade sits on stem" },
      ],
      plannerNotes: "LayoutGPT-style numeric stack: base below, stem mid, shade above.",
    },
  },
  {
    prompt: "stapler",
    plan: {
      schemaVersion: GEOMETRY_PLAN_SCHEMA_VERSION,
      requestedObject: { identity: "Stapler", scope: "tool", subtype: "desktop" },
      silhouette: {
        form: "elongated hinged stapler with magazine and base anvil",
        proportions: { width: 0.35, height: 0.45, depth: 1.2 },
        orientation: "lying along depth",
        dominantAxis: "z",
        symmetry: "bilateral",
      },
      exclusions: [],
      recognitionCriticalParts: ["magazine", "anvil", "hinge"],
      parts: [
        {
          id: "base",
          name: "Base Anvil",
          role: "structure",
          primitive: "box",
          purpose: "Supports the stapler and clinches staples",
          relativeSize: [0.32, 0.08, 0.95],
          relativePosition: [0, -0.2, 0],
          rotation: [0, 0, 0],
          parentId: null,
          relatedIds: ["magazine", "hinge"],
          spatialRelationships: ["below magazine"],
        },
        {
          id: "magazine",
          name: "Staple Magazine",
          role: "housing",
          primitive: "box",
          purpose: "Holds the staple strip above the anvil",
          relativeSize: [0.28, 0.14, 0.85],
          relativePosition: [0, 0.08, -0.05],
          rotation: [0, 0, 0],
          parentId: "hinge",
          relatedIds: ["base", "cap"],
          spatialRelationships: ["above base", "hinged at rear"],
        },
        {
          id: "hinge",
          name: "Rear Hinge",
          role: "motion",
          primitive: "cylinder",
          axis: "x",
          purpose: "Pivots the magazine onto the anvil",
          relativeSize: [0.3, 0.1, 0.1],
          relativePosition: [0, 0, -0.42],
          rotation: [0, 0, 0],
          parentId: "base",
          relatedIds: ["magazine", "base"],
          spatialRelationships: ["at rear of base"],
        },
        {
          id: "cap",
          name: "Top Cap",
          role: "surface",
          primitive: "box",
          purpose: "Press surface on top of the magazine",
          relativeSize: [0.26, 0.06, 0.55],
          relativePosition: [0, 0.2, 0.05],
          rotation: [0, 0, 0],
          parentId: "magazine",
          relatedIds: ["magazine"],
          spatialRelationships: ["above magazine"],
          detail: true,
        },
        {
          id: "noseL",
          name: "Left Nose Guide",
          role: "output",
          primitive: "wedge",
          axis: "z",
          purpose: "Guides staples on the left of the nose",
          relativeSize: [0.06, 0.08, 0.16],
          relativePosition: [-0.08, 0.05, 0.48],
          rotation: [0, 0, 0],
          parentId: "magazine",
          relatedIds: ["noseR", "magazine"],
          spatialRelationships: ["front left of magazine"],
          mirroredFrom: "noseR",
          detail: true,
        },
        {
          id: "noseR",
          name: "Right Nose Guide",
          role: "output",
          primitive: "wedge",
          axis: "z",
          purpose: "Guides staples on the right of the nose",
          relativeSize: [0.06, 0.08, 0.16],
          relativePosition: [0.08, 0.05, 0.48],
          rotation: [0, 0, 0],
          parentId: "magazine",
          relatedIds: ["noseL", "magazine"],
          spatialRelationships: ["front right of magazine"],
          mirroredFrom: "noseL",
          detail: true,
        },
      ],
      relationships: [
        { from: "magazine", to: "hinge", type: "hinged", description: "magazine pivots on hinge" },
        { from: "noseL", to: "noseR", type: "mirrored", description: "bilateral nose guides" },
      ],
      plannerNotes: "LayoutGPT-style bilateral stapler: base/anvil, hinged magazine, mirrored nose guides.",
    },
  },
];

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
    primitive: "box | cylinder | capsule | ellipsoid | frustum | cone | wedge",
    axis: "x | y | z, required for non-box primitives",
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
    "Use box, cylinder, capsule, ellipsoid, frustum, cone, and wedge primitives as needed, with relative dimensions and positions normalized around the object center.",
    "Apply LayoutGPT-style compositional layout: every part needs concrete relativeSize and relativePosition (CSS-like numeric placement), never identical defaults at the origin.",
    "Use the provided few-shot GeometryPlan exemplars as placement style guides; copy their numeric discipline and recognitionCriticalParts habit, not their object identity.",
    "When silhouette.symmetry is bilateral, emit mirrored left/right pairs with mirroredFrom set.",
    "Keep 4 to 18 parts unless the object truly needs more.",
    "Do not emit code, markdown, prose, comments, or trailing commas.",
  ].join("\n");
}

function plannerUserPrompt(prompt: string) {
  return JSON.stringify({
    task: "Create a structured physical GeometryPlan for this ShapeForge prompt.",
    prompt,
    layoutStyle: "LayoutGPT-inspired few-shot numeric layout (concrete relativeSize/relativePosition; recognitionCriticalParts; bilateral mirroredFrom when symmetric).",
    contract: geometryPlanContract,
  });
}

export function buildPlannerMessages(prompt: string) {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: plannerSystemPrompt() },
  ];
  for (const shot of LAYOUTGPT_FEW_SHOTS) {
    messages.push({ role: "user", content: plannerUserPrompt(shot.prompt) });
    messages.push({ role: "assistant", content: JSON.stringify(shot.plan) });
  }
  messages.push({ role: "user", content: plannerUserPrompt(prompt) });
  return messages;
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

function isJsonModeFailure(error: unknown) {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("json mode")
    || message.includes("json_schema")
    || message.includes("couldn't be met")
    || message.includes("could not be met")
    || message.includes("response_format")
  );
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
    const messages = buildPlannerMessages(prompt);
    const baseInput = {
      messages,
      temperature: 0.2,
      max_tokens: 2400,
    };
    let result: unknown;
    let responseFormat: "json_schema" | "json_object" = "json_schema";
    try {
      try {
        result = await this.ai.run(this.model, {
          ...baseInput,
          response_format: {
            type: "json_schema",
            json_schema: GEOMETRY_PLAN_JSON_SCHEMA,
          },
        });
      } catch (schemaError) {
        if (!isJsonModeFailure(schemaError)) {
          throw schemaError;
        }
        responseFormat = "json_object";
        this.logger("planner.ai.error", {
          model: this.model,
          error: errorMessage(schemaError),
          fallback: "json_object",
          reason: "json_schema_mode_failed",
        });
        result = await this.ai.run(this.model, {
          ...baseInput,
          response_format: { type: "json_object" },
        });
      }
    } catch (error) {
      this.logger("planner.ai.error", { model: this.model, error: errorMessage(error) });
      throw error;
    }
    this.logger("planner.ai.success", {
      model: this.model,
      responseFormat,
      allowedPrimitives: [...ALLOWED_PLAN_PRIMITIVES],
      ...responseShape(result),
    });

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
