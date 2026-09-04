import { type ForgeProject } from "../lib/shapeforge.ts";
import { createForgeProjectWithPlanner, type WorkersAIBinding } from "./geometry-planner.ts";

interface Env {
  AI?: WorkersAIBinding;
  DB?: D1Database;
  SHAPEFORGE_AI_MODEL?: string;
}

type JsonRpcRequest = {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type AssemblyRecord = {
  project: ForgeProject;
  revision: number;
  updated_at: string;
};

const memoryAssemblies = new Map<string, AssemblyRecord>();
const projectIdPattern = /^PROJ-\d{6}$/;
const cacheBaseUrl = "https://shapeforge.local/assemblies/";

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function projectId() {
  return `PROJ-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

function summarize(record: AssemblyRecord) {
  return {
    id: record.project.id,
    name: record.project.name,
    revision: record.revision,
    updated_at: record.updated_at,
    part_count: record.project.parts.length,
    source: record.project.source,
    planner: record.project.planner,
    warning: record.project.source === "workers-ai"
      ? "Generated from a validated Workers AI physical-object plan; dimensions and engineering validity are not verified."
      : "Stylized procedural assembly, not engineering-accurate CAD or guaranteed model-year geometry.",
  };
}

async function ensureTable(db?: D1Database) {
  if (!db) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS assemblies (
      project_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      document TEXT NOT NULL
    )
  `).run();
}

async function saveRecord(env: Env, record: AssemblyRecord) {
  memoryAssemblies.set(record.project.id, record);
  if (env.DB) {
    await ensureTable(env.DB);
    await env.DB.prepare(`
      INSERT INTO assemblies (project_id, name, revision, updated_at, document)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        name = excluded.name,
        revision = excluded.revision,
        updated_at = excluded.updated_at,
        document = excluded.document
    `).bind(record.project.id, record.project.name, record.revision, record.updated_at, JSON.stringify(record.project)).run();
    return;
  }
  if (typeof caches !== "undefined") {
    await caches.default.put(
      new Request(`${cacheBaseUrl}${record.project.id}`),
      new Response(JSON.stringify(record), {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": "application/json",
        },
      }),
    );
  }
}

async function loadRecord(env: Env, id: string): Promise<AssemblyRecord | null> {
  if (!projectIdPattern.test(id)) return null;
  const cached = memoryAssemblies.get(id);
  if (cached) return cached;
  if (!env.DB) {
    if (typeof caches === "undefined") return null;
    const response = await caches.default.match(new Request(`${cacheBaseUrl}${id}`));
    if (!response) return null;
    const record = await response.json<AssemblyRecord>();
    if (record.project.id !== id) throw new Error("IDENTITY_MISMATCH");
    memoryAssemblies.set(id, record);
    return record;
  }
  await ensureTable(env.DB);
  const row = await env.DB.prepare("SELECT revision, updated_at, document FROM assemblies WHERE project_id = ?").bind(id).first<{
    revision: number;
    updated_at: string;
    document: string;
  }>();
  if (!row) return null;
  const project = JSON.parse(row.document) as ForgeProject;
  if (project.id !== id) throw new Error("IDENTITY_MISMATCH");
  const record = { project, revision: Number(row.revision), updated_at: row.updated_at };
  memoryAssemblies.set(id, record);
  return record;
}

function toolResult(record: AssemblyRecord, full = false) {
  const brief = summarize(record);
  return {
    content: [{ type: "text", text: JSON.stringify(brief) }],
    structuredContent: full ? { ...brief, project: record.project } : brief,
    _meta: { project: record.project },
  };
}

function toolError(code: string, message: string) {
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
  };
}

const objectSchema = {
  type: "object",
  additionalProperties: false,
} as const;

export const shapeforgeTools = [
  {
    name: "create_assembly",
    title: "Create ShapeForge assembly",
    description: "Use this when the user asks ShapeForge to make or model an object. Creates and saves a separate conceptual assembly.",
    inputSchema: {
      ...objectSchema,
      properties: {
        prompt: { type: "string", minLength: 1 },
        detail: { type: "string", enum: ["basic", "detailed"] },
        name: { type: "string" },
        scale: { type: "number", minimum: 0.5, maximum: 1.8 },
      },
      required: ["prompt"],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
  },
  {
    name: "get_assembly",
    title: "Read ShapeForge assembly",
    description: "Use this when reading a saved ShapeForge project by ID. Never substitutes a fallback project for a missing ID.",
    inputSchema: {
      ...objectSchema,
      properties: { id: { type: "string", pattern: "^PROJ-\\d{6}$" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
  {
    name: "open_assembly",
    title: "Open ShapeForge viewer",
    description: "Use this when opening a saved ShapeForge project by ID. Never substitutes a fallback project for a missing ID.",
    inputSchema: {
      ...objectSchema,
      properties: { id: { type: "string", pattern: "^PROJ-\\d{6}$" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  },
];

async function callTool(env: Env, name: string, args: Record<string, unknown> = {}) {
  try {
    if (name === "create_assembly") {
      const prompt = typeof args.prompt === "string" && args.prompt.trim() ? args.prompt : "";
      if (!prompt) return toolError("INVALID_INPUT", "Provide a prompt.");
      const detail = args.detail === "basic" ? "basic" : "detailed";
      const scale = typeof args.scale === "number" ? args.scale : undefined;
      const project = await createForgeProjectWithPlanner(prompt, env, { detail, scale });
      project.id = projectId();
      if (typeof args.name === "string" && args.name.trim()) project.name = args.name.trim();
      const record = { project, revision: 1, updated_at: new Date().toISOString() };
      await saveRecord(env, record);
      return toolResult(record);
    }
    if (name === "get_assembly" || name === "open_assembly") {
      const id = typeof args.id === "string" ? args.id : "";
      const record = await loadRecord(env, id);
      if (!record) return toolError("NOT_FOUND", "That assembly does not exist. Create a new assembly first, or use the exact saved project ID.");
      return toolResult(record, name === "get_assembly");
    }
    return toolError("UNKNOWN_TOOL", "ShapeForge does not provide that tool.");
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_MISMATCH") {
      return toolError("IDENTITY_MISMATCH", "The saved assembly identity is inconsistent. ShapeForge will not substitute a different project for this ID.");
    }
    return toolError("INTERNAL_ERROR", "ShapeForge could not complete this action.");
  }
}

export async function handleShapeForgeMcp(request: Request, env: Env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: jsonHeaders });
  if (request.method === "GET") {
    return jsonResponse({
      name: "shapeforge",
      version: "2.0.0",
      endpoint: "/mcp",
      tools: shapeforgeTools.map(({ name, title, description }) => ({ name, title, description })),
    });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let rpc: JsonRpcRequest;
  try {
    rpc = await request.json();
  } catch {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const id = rpc.id ?? null;
  if (rpc.method === "initialize") {
    return jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "shapeforge", version: "2.0.0" },
      },
    });
  }
  if (rpc.method === "notifications/initialized") {
    return jsonResponse({ jsonrpc: "2.0", id, result: {} });
  }
  if (rpc.method === "tools/list") {
    return jsonResponse({ jsonrpc: "2.0", id, result: { tools: shapeforgeTools } });
  }
  if (rpc.method === "tools/call") {
    const params = rpc.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const args = params.arguments && typeof params.arguments === "object" ? params.arguments as Record<string, unknown> : {};
    return jsonResponse({ jsonrpc: "2.0", id, result: await callTool(env, name, args) });
  }

  return jsonResponse({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }, 404);
}
