import assert from "node:assert/strict";
import test from "node:test";

import { z } from "../src/zod-compat.js";
import {
  createToolRegistrationFacade,
  normalizeToolConfig,
  normalizeToolInputSchema,
} from "../src/mcp-schema.js";

test("normalizeToolInputSchema wraps v1 raw shapes in a Zod 4 object", () => {
  const schema = normalizeToolInputSchema({ name: z.string().min(1) });
  assert.deepEqual(schema.parse({ name: "Laserreach" }), { name: "Laserreach" });
  assert.throws(() => schema.parse({ name: "" }));
});

test("normalizeToolConfig omits empty input schemas and preserves Standard Schemas", () => {
  const existing = z.object({ limit: z.number().int() });
  assert.equal(normalizeToolConfig({ inputSchema: existing }).inputSchema, existing);
  assert.equal(Object.hasOwn(normalizeToolConfig({ inputSchema: {} }), "inputSchema"), false);
});

test("tool registration facade normalizes before delegating", () => {
  const calls = [];
  const facade = createToolRegistrationFacade({
    registerTool(name, config, handler) {
      calls.push({ name, config, handler });
      return { name };
    },
  });
  const handler = async () => ({ content: [] });
  assert.deepEqual(
    facade.registerTool("demo", { inputSchema: { id: z.string() } }, handler),
    { name: "demo" },
  );
  assert.deepEqual(calls[0].config.inputSchema.parse({ id: "one" }), { id: "one" });
  assert.equal(calls[0].handler, handler);
});

test("Zod compatibility layer preserves v3 one-argument record definitions", () => {
  const schema = z.record(z.string());
  assert.deepEqual(schema.parse({ one: "two" }), { one: "two" });
  assert.throws(() => schema.parse({ one: 2 }));
});
