import { spawn } from "node:child_process";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import cron from "node-cron";

import { LaserreachClient } from "./client.js";
import { defaultStateDir } from "./config.js";

function normalizeSignature(value) {
  return String(value || "")
    .trim()
    .replace(/^sha256=/i, "")
    .replace(/^v1=/i, "");
}

export function verifySignature(rawBody, headerValue, secret) {
  if (!secret) return true;
  const received = normalizeSignature(headerValue);
  if (!received) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function renderTemplate(template, context = {}) {
  const json = JSON.stringify(context.payload ?? context, null, 2);
  const result = JSON.stringify(context.result ?? {}, null, 2);
  return String(template || "{{json}}")
    .replaceAll("{{json}}", json)
    .replaceAll("{{event}}", String(context.event || ""))
    .replaceAll("{{result}}", result)
    .replaceAll("{{received_at}}", String(context.receivedAt || ""));
}

async function readBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("request_body_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function matchesEvent(handler, event) {
  const expected = String(handler.event || "*");
  return expected === "*" || expected === event;
}

async function writeEventRecord(record, stateDir) {
  const dir = join(stateDir, "events");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${record.event_id}.json`);
  await writeFile(path, JSON.stringify(record, null, 2), "utf8");
  return path;
}

export async function runConfiguredRequest(action, client) {
  if (!action?.request) return undefined;
  return client.request(action.request);
}

export function runCommand(action, context = {}) {
  if (!action?.command) return Promise.resolve({ started: false });
  const input = renderTemplate(action.template, context);
  return new Promise((resolve, reject) => {
    const child = spawn(action.command, Array.isArray(action.args) ? action.args : [], {
      cwd: action.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(action.env || {}),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        started: true,
        code,
        signal,
        stdout,
        stderr,
      });
    });
    child.stdin.end(input);
  });
}

async function runAction(action, context, client) {
  const result = await runConfiguredRequest(action, client);
  const command = await runCommand(action, { ...context, result });
  return { name: action.name, result, command };
}

export class LocalAgentRunner {
  constructor(config, options = {}) {
    this.config = config || {};
    this.client = options.client || new LaserreachClient(options.clientOptions || {});
    this.stateDir = options.stateDir || defaultStateDir();
    this.webhookSecret = options.webhookSecret ?? process.env.LASERREACH_WEBHOOK_SECRET ?? "";
    this.server = null;
    this.tasks = [];
  }

  async handleWebhook(req, res, routeEvent = "") {
    let rawBody;
    try {
      rawBody = await readBody(req, Number(this.config.maxBodyBytes || 1024 * 1024));
    } catch (error) {
      writeJson(res, 413, { success: false, error: error.message });
      return;
    }

    const signature =
      req.headers["x-laserreach-signature"] ||
      req.headers["x-hub-signature-256"] ||
      req.headers["x-signature"] ||
      "";
    if (!verifySignature(rawBody, signature, this.webhookSecret)) {
      writeJson(res, 401, { success: false, error: "invalid_signature" });
      return;
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8") || "{}");
    } catch {
      writeJson(res, 400, { success: false, error: "invalid_json" });
      return;
    }

    const event = String(routeEvent || payload.type || payload.event || "event").trim();
    const eventId = String(payload.event_id || payload.eventId || payload.id || `evt_${randomUUID()}`);
    const receivedAt = new Date().toISOString();
    const record = { event_id: eventId, event, received_at: receivedAt, payload };
    const eventFile = await writeEventRecord(record, this.stateDir);
    const handlers = (this.config.webhooks || []).filter((handler) => matchesEvent(handler, event));
    const runs = [];
    for (const handler of handlers) {
      runs.push(await runAction(handler, { event, receivedAt, payload, eventFile }, this.client));
    }
    writeJson(res, 202, {
      success: true,
      event_id: eventId,
      event,
      event_file: eventFile,
      handlers: runs.map((run) => ({ name: run.name, command: run.command?.started || false })),
    });
  }

  scheduleJobs() {
    for (const job of this.config.jobs || []) {
      if (!job?.cron) continue;
      const task = cron.schedule(
        job.cron,
        async () => {
          try {
            await runAction(job, { event: "cron", receivedAt: new Date().toISOString(), payload: { job: job.name } }, this.client);
          } catch (error) {
            console.error(`[laserreach-local-agent] job failed: ${job.name || job.cron}`, error);
          }
        },
        { scheduled: false },
      );
      task.start();
      this.tasks.push(task);
    }
  }

  async start() {
    this.scheduleJobs();
    const host = this.config.host || "127.0.0.1";
    const port = Number(this.config.port || 8797);
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, {
          ok: true,
          jobs: this.tasks.length,
          webhooks: (this.config.webhooks || []).length,
        });
        return;
      }
      if (req.method === "POST" && url.pathname.startsWith("/webhooks")) {
        const routeEvent = decodeURIComponent(url.pathname.replace(/^\/webhooks\/?/, ""));
        await this.handleWebhook(req, res, routeEvent);
        return;
      }
      writeJson(res, 404, { success: false, error: "not_found" });
    });
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(port, host, resolve);
    });
    return { host, port };
  }

  async stop() {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    if (this.server) {
      await new Promise((resolve, reject) => this.server.close((error) => (error ? reject(error) : resolve())));
      this.server = null;
    }
  }
}
