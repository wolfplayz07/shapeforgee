import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z, ZodError } from "zod";
import { AssemblyError, createSchema, saveSchema, getSchema, listSchema, updateSchema, summary } from "./schema.mjs";

export const VIEWER_URI = "ui://shapeforge/assembly-v1.html";
const summaryOutput = z.object({
  id: z.string(), name: z.string(), revision: z.number().int().positive(),
  updated_at: z.string(), part_count: z.number().int().nonnegative(),
  source: z.string(), warning: z.string(),
});
export function createShapeForgeServer(store, widgetHtml) {
  const server = new McpServer({ name: "shapeforge", version: "0.1.0" });
  registerAppResource(server, "ShapeForge assembly viewer", VIEWER_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: VIEWER_URI, mimeType: RESOURCE_MIME_TYPE, text: widgetHtml, _meta: {
      ui: { prefersBorder: true, csp: { connectDomains: [], resourceDomains: [] } },
      "openai/widgetDescription": "Interactive ShapeForge assembly: orbit, select components, explode the view, and save component edits. Concept geometry, not validated CAD.",
    } }],
  }));
  function register(name, title, description, schema, readOnly, action, render = false) {
    const output = name === "list_assemblies"
      ? z.object({ assemblies: z.array(summaryOutput), next_offset: z.number().int().nonnegative().nullable() })
      : name === "get_assembly" ? summaryOutput.extend({ project: z.record(z.unknown()) }) : summaryOutput;
    registerAppTool(server, name, {
      title, description, inputSchema: schema.shape, outputSchema: output.shape,
      annotations: { readOnlyHint: readOnly, destructiveHint: false, openWorldHint: false, idempotentHint: true },
      _meta: render ? { ui: { resourceUri: VIEWER_URI } } : {},
    }, async raw => {
      try {
        const result = action(schema.parse(raw));
        return result;
      } catch (error) {
        const code = error instanceof ZodError ? "INVALID_INPUT" : error instanceof AssemblyError ? error.code : "INTERNAL_ERROR";
        const message = error instanceof ZodError ? "Input does not match the assembly schema. Check component fields and numeric bounds." : error instanceof AssemblyError ? error.message : "ShapeForge could not complete this action.";
        if (code === "INTERNAL_ERROR") console.error("ShapeForge internal operation failure", name);
        return { isError: true, content: [{ type: "text", text: `${code}: ${message}` }] };
      }
    });
  }
  const recordResult = (record, full = false) => ({
    content: [{ type: "text", text: JSON.stringify(summary(record)) }],
    structuredContent: { ...summary(record), ...(full ? { project: record.project } : {}) },
    _meta: { project: record.project },
  });
  register("create_assembly", "Create ShapeForge assembly", "Use this when creating a saved concept from ShapeForge's existing deterministic recipes. Unknown prompts return an explicitly labeled generic placeholder, not an AI-generated model. For custom designs use save_assembly. Supply a fresh UUID request_id; reuse it only when retrying the identical action.", createSchema, false, input => recordResult(store.create(input)));
  register("save_assembly", "Save custom ShapeForge assembly", "Use this when you have designed explicit box/cylinder components for a new project. Saves a separate assembly, not an overwrite. Use COMP-000001-style unique IDs, valid parent/related links, positive dimensions, and a fresh UUID request_id. Geometry is conceptual and is not engineering-validated.", saveSchema, false, input => recordResult(store.save(input)));
  register("list_assemblies", "Find saved ShapeForge assemblies", "Use this to find saved projects by name. Returns IDs and current revisions; use next_offset for another page. Does not modify projects.", listSchema, true, input => {
    const result = store.list(input);
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  });
  register("get_assembly", "Read ShapeForge assembly", "Use this to inspect the complete saved assembly and component IDs before editing. Omit revision for the latest version, or supply a revision to inspect historical geometry. Does not open the viewer.", getSchema, true, input => recordResult(store.get(input), true));
  register("update_component", "Edit ShapeForge component", "Use this to save a requested component change. Fetch the current assembly first and pass its expected_revision, component_id, and a fresh UUID request_id. A stale revision is rejected. Prior revisions remain available through get_assembly. Retrying identical input with the same UUID is safe.", updateSchema, false, input => recordResult(store.update(input)));
  register("open_assembly", "Open ShapeForge viewer", "Use this when the user wants to see or interact with a saved ShapeForge assembly. Opens orbit, selection, and progressive exploded-view controls. Requires an existing assembly ID; use create_assembly or save_assembly first for a new project.", getSchema, true, input => recordResult(store.get(input)), true);
  return server;
}
