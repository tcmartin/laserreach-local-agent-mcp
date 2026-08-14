import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { LaserreachClient } from "./client.js";
import { registerMcpCatalogTools } from "./mcp-catalog.js";
import { createToolRegistrationFacade } from "./mcp-schema.js";
import { registerLaserreachTools, registerSiteParityTools } from "./tools.js";

const SERVER_INFO = Object.freeze({
  name: "laserreach-local-agent",
  version: "0.8.0",
});

export const MCP_TOOL_MODES = Object.freeze(["compact", "full"]);

export function resolveMcpToolMode(value = process.env.LASERREACH_MCP_TOOL_MODE) {
  const mode = String(value || "compact").trim().toLowerCase();
  if (!MCP_TOOL_MODES.includes(mode)) {
    throw new Error(
      `LASERREACH_MCP_TOOL_MODE must be one of: ${MCP_TOOL_MODES.join(", ")}`,
    );
  }
  return mode;
}

export function createMcpServer(options = {}) {
  const client = options.client || new LaserreachClient(options.clientOptions || {});
  const siteToolMode = resolveMcpToolMode(options.siteToolMode);
  const server = new McpServer(SERVER_INFO);
  const registry = createToolRegistrationFacade(server);

  registerLaserreachTools(registry, client);
  registerMcpCatalogTools(registry, client);
  if (siteToolMode === "full") {
    registerSiteParityTools(registry, client, options.siteToolManifest || {});
  }
  return server;
}

export async function runMcpServer(options = {}) {
  const client = options.client || new LaserreachClient(options.clientOptions || {});
  const siteToolMode = resolveMcpToolMode(options.siteToolMode);
  let siteToolManifest = options.siteToolManifest;

  if (siteToolMode === "full" && !siteToolManifest) {
    try {
      siteToolManifest = await client.siteTools({ includeInstructions: false });
    } catch (error) {
      console.error(`[laserreach-local-agent] full site tool parity unavailable: ${error.message}`);
      siteToolManifest = {};
    }
  }

  return serveStdio(
    () => createMcpServer({
      ...options,
      client,
      siteToolMode,
      siteToolManifest,
    }),
    {
      legacy: options.legacy || "serve",
      onerror: options.onerror || ((error) => {
        console.error(`[laserreach-local-agent] MCP transport error: ${error.message}`);
      }),
    },
  );
}
