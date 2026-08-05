import { access, cp, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BUNDLED_SKILL_DIR = join(PACKAGE_ROOT, "skills", "laserreach");

const TARGETS = {
  agents: [".agents", "skills", "laserreach"],
  claude: [".claude", "skills", "laserreach"],
  codex: [".codex", "skills", "laserreach"],
  gemini: [".gemini", "skills", "laserreach"],
};

export function skillDistribution() {
  const install = Object.fromEntries(
    Object.keys(TARGETS).map((target) => [
      target,
      `npx -y github:tcmartin/laserreach-local-agent-mcp install-skill --target ${target}`,
    ]),
  );
  return {
    name: "laserreach",
    license: "MIT",
    repository: "https://github.com/tcmartin/laserreach-local-agent-mcp",
    source: "https://github.com/tcmartin/laserreach-local-agent-mcp/tree/main/skills/laserreach",
    raw: "https://raw.githubusercontent.com/tcmartin/laserreach-local-agent-mcp/main/skills/laserreach/SKILL.md",
    install,
  };
}

export function resolveSkillTarget({ target = "agents", path, homeDir = homedir() } = {}) {
  if (path) return resolve(path);
  const parts = TARGETS[String(target || "").toLowerCase()];
  if (!parts) {
    throw new Error(`Unknown skill target: ${target}. Use ${Object.keys(TARGETS).join(", ")}, or --path`);
  }
  return join(homeDir, ...parts);
}

export async function installSkill(options = {}) {
  const destination = resolveSkillTarget(options);
  try {
    await access(destination);
    if (!options.force) {
      throw new Error(`Skill already exists at ${destination}; use --force to replace it`);
    }
    await rm(destination, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await cp(BUNDLED_SKILL_DIR, destination, { recursive: true });
  return { success: true, name: "laserreach", path: destination };
}
