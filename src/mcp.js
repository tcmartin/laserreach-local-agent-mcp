import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { LaserreachClient } from "./client.js";
import { registerLaserreachTools } from "./tools.js";

export function createMcpServer(options = {}) {
  const client = options.client || new LaserreachClient(options.clientOptions || {});
  const server = new McpServer({
    name: "laserreach-local-agent",
    version: "0.1.0",
  });
  registerLaserreachTools(server, client);
  return server;
}

export async function runMcpServer(options = {}) {
  const server = createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
