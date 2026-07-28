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
