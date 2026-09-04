import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_API_BASE = "https://api.laserreach.com";
export const DEFAULT_CONFIG_PATH = "laserreach.local-agent.config.json";

export function cleanApiBase(value = process.env.LASERREACH_API_BASE || DEFAULT_API_BASE) {
  return String(value || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function getLaserreachEnv(env = process.env) {
  return {
    apiBase: cleanApiBase(env.LASERREACH_API_BASE),
    orgId: String(env.LASERREACH_ORG_ID || "").trim(),
    token: String(env.LASERREACH_AGENT_TOKEN || "").trim(),
    requestTimeoutMs: env.LASERREACH_REQUEST_TIMEOUT_MS,
    safeReadMaxAttempts: env.LASERREACH_SAFE_READ_MAX_ATTEMPTS,
    retryDelayMs: env.LASERREACH_RETRY_DELAY_MS,
  };
}

export function requireLaserreachEnv(env = process.env) {
  const config = getLaserreachEnv(env);
  const missing = [];
  if (!config.orgId) missing.push("LASERREACH_ORG_ID");
  if (!config.token) missing.push("LASERREACH_AGENT_TOKEN");
  if (missing.length) {
    const err = new Error(`Missing required environment variables: ${missing.join(", ")}`);
    err.code = "missing_laserreach_env";
    err.missing = missing;
    throw err;
  }
  return config;
}

export function defaultStateDir(env = process.env) {
  return resolve(env.LASERREACH_LOCAL_STATE_DIR || join(homedir(), ".laserreach-local-agent"));
}

export async function loadRunnerConfig(path = DEFAULT_CONFIG_PATH) {
  const cleanPath = resolve(path || DEFAULT_CONFIG_PATH);
  if (!existsSync(cleanPath)) {
    return {
      path: cleanPath,
      host: "127.0.0.1",
      port: 8797,
      webhooks: [],
      jobs: [],
    };
  }
  const raw = await readFile(cleanPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    path: cleanPath,
    host: parsed.host || "127.0.0.1",
    port: Number(parsed.port || 8797),
    webhooks: Array.isArray(parsed.webhooks) ? parsed.webhooks : [],
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
  };
}
