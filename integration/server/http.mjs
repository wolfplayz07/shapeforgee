import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createShapeForgeServer } from "./mcp.mjs";
import { openStore, widgetHtml } from "./runtime.mjs";

const MAX_BODY = 1024 * 1024;
export function createHttpServer(store, html) {
  return createServer(async (req, res) => {
    const reply = (status, message) => { res.writeHead(status, { "Content-Type": "text/plain", "X-Content-Type-Options": "nosniff" }); res.end(message); };
    const port = res.socket.localPort;
    const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!allowedHosts.has(req.headers.host)) return reply(403, "Loopback Host required.");
    if (req.headers.origin && !new Set([...allowedHosts].map(host => `http://${host}`)).has(req.headers.origin)) return reply(403, "Cross-origin access refused.");
    if (req.method === "GET" && req.url === "/health") return reply(200, "ShapeForge local server ready");
    if (req.method === "GET" && req.url === "/viewer") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'" });
      return res.end(html);
    }
    if (req.url !== "/mcp") return reply(404, "Not found");
    if (req.method !== "POST") { res.setHeader("Allow", "POST"); return reply(405, "Stateless MCP uses POST."); }
    if (!(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return reply(415, "application/json required");
    let size = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY) { reply(413, "Request exceeds 1 MiB"); return; }
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return reply(400, "Invalid JSON"); }
      const server = createShapeForgeServer(store, html);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      res.on("close", () => { void transport.close(); void server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch {
      if (!res.headersSent) reply(500, "ShapeForge request failed");
      else res.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.HOST && !["localhost", "127.0.0.1"].includes(process.env.HOST)) throw new Error("This single-user prototype must remain on loopback. Public hosting requires authentication and tenant isolation.");
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PORT must be an integer from 1024 to 65535.");
  const html = widgetHtml();
  const store = openStore();
  const server = createHttpServer(store, html);
  server.listen(port, "127.0.0.1", () => console.error(`ShapeForge MCP: http://127.0.0.1:${port}/mcp\nPreview only: http://127.0.0.1:${port}/viewer`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
