/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleShapeForgeMcp } from "./shapeforge-mcp";
import { createForgeProjectWithPlanner, type WorkersAIBinding } from "./geometry-planner";

interface Env {
  AI?: WorkersAIBinding;
  ASSETS: Fetcher;
  DB?: D1Database;
  SHAPEFORGE_AI_MODEL?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const apiHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function apiJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: apiHeaders });
}

function logForge(event: "forge.request" | "forge.result", details: Record<string, unknown>) {
  console.log(JSON.stringify({
    event,
    ...details,
  }));
}

function hasGenericMainFrameSignature(project: { parts: Array<{ name: string }> }) {
  const names = new Set(project.parts.map((part) => part.name));
  return names.has("Main Frame") &&
    names.has("Outer Body") &&
    names.has("Drive Core") &&
    names.has("Control Module") &&
    names.has("Output Module");
}

async function handleForgeGenerate(request: Request, env: Env) {
  if (request.method !== "POST") return apiJson({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiJson({ error: "Invalid JSON body" }, 400);
  }
  const prompt = typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : "";
  if (!prompt) return apiJson({ error: "Provide a prompt." }, 400);
  const detail = body.detail === "basic" ? "basic" : "detailed";
  const scale = typeof body.scale === "number" ? body.scale : undefined;
  logForge("forge.request", {
    method: request.method,
    path: new URL(request.url).pathname,
    promptLength: prompt.length,
    detail,
    scale,
    hasAIBinding: Boolean(env.AI),
    configuredModel: env.SHAPEFORGE_AI_MODEL || null,
  });
  const project = await createForgeProjectWithPlanner(prompt, env, { detail, scale });
  logForge("forge.result", {
    projectSource: project.source,
    plannerSource: project.planner?.source ?? null,
    plannerModel: project.planner?.model ?? null,
    plannerWarnings: project.planner?.warnings ?? [],
    partCount: project.parts.length,
    genericMainFrameSignature: hasGenericMainFrameSignature(project),
  });
  return apiJson({ project });
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      return handleShapeForgeMcp(request, env);
    }

    if (url.pathname === "/api/forge") {
      return handleForgeGenerate(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
