import assert from "node:assert/strict";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(__dirname, "../src/cli.js");

function startMockApi(handler) {
  const server = createServer(handler);
  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveStart({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
      });
    });
  });
}

test("2025-era clients retain full top-level site-tool parity when explicitly enabled", async () => {
  let manifestRequests = 0;
  const api = await startMockApi(async (req, res) => {
    if (req.url === "/api/abm/agent/tools?include_instructions=false") {
      manifestRequests += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        success: true,
        registry_version: "registry_legacy_test",
        tools: [{
          type: "function",
          function: {
            name: "list_companies",
            description: "List companies from the site registry.",
            parameters: {
              type: "object",
              properties: { limit: { type: "integer", minimum: 1, maximum: 20 } },
            },
          },
          "x-laserreach-access": {
            mutation: "read",
            required_scopes: ["abm:read"],
          },
        }],
      }));
      return;
    }

    if (req.url === "/api/abm/agent/tools/list_companies/invoke") {
      let body = "";
      for await (const chunk of req) body += chunk;
      assert.equal(req.method, "POST");
      assert.deepEqual(JSON.parse(body), { arguments: { limit: 2 } });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, result: { companies: [] } }));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, "mcp"],
    env: {
      ...process.env,
      LASERREACH_API_BASE: api.url,
      LASERREACH_ORG_ID: "org_test",
      LASERREACH_AGENT_TOKEN: "tok_test",
      LASERREACH_MCP_TOOL_MODE: "full",
    },
  });
  const client = new Client({ name: "laserreach-legacy-test", version: "0.1.0" });

  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), "legacy");

    const tools = await client.listTools();
    assert.equal(manifestRequests, 1);
    assert.ok(tools.tools.some((tool) => tool.name === "list_companies"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_search_site_tools"));

    const result = await client.callTool({
      name: "list_companies",
      arguments: { limit: 2 },
    });
    assert.match(result.content[0].text, /companies/);
  } finally {
    await client.close();
    await api.close();
  }
});
