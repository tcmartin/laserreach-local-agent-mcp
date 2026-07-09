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
