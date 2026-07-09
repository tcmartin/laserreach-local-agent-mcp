import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LaserreachClient } from "../src/client.js";
import { LocalAgentRunner, renderTemplate, runCommand, runConfiguredRequest, verifySignature } from "../src/runner.js";

test("verifySignature accepts HMAC SHA-256 headers", () => {
  const body = Buffer.from('{"event_id":"evt_1"}');
  const secret = "secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(verifySignature(body, `sha256=${signature}`, secret), true);
  assert.equal(verifySignature(body, "sha256=deadbeef", secret), false);
});

test("renderTemplate exposes payload and request result", () => {
  const rendered = renderTemplate("Event {{event}} {{json}} {{result}}", {
    event: "signal.created",
    payload: { company: "Acme" },
    result: { ok: true },
  });
  assert.match(rendered, /signal\.created/);
  assert.match(rendered, /Acme/);
  assert.match(rendered, /"ok": true/);
});

test("runCommand passes rendered template to stdin", async () => {
  const result = await runCommand(
    {
      command: process.execPath,
      args: ["-e", "process.stdin.pipe(process.stdout)"],
      template: "hello {{event}}",
    },
    { event: "laserreach" },
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "hello laserreach");
});

test("runConfiguredRequest calls the Laserreach client", async () => {
  const client = {
    request: async (args) => ({ received: args }),
  };
  const result = await runConfiguredRequest(
    {
      request: {
        method: "GET",
        path: "/api/abm/signals",
        query: { limit: "5" },
      },
    },
    client,
  );
  assert.equal(result.received.path, "/api/abm/signals");
});

test("LocalAgentRunner receives webhook, runs handler, and writes event file", async () => {
  const stateDir = await mkdtemp(join(tmpdir(), "laserreach-runner-"));
  const config = {
    host: "127.0.0.1",
    port: 0,
    webhooks: [
      {
        event: "signal.created",
        name: "echo",
        command: process.execPath,
        args: ["-e", "process.stdin.pipe(process.stdout)"],
        template: "event={{event}} payload={{json}}",
      },
    ],
    jobs: [],
  };
  const runner = new LocalAgentRunner(config, {
    stateDir,
    webhookSecret: "secret",
    client: new LaserreachClient({
      apiBase: "http://127.0.0.1:1",
      orgId: "org_test",
      token: "tok_test",
      fetchImpl: async () => {
        throw new Error("not used");
      },
    }),
  });
  try {
    await runner.start();
    const address = runner.server.address();
    const body = Buffer.from('{"event_id":"evt_runner","type":"signal.created","company":"Acme"}');
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/signal.created`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-laserreach-signature": `sha256=${signature}`,
      },
      body,
    });
    const payload = await response.json();
    assert.equal(response.status, 202);
    assert.equal(payload.handlers[0].command, true);
    const eventFile = await readFile(payload.event_file, "utf8");
    assert.match(eventFile, /evt_runner/);
  } finally {
    await runner.stop();
    await rm(stateDir, { recursive: true, force: true });
  }
});

test("mock API helper still works for scheduled request actions", async () => {
  const server = createServer(async (req, res) => {
    assert.equal(req.url, "/api/abm/signals/score-pending");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ scored: true }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const client = new LaserreachClient({
      apiBase: `http://127.0.0.1:${address.port}`,
      orgId: "org_test",
      token: "tok_test",
    });
    const result = await runConfiguredRequest(
      {
        request: {
          method: "POST",
          path: "/api/abm/signals/score-pending",
          body: { limit: 1 },
        },
      },
      client,
    );
    assert.deepEqual(result, { scored: true });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
