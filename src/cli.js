#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { LaserreachClient } from "./client.js";
import { DEFAULT_CONFIG_PATH, loadRunnerConfig } from "./config.js";
import {
  assertMutationConfirmed,
  findManifestTool,
  selectManifestTools,
} from "./discovery.js";
import { runMcpServer } from "./mcp.js";
import {
  assertReplyEngineReady,
  defaultReplyCommand,
  LocalAgentRunner,
  runLocalReplyDaemon,
  runLocalReplyOnce,
} from "./runner.js";
import { installSkill, skillDistribution } from "./skill.js";

const HELP = `Laserreach local agent helper

Usage:
  laserreach-local-agent mcp
  laserreach-local-agent serve [--config ./laserreach.local-agent.config.json]
  laserreach-local-agent replies [--engine codex|claude] [--once]
  laserreach-local-agent capabilities
  laserreach-local-agent tools [--filter TERM] [--schemas]
  laserreach-local-agent invoke <TOOL> [JSON_ARGS] [--confirm-mutation]
  laserreach-local-agent install-skill [--target codex|claude|agents|gemini] [--path PATH] [--force]
  laserreach-local-agent skill-info
  laserreach-local-agent request <METHOD> <PATH> [JSON_BODY]
  laserreach-local-agent init [--path ./laserreach.local-agent.config.json]
  laserreach-local-agent sign <JSON_BODY>

Environment:
  LASERREACH_API_BASE       default https://api.laserreach.com
  LASERREACH_ORG_ID         required for API/MCP
  LASERREACH_AGENT_TOKEN    required for API/MCP
  LASERREACH_MCP_TOOL_MODE   compact (default) or full parity
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
  const safeCodex = defaultReplyCommand("codex");
  const sample = {
    host: "127.0.0.1",
    port: 8797,
    webhooks: [
      {
        event: "signal.created",
        name: "Send event to local Codex",
        command: safeCodex.command,
        args: safeCodex.args,
        template: "Use Laserreach APIs to inspect this event and propose next actions. Event: {{json}}",
      },
    ],
    jobs: [
      {
        name: "Refresh deterministic ICP scoring daily",
        cron: "15 3 * * *",
        request: {
          method: "POST",
          path: "/api/abm/icps/refresh",
          body: { limit: 500 },
        },
      },
      {
        name: "Ask Codex to review new signals hourly",
        cron: "0 * * * *",
        request: {
          method: "GET",
          path: "/api/abm/signals",
          query: { require_icp_match: "true", min_score: "0.5", limit: "20" },
        },
        command: safeCodex.command,
        args: safeCodex.args,
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
  if (command === "tools") {
    const manifest = await new LaserreachClient().siteTools({ includeInstructions: false });
    printJson({
      registry_version: manifest.registry_version,
      tools: selectManifestTools(manifest, {
        filter: argValue(args, "--filter", ""),
        includeSchemas: args.includes("--schemas"),
      }),
    });
    return;
  }
  if (command === "invoke") {
    const [toolName, argumentsRaw] = args;
    const toolArgs = argumentsRaw && !argumentsRaw.startsWith("--")
      ? JSON.parse(argumentsRaw)
      : {};
    const client = new LaserreachClient();
    const manifest = await client.siteTools({ includeInstructions: false });
    const tool = findManifestTool(manifest, toolName);
    assertMutationConfirmed(tool, args.includes("--confirm-mutation"));
    printJson(await client.invokeSiteTool(toolName, toolArgs));
    return;
  }
  if (command === "install-skill") {
    printJson(await installSkill({
      target: argValue(args, "--target", "agents"),
      path: argValue(args, "--path"),
      force: args.includes("--force"),
    }));
    return;
  }
  if (command === "skill-info") {
    printJson(skillDistribution());
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
  if (command === "replies") {
    const engine = argValue(args, "--engine", "codex");
    if (!["codex", "claude"].includes(engine)) {
      throw new Error("--engine must be codex or claude");
    }
    const commandOverride = argValue(args, "--command");
    const argsRaw = argValue(args, "--args");
    const commandArgs = argsRaw ? JSON.parse(argsRaw) : undefined;
    if (commandArgs && !Array.isArray(commandArgs)) {
      throw new Error("--args must be a JSON array");
    }
    const options = {
      engine,
      command: commandOverride,
      args: commandArgs,
      intervalMs: Number(argValue(args, "--interval-ms", "2000")),
      timeoutMs: Number(argValue(args, "--timeout-ms", "180000")),
      cwd: argValue(args, "--cwd"),
    };
    if (!commandOverride) {
      await assertReplyEngineReady(engine);
    }
    if (args.includes("--once")) {
      printJson(await runLocalReplyOnce(options));
      return;
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    console.error(
      `[laserreach-local-agent] polling LinkedIn replies with ${engine}; Ctrl-C to stop`,
    );
    await runLocalReplyDaemon({
      ...options,
      signal: controller.signal,
      onResult(result) {
        if (result.processed) {
          console.error(
            `[laserreach-local-agent] reply ${result.job_id} finished with ${result.state}`,
          );
        }
      },
    });
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
