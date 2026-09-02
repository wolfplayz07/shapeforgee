import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AssemblyStore } from "../server/store.mjs";
import { createHttpServer } from "../server/http.mjs";
import { VIEWER_URI } from "../server/mcp.mjs";
import { root, widgetHtml } from "../server/runtime.mjs";

async function local(t) {
  const store = new AssemblyStore(":memory:");
  const server = createHttpServer(store, widgetHtml());
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}
test("HTTP MCP handshake, discovery, viewer resource and full assembly workflow", async t => {
  const url = await local(t);
  const client = new Client({ name: "shapeforge-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`)));
  t.after(() => client.close());
  const { tools } = await client.listTools();
  assert.equal(tools.length, 6);
  assert.deepEqual(tools.filter(tool => tool._meta?.ui?.resourceUri).map(tool => tool.name), ["open_assembly"]);
  for (const tool of tools) { assert.equal(tool.annotations.openWorldHint, false); assert.equal(tool.annotations.destructiveHint, false); assert.equal(tool.outputSchema.type, "object"); }
  const resource = await client.readResource({ uri: VIEWER_URI });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /<canvas|createElement|SHAPEFORGE/);
  assert.deepEqual(resource.contents[0]._meta.ui.csp.connectDomains, []);
  const created = await client.callTool({ name: "create_assembly", arguments: { request_id: randomUUID(), prompt: "1969 SS Chevelle" } });
  assert.ok(!created.isError, JSON.stringify(created));
  const id = created.structuredContent.id;
  const fetched = await client.callTool({ name: "get_assembly", arguments: { id } });
  assert.equal(fetched.structuredContent.project.id, id);
  const edited = await client.callTool({ name: "update_component", arguments: { request_id: randomUUID(), id, expected_revision: 1, component_id: fetched.structuredContent.project.parts[0].id, changes: { color: "#aabbcc" } } });
  assert.equal(edited.structuredContent.revision, 2);
  const opened = await client.callTool({ name: "open_assembly", arguments: { id } });
  assert.equal(opened._meta.project.parts[0].color, "#aabbcc");
  const listed = await client.callTool({ name: "list_assemblies", arguments: {} });
  assert.equal(listed.structuredContent.assemblies[0].id, id);
  const missing = await client.callTool({ name: "get_assembly", arguments: { id: "PROJ-999999" } });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /NOT_FOUND/);
});
test("HTTP rejects foreign origins, DNS rebinding hosts, malformed and oversized bodies", async t => {
  const url = await local(t);
  assert.equal((await fetch(`${url}/health`)).status, 200);
  const preview = await fetch(`${url}/viewer`);
  assert.equal(preview.status, 200); assert.match(preview.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal((await fetch(`${url}/mcp`, { method: "POST", headers: { Origin: "https://attacker.invalid" } })).status, 403);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${url}/health`, { headers: { Host: "attacker.invalid" } }, res => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject); req.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${url}/mcp`)).status, 405);
  assert.equal((await fetch(`${url}/mcp`, { method: "POST", body: "{}" })).status, 415);
  const options = { method: "POST", headers: { "Content-Type": "application/json" } };
  assert.equal((await fetch(`${url}/mcp`, { ...options, body: "{" })).status, 400);
  assert.equal((await fetch(`${url}/mcp`, { ...options, body: "x".repeat(1024 * 1024 + 1) })).status, 413);
});
test("stdio process speaks MCP and reopens saved data after process restart", async t => {
  const folder = mkdtempSync(join(tmpdir(), "shapeforge-stdio-test-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  async function connect() {
    const client = new Client({ name: "stdio-test", version: "1.0.0" });
    const transport = new StdioClientTransport({ command: process.execPath, args: ["--experimental-strip-types", "server/stdio.mjs"], cwd: root, env: { SHAPEFORGE_DATA_DIR: folder }, stderr: "pipe" });
    transport.stderr.on("data", () => {});
    await client.connect(transport);
    return client;
  }
  const first = await connect();
  let id;
  try { const result = await first.callTool({ name: "create_assembly", arguments: { request_id: randomUUID(), prompt: "desk" } }); assert.ok(!result.isError); id = result.structuredContent.id; }
  finally { await first.close(); }
  const second = await connect();
  try { const result = await second.callTool({ name: "get_assembly", arguments: { id } }); assert.equal(result.structuredContent.project.id, id); }
  finally { await second.close(); }
});
