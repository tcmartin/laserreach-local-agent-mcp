# Preserve reply ownership during credential changes

## Observed behavior

The deployed local-draft API restricts external-agent job listing and processing to the authenticated runner token. Replacing a credential with equivalent scopes does not transfer old queued work. An empty new-token queue can therefore hide unresolved work from that caller without indicating a service failure.

## Change

Added the runner-ownership distinction and supported recovery boundaries to the existing customer GTM playbook. No account-specific identities, secrets, or private messages are included. No runtime code or policy changed; the existing skill entrypoint already routes acquisition work to this reference.

## Validation scope

Verify skill structure, package inclusion, instruction consistency and helper regression tests. Unit/integration/live runtime behavior is unchanged; documentation validation is not proof that a migration endpoint exists or that jobs were processed. No new migration endpoint is claimed.

Validated September 7: `quick_validate.py skills/laserreach` passed; `npm pack --dry-run --json` includes the reference; `git diff --check` passed. The initial clean-worktree test attempt lacked installed dependencies. After `npm ci --ignore-scripts`, `npm test` passed all 41 tests, including mock-API, MCP and local runner integration tests. No production send was used as a smoke test. Backend full-suite and live backend smoke are not applicable to this documentation-only change.

Dependency installation reported two audit findings (one moderate, one high) in the unchanged locked dependency tree. No dependency versions or runtime source were changed by this task. These findings remain outside this documentation patch and are not counted as resolved.
