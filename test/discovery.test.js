import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMutationConfirmed,
  findManifestTool,
  isMutatingTool,
  selectManifestTools,
} from "../src/discovery.js";

const manifest = {
  registry_version: "registry_test",
  tools: [
    {
      type: "function",
      function: {
        name: "list_companies",
        description: "List companies",
        parameters: { type: "object", properties: { limit: { type: "integer" } } },
      },
      "x-laserreach-access": { mutation: "read", required_scopes: ["abm:read"] },
    },
    {
      type: "function",
      function: {
        name: "linkedin_send_message",
        description: "Send a verified LinkedIn message",
        parameters: { type: "object", required: ["text"] },
      },
      "x-laserreach-access": { mutation: "outbound", required_scopes: ["outreach:send"] },
    },
  ],
};

test("tool discovery filters the live manifest and optionally returns schemas", () => {
  assert.deepEqual(selectManifestTools(manifest, { filter: "linkedin", includeSchemas: true }), [
    {
      name: "linkedin_send_message",
      description: "Send a verified LinkedIn message",
      access: { mutation: "outbound", required_scopes: ["outreach:send"] },
      inputSchema: { type: "object", required: ["text"] },
    },
  ]);
  assert.equal(selectManifestTools(manifest, { filter: "abm:read" })[0].name, "list_companies");
});

test("tool invocation requires explicit confirmation for every non-read mutation", () => {
  const readTool = findManifestTool(manifest, "list_companies");
  const sendTool = findManifestTool(manifest, "linkedin_send_message");

  assert.equal(isMutatingTool(readTool), false);
  assert.equal(isMutatingTool(sendTool), true);
  assert.equal(assertMutationConfirmed(readTool), readTool);
  assert.throws(() => assertMutationConfirmed(sendTool), /--confirm-mutation/);
  assert.equal(assertMutationConfirmed(sendTool, true), sendTool);
  assert.throws(() => findManifestTool(manifest, "missing_tool"), /not available/);
});
