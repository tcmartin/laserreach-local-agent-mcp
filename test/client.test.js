import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { LaserreachClient } from "../src/client.js";

function startMockApi(handler) {
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("LaserreachClient sends bearer token and org header", async () => {
  const api = await startMockApi((req, res) => {
    assert.equal(req.headers.authorization, "Bearer tok_test");
    assert.equal(req.headers["x-org-id"], "org_test");
    assert.equal(req.url, "/api/abm/agent/capabilities");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    assert.deepEqual(await client.capabilities(), { ok: true });
  } finally {
    await api.close();
  }
});

test("LaserreachClient includes JSON bodies and reports API errors", async () => {
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/api/abm/signals/score-pending");
    assert.deepEqual(JSON.parse(body), { limit: 3 });
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "missing_scope" }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    await assert.rejects(
      () => client.scorePendingSignals({ limit: 3 }),
      (error) => error.status === 403 && error.body.error === "missing_scope",
    );
  } finally {
    await api.close();
  }
});

test("LaserreachClient always requests local processing for source collection", async () => {
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/api/abm/sources/source%20%2F1/collect");
    assert.deepEqual(JSON.parse(body), {
      requested_by: "codex",
      processing_mode: "local",
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true, processing_mode: "local" }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    assert.deepEqual(
      await client.collectSource("source /1", { requested_by: "codex" }),
      { success: true, processing_mode: "local" },
    );
  } finally {
    await api.close();
  }
});

test("LaserreachClient syncs local outreach to HubSpot endpoint", async () => {
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/api/abm/crm/hubspot/outreach-sync");
    assert.equal(req.headers.authorization, "Bearer tok_test");
    assert.equal(req.headers["x-org-id"], "org_test");
    assert.deepEqual(JSON.parse(body), {
      dry_run: true,
      company_id: "company_1",
      person_id: "person_1",
      channel: "email",
      message: "Local agent drafted this.",
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, dry_run: true }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    assert.deepEqual(
      await client.syncHubspotOutreach({
        dry_run: true,
        company_id: "company_1",
        person_id: "person_1",
        channel: "email",
        message: "Local agent drafted this.",
      }),
      { ok: true, dry_run: true },
    );
  } finally {
    await api.close();
  }
});

test("LaserreachClient sends recipient-bound LinkedIn message requests", async () => {
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/api/abm/linkedin/messages/send");
    assert.deepEqual(JSON.parse(body), {
      linkedin_url: "https://www.linkedin.com/in/target-person/",
      text: "Hello from the verified old thread",
      require_existing_chat: true,
      dry_run: true,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      dry_run: true,
      chat_id: "verified_chat",
      recipient: { provider_id: "target_provider" },
    }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    const result = await client.sendLinkedinMessage({
      linkedin_url: "https://www.linkedin.com/in/target-person/",
      text: "Hello from the verified old thread",
      require_existing_chat: true,
      dry_run: true,
    });
    assert.equal(result.chat_id, "verified_chat");
  } finally {
    await api.close();
  }
});

test("LaserreachClient drives the local reply claim, draft, and send endpoints", async () => {
  const requests = [];
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      method: req.method,
      url: req.url,
      idempotencyKey: req.headers["idempotency-key"],
      body: body ? JSON.parse(body) : undefined,
    });
    res.writeHead(req.url.endsWith("/claim") ? 204 : 200, {
      "content-type": "application/json",
    });
    res.end(req.url.endsWith("/claim") ? "" : JSON.stringify({ success: true }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    assert.deepEqual(await client.claimLocalDraftJob({ lease_seconds: 120 }), {});
    await client.submitLocalDraft(
      "job /1",
      { claim_token: "claim", draft: { text: "Hello" } },
      "result-1",
    );
    await client.sendLocalReply("job /1");
    assert.deepEqual(requests, [
      {
        method: "POST",
        url: "/api/abm/local-draft-jobs/claim",
        idempotencyKey: undefined,
        body: { lease_seconds: 120 },
      },
      {
        method: "POST",
        url: "/api/abm/local-draft-jobs/job%20%2F1/drafts",
        idempotencyKey: "result-1",
        body: { claim_token: "claim", draft: { text: "Hello" } },
      },
      {
        method: "POST",
        url: "/api/abm/local-draft-jobs/job%20%2F1/send",
        idempotencyKey: undefined,
        body: {},
      },
    ]);
  } finally {
    await api.close();
  }
});

test("LaserreachClient exposes local assessment, ICP refresh, outbound, and kill-switch routes", async () => {
  const requests = [];
  const api = await startMockApi(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    requests.push({
      method: req.method,
      url: req.url,
      body: body ? JSON.parse(body) : undefined,
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  });
  try {
    const client = new LaserreachClient({
      apiBase: api.url,
      orgId: "org_test",
      token: "tok_test",
    });
    await client.listIcps({ status: "active" });
    await client.refreshIcps({ limit: 50 });
    await client.assessSignal("sig /1", {
      intent_score: 0.8,
      relevance_score: 0.7,
      icp_match: true,
      reasoning: "Local assessment",
    });
    await client.resolveSignalContact("sig /1", "person_1");
    await client.createLocalSequence({
      name: "Local sequence",
      steps: [{
        type: "li_message",
        message: "Hello from the local agent",
        use_ai: true,
      }],
    });
    await client.startSequence("seq /1", { mode: "approved" });
    await client.launchCampaignSegment({ sequence_id: "seq /1", dry_run: true });
    await client.sendPipelineMessage("pipe /1", "Send this");
    await client.publishContent({
      calendar_item_id: "content_1",
      connector: "manual",
    });
    await client.sendNewsletter("news /1", {
      channel: "email",
      recipients: ["owner@example.com"],
    });
    await client.revokeSelf();
    assert.deepEqual(requests, [
      { method: "GET", url: "/api/abm/icps?status=active", body: undefined },
      { method: "POST", url: "/api/abm/icps/refresh", body: { limit: 50 } },
      {
        method: "PATCH",
        url: "/api/abm/signals/sig%20%2F1/assessment",
        body: {
          intent_score: 0.8,
          relevance_score: 0.7,
          icp_match: true,
          reasoning: "Local assessment",
        },
      },
      {
        method: "PATCH",
        url: "/api/abm/signals/sig%20%2F1/contact",
        body: { person_id: "person_1" },
      },
      {
        method: "POST",
        url: "/api/abm/sequences",
        body: {
          name: "Local sequence",
          steps: [{
            type: "li_message",
            message: "Hello from the local agent",
            use_ai: false,
          }],
        },
      },
      {
        method: "POST",
        url: "/api/abm/sequences/seq%20%2F1/start",
        body: { mode: "approved" },
      },
      {
        method: "POST",
        url: "/api/abm/campaigns/launch-segment",
        body: { sequence_id: "seq /1", dry_run: true },
      },
      {
        method: "POST",
        url: "/api/abm/pipelines/pipe%20%2F1/messages/send",
        body: { text: "Send this" },
      },
      {
        method: "POST",
        url: "/api/abm/content/publish",
        body: { calendar_item_id: "content_1", connector: "manual" },
      },
      {
        method: "POST",
        url: "/api/abm/newsletters/news%20%2F1/send",
        body: { channel: "email", recipients: ["owner@example.com"] },
      },
      { method: "DELETE", url: "/api/abm/agent/token", body: undefined },
    ]);
  } finally {
    await api.close();
  }
});

test("LaserreachClient rejects absolute request URLs before attaching credentials", async () => {
  let called = false;
  const client = new LaserreachClient({
    apiBase: "https://api.laserreach.test",
    orgId: "org_test",
    token: "tok_test",
    fetchImpl: async () => {
      called = true;
      throw new Error("must not run");
    },
  });

  await assert.rejects(
    () => client.request({ path: "https://attacker.example/collect" }),
    /must be relative/,
  );
  assert.equal(called, false);
});
