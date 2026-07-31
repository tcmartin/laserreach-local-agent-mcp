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

test("MCP server lists tools and calls capabilities plus self-governed actions", async () => {
  const api = await startMockApi(async (req, res) => {
    if (req.url === "/api/abm/content/publish") {
      let body = "";
      for await (const chunk of req) body += chunk;
      assert.equal(req.method, "POST");
      assert.deepEqual(JSON.parse(body), {
        calendar_item_id: "content_1",
        connector: "manual",
        dry_run: true,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, status: "published" }));
      return;
    }
    if (req.url === "/api/abm/campaigns/launch-segment") {
      let body = "";
      for await (const chunk of req) body += chunk;
      assert.equal(req.method, "POST");
      assert.deepEqual(JSON.parse(body), {
        sequence_id: "seq_1",
        linkedin_account: "sender_1",
        icp_id: "icp_1",
        require_icp_match: true,
        dry_run: true,
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, dry_run: true }));
      return;
    }
    if (req.url === "/api/abm/sequences") {
      let body = "";
      for await (const chunk of req) body += chunk;
      assert.equal(req.method, "POST");
      assert.deepEqual(JSON.parse(body), {
        name: "Local sequence",
        steps: [{
          type: "li_message",
          delay_minutes: 0,
          message: "Hello from the local model",
          use_ai: false,
        }],
      });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ success: true, sequence_id: "seq_local" }));
      return;
    }
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
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_assess_signal"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_list_icps"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_manage_icp"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_refresh_icps"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_create_local_sequence"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_start_sequence"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_launch_campaign_segment"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_send_pipeline_message"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_publish_content"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_send_newsletter"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_revoke_self"));
    assert.ok(tools.tools.some((tool) => tool.name === "laserreach_sync_hubspot_outreach"));
    assert.ok(!tools.tools.some((tool) => tool.name === "laserreach_score_pending_signals"));
    assert.ok(!tools.tools.some((tool) => tool.name === "laserreach_process_signals"));
    assert.ok(!tools.tools.some((tool) => tool.name === "laserreach_prepare_messages"));
    const result = await client.callTool({ name: "laserreach_capabilities", arguments: {} });
    assert.match(result.content[0].text, /local_execution/);
    const sequenceResult = await client.callTool({
      name: "laserreach_create_local_sequence",
      arguments: {
        name: "Local sequence",
        steps: [{
          type: "li_message",
          delay_minutes: 0,
          message: "Hello from the local model",
        }],
      },
    });
    assert.match(sequenceResult.content[0].text, /seq_local/);
    const publishResult = await client.callTool({
      name: "laserreach_publish_content",
      arguments: {
        calendar_item_id: "content_1",
        connector: "manual",
        dry_run: true,
      },
    });
    assert.match(publishResult.content[0].text, /published/);
    const campaignResult = await client.callTool({
      name: "laserreach_launch_campaign_segment",
      arguments: {
        sequence_id: "seq_1",
        linkedin_account: "sender_1",
        icp_id: "icp_1",
        require_icp_match: true,
        dry_run: true,
      },
    });
    assert.match(campaignResult.content[0].text, /dry_run/);
  } finally {
    await client.close();
    await api.close();
  }
});
