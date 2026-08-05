import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  BUNDLED_SKILL_DIR,
  installSkill,
  resolveSkillTarget,
  skillDistribution,
} from "../src/skill.js";

test("portable skill installs into supported AI skill directories", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "laserreach-skill-"));
  try {
    const result = await installSkill({ target: "codex", homeDir });
    assert.equal(result.path, join(homeDir, ".codex", "skills", "laserreach"));
    const contents = await readFile(join(result.path, "SKILL.md"), "utf8");
    assert.match(contents, /name: laserreach/);
    assert.match(contents, /LASERREACH_AGENT_TOKEN/);
    assert.doesNotMatch(contents, /trevormartin@|tokenpickle|ACoAAA/);
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});

test("skill installer protects existing skills unless force is explicit", async () => {
  const root = await mkdtemp(join(tmpdir(), "laserreach-custom-skill-"));
  const destination = join(root, "laserreach");
  try {
    await installSkill({ path: destination });
    await assert.rejects(() => installSkill({ path: destination }), /already exists/);
    await writeFile(join(destination, "marker.txt"), "replace me");
    const result = await installSkill({ path: destination, force: true });
    assert.equal(result.path, destination);
    await assert.rejects(() => access(join(destination, "marker.txt")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("skill metadata exposes portable public installation paths", () => {
  const info = skillDistribution();
  assert.match(info.repository, /^https:\/\/github\.com\//);
  assert.match(info.raw, /SKILL\.md$/);
  assert.match(info.install.codex, /--target codex$/);
  assert.match(info.install.claude, /--target claude$/);
  assert.equal(resolveSkillTarget({ target: "agents", homeDir: "/tmp/home" }), "/tmp/home/.agents/skills/laserreach");
  assert.match(BUNDLED_SKILL_DIR, /skills\/laserreach$/);
});
