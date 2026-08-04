import assert from "node:assert/strict";
import test from "node:test";

import { jsonSchemaToZod, registerSiteParityTools } from "../src/tools.js";


test("jsonSchemaToZod preserves required, optional, nested, enum, and numeric fields", () => {
  const schema = jsonSchemaToZod({
    type: "object",
    required: ["name", "limit", "mode"],
    properties: {
      name: { type: "string", minLength: 1 },
      limit: { type: "integer", minimum: 1, maximum: 10 },
      mode: { type: "string", enum: ["safe", "full"] },
      tags: { type: "array", items: { type: "string" } },
      options: {
        type: "object",
        properties: { enabled: { type: "boolean" } },
      },
    },
  });

  const parsed = schema.parse({
    name: "Acme",
    limit: 5,
    mode: "safe",
    tags: ["one"],
    options: { enabled: true, future: "kept" },
  });
  assert.equal(parsed.options.future, "kept");
  assert.throws(() => schema.parse({ name: "Acme", limit: 0, mode: "safe" }));
  assert.throws(() => schema.parse({ name: "Acme", limit: 2, mode: "invalid" }));
});

test("jsonSchemaToZod supports const and pattern constraints", () => {
  const schema = jsonSchemaToZod({
    type: "object",
    properties: {
      kind: { const: "company" },
      slug: { type: "string", pattern: "^[a-z-]+$" },
    },
    required: ["kind", "slug"],
  });

  assert.deepEqual(schema.parse({ kind: "company", slug: "laser-reach" }), {
    kind: "company",
    slug: "laser-reach",
  });
  assert.throws(() => schema.parse({ kind: "person", slug: "Bad Slug" }));
});


test("registerSiteParityTools registers exact site names and dispatches through the scoped API", async () => {
  const registrations = [];
  const calls = [];
  const server = {
    registerTool(name, config, callback) {
      registrations.push({ name, config, callback });
    },
  };
  const client = {
    async invokeSiteTool(name, args) {
      calls.push({ name, args });
      return { success: true, name, args };
    },
  };
  const manifest = {
    registry_version: "version_1",
    tools: [{
      type: "function",
      function: {
        name: "list_companies",
        description: "List companies",
        parameters: {
          type: "object",
          properties: { limit: { type: "integer" } },
        },
      },
      "x-laserreach-access": {
        mutation: "read",
        required_scopes: ["abm:read"],
      },
    }],
  };

  assert.deepEqual(registerSiteParityTools(server, client, manifest), ["list_companies"]);
  assert.equal(registrations[0].name, "list_companies");
  assert.equal(registrations[0].config.annotations.readOnlyHint, true);
  const response = await registrations[0].callback({ limit: 7 });
  assert.match(response.content[0].text, /list_companies/);
  assert.deepEqual(calls, [{ name: "list_companies", args: { limit: 7 } }]);
});

test("registerSiteParityTools ignores duplicate registry rows", () => {
  const names = [];
  const server = {
    registerTool(name) {
      names.push(name);
    },
  };
  const row = {
    function: {
      name: "list_companies",
      parameters: { type: "object", properties: {} },
    },
  };

  const registered = registerSiteParityTools(server, {}, { tools: [row, row] });

  assert.deepEqual(registered, ["list_companies"]);
  assert.deepEqual(names, ["list_companies"]);
});
