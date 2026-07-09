#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { LaserreachClient } from "./client.js";
import { DEFAULT_CONFIG_PATH, loadRunnerConfig } from "./config.js";
import { runMcpServer } from "./mcp.js";
import { LocalAgentRunner } from "./runner.js";

const HELP = `Laserreach local agent helper

Usage:
  laserreach-local-agent mcp
  laserreach-local-agent serve [--config ./laserreach.local-agent.config.json]
  laserreach-local-agent capabilities
  laserreach-local-agent request <METHOD> <PATH> [JSON_BODY]
  laserreach-local-agent init [--path ./laserreach.local-agent.config.json]
  laserreach-local-agent sign <JSON_BODY>

Environment:
  LASERREACH_API_BASE       default https://api.laserreach.com
  LASERREACH_ORG_ID         required for API/MCP
  LASERREACH_AGENT_TOKEN    required for API/MCP
  LASERREACH_WEBHOOK_SECRET optional HMAC secret for serve/sign
`;

function argValue(args, flag, fallback = undefined) {
  const idx = args.indexOf(flag);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function initConfig(path) {
  const target = resolve(path || DEFAULT_CONFIG_PATH);
  const sample = {
    host: "127.0.0.1",
    port: 8797,
    webhooks: [
      {
        event: "signal.created",
        name: "Send event to local Codex",
        command: "codex",
        args: ["exec", "--skip-git-repo-check"],
        template: "Use Laserreach APIs to inspect this event and propose next actions. Event: {{json}}",
      },
    ],
    jobs: [
      {
        name: "Score pending signals every 30 minutes",
        cron: "*/30 * * * *",
        request: {
          method: "POST",
          path: "/api/abm/signals/score-pending",
          body: { limit: 25 },
        },
      },
      {
        name: "Ask Codex to review new signals hourly",
        cron: "0 * * * *",
        request: {
          method: "GET",
          path: "/api/abm/signals",
          query: { status: "NEW", limit: "20" },
        },
        command: "codex",
        args: ["exec", "--skip-git-repo-check"],
        template: "Review these Laserreach signals and recommend next actions. API result: {{result}}",
      },
    ],
  };
  await writeFile(target, `${JSON.stringify(sample, null, 2)}\n`, { flag: "wx" });
  printJson({ success: true, path: target });
}

async function main() {
  const [, , command = "help", ...args] = process.argv;
  if (command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "mcp") {
    await runMcpServer();
    return;
  }
  if (command === "capabilities") {
    printJson(await new LaserreachClient().capabilities());
    return;
  }
  if (command === "request") {
    const [method, path, bodyRaw] = args;
    const body = bodyRaw ? JSON.parse(bodyRaw) : undefined;
    printJson(await new LaserreachClient().request({ method, path, body }));
    return;
  }
  if (command === "init") {
    await initConfig(argValue(args, "--path", argValue(args, "--config", DEFAULT_CONFIG_PATH)));
    return;
  }
  if (command === "serve") {
    const config = await loadRunnerConfig(argValue(args, "--config", DEFAULT_CONFIG_PATH));
    const runner = new LocalAgentRunner(config);
    const address = await runner.start();
    console.error(`[laserreach-local-agent] listening on http://${address.host}:${address.port}`);
    return;
  }
  if (command === "sign") {
    const body = args.join(" ") || "{}";
    const secret = process.env.LASERREACH_WEBHOOK_SECRET || "";
    if (!secret) throw new Error("LASERREACH_WEBHOOK_SECRET is required for sign");
    const signature = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
    printJson({ signature: `sha256=${signature}` });
    return;
  }
  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
