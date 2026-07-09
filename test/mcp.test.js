import assert from "node:assert/strict";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

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

test("MCP server lists tools and calls capabilities", async () => {
  const api = await startMockApi((req, res) => {
    assert.equal(req.url, "/api/abm/agent/capabilities");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ local_agent_default: { mode: "local_execution" } }));
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [cliPath, "mcp"],
    env: {
      ...process.env,
      LASERREACH_API_BASE: api.url,
      LASERREACH_ORG_ID: "org_test",
      LASERREACH_AGENT_TOKEN: "tok_test",
    },
  });
  const client = new Client({ name: "laserreach-local-agent-test", version: "0.1.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_capabilities"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_list_signals"));
    const result = await client.callTool({ name: "laserreach_capabilities", arguments: {} });
    assert.match(result.content[0].text, /local_execution/);
  } finally {
    await client.close();
    await api.close();
  }
});
