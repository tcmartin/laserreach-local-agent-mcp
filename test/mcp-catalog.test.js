import assert from "node:assert/strict";
import test from "node:test";

import { registerMcpCatalogTools } from "../src/mcp-catalog.js";

function manifest() {
  return {
    registry_version: "registry_test",
    tools: [
      {
        type: "function",
        function: {
          name: "list_companies",
          description: "List companies",
          parameters: {
            type: "object",
            properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
          },
        },
        "x-laserreach-access": { mutation: "read", required_scopes: ["abm:read"] },
      },
      {
        type: "function",
        function: {
          name: "send_company_message",
          description: "Send one governed message",
          parameters: {
            type: "object",
            required: ["company_id"],
            properties: { company_id: { type: "string", minLength: 1 } },
          },
        },
        "x-laserreach-access": { mutation: "outbound", required_scopes: ["outreach:send"] },
      },
    ],
  };
}

function setup() {
  const registrations = new Map();
  const invocations = [];
  const server = {
    registerTool(name, config, callback) {
      registrations.set(name, { config, callback });
    },
  };
  const client = {
    async siteTools() {
      return manifest();
    },
    async invokeSiteTool(name, args) {
      invocations.push({ name, args });
      return { success: true, name, args };
    },
  };
  return { registrations, invocations, server, client };
}

test("compact catalog tools search a bounded live manifest", async () => {
  const { registrations, server, client } = setup();
  assert.deepEqual(registerMcpCatalogTools(server, client), [
    "laserreach_search_site_tools",
    "laserreach_invoke_site_tool",
  ]);
  const search = registrations.get("laserreach_search_site_tools");
  const result = await search.callback({ query: "companies", include_schemas: true, limit: 1 });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.matched_count, 1);
  assert.equal(payload.returned_count, 1);
  assert.equal(payload.tools[0].name, "list_companies");
  assert.equal(payload.tools[0].inputSchema.properties.limit.maximum, 20);
});

test("compact invocation verifies the token-scoped manifest and validates arguments", async () => {
  const { registrations, invocations, server, client } = setup();
  registerMcpCatalogTools(server, client);
  const invoke = registrations.get("laserreach_invoke_site_tool");

  const invalid = await invoke.callback({ name: "list_companies", arguments: { limit: 0 } });
  assert.equal(invalid.isError, true);
  assert.equal(invocations.length, 0);

  const unavailable = await invoke.callback({ name: "not_allowed", arguments: {} });
  assert.equal(unavailable.isError, true);
  assert.equal(invocations.length, 0);

  const result = await invoke.callback({ name: "list_companies", arguments: { limit: 3 } });
  assert.equal(result.isError, undefined);
  assert.deepEqual(invocations, [{ name: "list_companies", args: { limit: 3 } }]);
  assert.match(result.content[0].text, /list_companies|success/);
});
