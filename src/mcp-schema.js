import { z } from "./zod-compat.js";

export function normalizeToolInputSchema(inputSchema) {
  if (inputSchema === undefined || inputSchema === null) return undefined;
  if (
    typeof inputSchema?.safeParse === "function"
    || typeof inputSchema?.["~standard"] === "object"
  ) {
    return inputSchema;
  }
  if (typeof inputSchema !== "object" || Array.isArray(inputSchema)) {
    throw new TypeError("MCP tool inputSchema must be a Standard Schema or an object shape");
  }
  if (Object.keys(inputSchema).length === 0) return undefined;
  return z.object(inputSchema);
}

export function normalizeToolConfig(config = {}) {
  const normalized = { ...config };
  const inputSchema = normalizeToolInputSchema(config.inputSchema);
  if (inputSchema === undefined) delete normalized.inputSchema;
  else normalized.inputSchema = inputSchema;
  return normalized;
}

export function createToolRegistrationFacade(server) {
  if (!server || typeof server.registerTool !== "function") {
    throw new TypeError("An MCP server with registerTool() is required");
  }
  return Object.freeze({
    registerTool(name, config, handler) {
      return server.registerTool(name, normalizeToolConfig(config), handler);
    },
  });
}
