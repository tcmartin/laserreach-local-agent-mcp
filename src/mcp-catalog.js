import { z } from "./zod-compat.js";

import { findManifestTool, selectManifestTools } from "./discovery.js";
import { jsonSchemaToZod } from "./tools.js";

function jsonText(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function errorText(error) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: JSON.stringify({
        error: error.message,
        status: error.status,
        body: error.body,
      }, null, 2),
    }],
  };
}

async function wrap(fn) {
  try {
    return jsonText(await fn());
  } catch (error) {
    return errorText(error);
  }
}

function manifestToolSchema(tool) {
  const fn = tool && typeof tool === "object" ? tool.function : null;
  return fn && typeof fn === "object"
    ? fn.parameters || { type: "object", properties: {} }
    : { type: "object", properties: {} };
}

export function registerMcpCatalogTools(server, client) {
  server.registerTool(
    "laserreach_search_site_tools",
    {
      title: "Search Laserreach site tools",
      description: "Search the live token-scoped Laserreach tool catalog. Use a narrow query; request schemas only for the few tools you may invoke.",
      inputSchema: z.object({
        query: z.string().trim().max(200).default(""),
        include_schemas: z.boolean().default(true),
        limit: z.number().int().min(1).max(25).default(8),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ query, include_schemas, limit }) => wrap(async () => {
      const manifest = await client.siteTools({ includeInstructions: false });
      const matches = selectManifestTools(manifest, {
        filter: query,
        includeSchemas: include_schemas,
      });
      return {
        registry_version: manifest.registry_version,
        query,
        matched_count: matches.length,
        returned_count: Math.min(matches.length, limit),
        tools: matches.slice(0, limit),
      };
    }),
  );

  server.registerTool(
    "laserreach_invoke_site_tool",
    {
      title: "Invoke a Laserreach site tool",
      description: "Invoke one exact tool from the current token-scoped catalog. Search first, then pass exactly the returned name and schema-compatible arguments. Laserreach token scopes and organization policy remain authoritative.",
      inputSchema: z.object({
        name: z.string().trim().min(1),
        arguments: z.record(z.string(), z.unknown()).default({}),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ name, arguments: args }) => wrap(async () => {
      const manifest = await client.siteTools({ includeInstructions: false });
      const tool = findManifestTool(manifest, name);
      const parsedArgs = jsonSchemaToZod(manifestToolSchema(tool)).parse(args || {});
      return {
        name,
        access: tool["x-laserreach-access"] || {},
        result: await client.invokeSiteTool(name, parsedArgs),
      };
    }),
  );

  return ["laserreach_search_site_tools", "laserreach_invoke_site_tool"];
}
