import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createShapeForgeServer } from "./mcp.mjs";
import { openStore, widgetHtml } from "./runtime.mjs";

const html = widgetHtml();
const store = openStore();
const server = createShapeForgeServer(store, html);
await server.connect(new StdioServerTransport());
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await server.close();
  store.close();
}
process.stdin.once("end", () => { void close(); });
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await close(); process.exit(0); });
