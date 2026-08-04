import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { LaserreachClient } from "./client.js";
import { registerLaserreachTools, registerSiteParityTools } from "./tools.js";

export function createMcpServer(options = {}) {
  const client = options.client || new LaserreachClient(options.clientOptions || {});
  const server = new McpServer({
    name: "laserreach-local-agent",
    version: "0.6.0",
  });
  registerLaserreachTools(server, client);
  registerSiteParityTools(server, client, options.siteToolManifest || {});
  return server;
}

export async function runMcpServer(options = {}) {
  const client = options.client || new LaserreachClient(options.clientOptions || {});
  let siteToolManifest = options.siteToolManifest;
  if (!siteToolManifest) {
    try {
      siteToolManifest = await client.siteTools({ includeInstructions: false });
    } catch (error) {
      console.error(`[laserreach-local-agent] site tool parity unavailable: ${error.message}`);
      siteToolManifest = {};
    }
  }
  const server = createMcpServer({ ...options, client, siteToolManifest });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
