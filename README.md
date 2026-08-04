# Laserreach Local Agent MCP

Use Claude Desktop, Codex, or another local agent with Laserreach without handing control of Laserreach-hosted runs to that agent.

This package provides:

- an MCP stdio server with Laserreach tools for local agents;
- an automatic LinkedIn reply daemon powered by the user's signed-in Codex or Claude Code;
- a webhook receiver for Laserreach, HubSpot, Zapier, Make, n8n, and other JSON event sources;
- cron-style scheduled jobs that can call Laserreach APIs and optionally pass results to a local command such as `codex`.

The default tool surface is built for local execution. It exposes source, signal, target, sender, policy, and outreach-staging APIs. It does not include a normal tool for creating or steering `/api/abm/agent-runs`, because that can consume Laserreach-hosted execution resources. If you intentionally need hosted run control, create a token with `agent-runs:control` and use `laserreach_request` directly.

## Install

```bash
npm install -g github:tcmartin/laserreach-local-agent-mcp
```

For local development from a clone:

```bash
npm install
npm link
```

## Laserreach Token Setup

1. Sign in to Laserreach.
2. Open your organization.
3. Go to **Settings > External Agents**.
4. Create a token for Claude Cowork, Codex, or your local agent.
5. Keep **Laserreach-hosted run control** off for normal local-agent use.
6. Choose **Self-governed local agent** when the agent should send and publish
   without per-action approval. Account caps and execution controls remain
   active. This does not enable hosted runs.
7. Copy the one-time setup block.

Set these environment variables:

```bash
export LASERREACH_API_BASE="https://api.laserreach.com"
export LASERREACH_ORG_ID="<org_id>"
export LASERREACH_AGENT_TOKEN="<external_agent_token>"
```

Test the connection:

```bash
laserreach-local-agent capabilities
```

## Automatic LinkedIn Replies With Local Codex Or Claude Code

This path does not use a Laserreach-hosted model:

```text
LinkedIn inbound webhook
  -> tenant-bound Laserreach queue
  -> local polling daemon
  -> signed-in Codex or Claude Code
  -> Laserreach policy gate
  -> Unipile send
```

Create an **Automatic local LinkedIn replies** token in Laserreach first. That preset enables only `local-drafts:run` and the narrow `local-replies:send` permission. It also sets an organization daily limit.

Install the helper and export the one-time setup values:

```bash
npm install -g github:tcmartin/laserreach-local-agent-mcp
export LASERREACH_API_BASE="https://api.laserreach.com"
export LASERREACH_ORG_ID="<org_id>"
export LASERREACH_AGENT_TOKEN="<external_agent_token>"
laserreach-local-agent replies --engine codex --once
```

Run with the local Codex login:

```bash
laserreach-local-agent replies --engine codex
```

Or run with the local Claude Code login:

```bash
laserreach-local-agent replies --engine claude
```

The process polls continuously. Keep it running on a computer with the selected
CLI already signed in. Startup checks authentication before claiming any job.
No per-message approval is requested. Codex runs ephemerally with user config,
rules, shell, exec, apps, browser, hooks, subagents, and image tools disabled.
Claude Code runs in print mode with all tools disabled, `dontAsk`, and no
session persistence. Each command runs in a temporary empty directory with a
minimal environment. The Laserreach token and unrelated application secrets
are not passed to it.

Laserreach enforces these checks after the local process returns text:

- the token is still active and assigned to the organization;
- the job is an inbound LinkedIn reply, not an arbitrary outbound job;
- the LinkedIn account is active and belongs to that organization;
- the automatic-reply setting and global kill switch are enabled;
- the organization has remaining queue and send capacity for the UTC day;
- the thread has not been marked as manually handled;
- the send reservation has not already been used.

Queue admission is capped before Codex or Claude Code runs. A local command failure cancels that job instead of retrying and consuming another local model call. An ambiguous provider failure is not retried automatically, which prevents duplicate LinkedIn messages.

Test one poll without leaving a daemon running:

```bash
laserreach-local-agent replies --engine codex --once
```

Immediate kill switch: revoke the runner token in Laserreach. Revocation also disables automatic local replies for the organization.

## MCP Server

Start the MCP server:

```bash
laserreach-local-agent mcp
```

Claude Desktop example:

```json
{
  "mcpServers": {
    "laserreach": {
      "command": "npx",
      "args": ["-y", "github:tcmartin/laserreach-local-agent-mcp", "mcp"],
      "env": {
        "LASERREACH_API_BASE": "https://api.laserreach.com",
        "LASERREACH_ORG_ID": "<org_id>",
        "LASERREACH_AGENT_TOKEN": "<external_agent_token>"
      }
    }
  }
}
```

See [docs/claude-desktop.md](docs/claude-desktop.md) for the full setup.

## MCP Tools

- `laserreach_capabilities`: fetch the live capability catalog.
- `laserreach_list_sources`: list signal sources.
- `laserreach_collect_source`: collect raw signals without LaserReach-hosted
  scoring. The local agent assesses them with `laserreach_assess_signal`.
- `laserreach_list_signals`: list ICP-matched signals by default, or request the
  raw feed.
- `laserreach_assess_signal`: store scoring produced by the local agent.
- `laserreach_resolve_signal_contact`: attach a real same-company person to a
  signal.
- `laserreach_list_icps`: list ICP definitions.
- `laserreach_manage_icp`: create, update, or delete an ICP.
- `laserreach_refresh_icps`: reapply deterministic ICP rules without a hosted
  model.
- `laserreach_approve_signal`: approve a signal.
- `laserreach_dismiss_signal`: dismiss a signal.
- `laserreach_list_targets`: list companies or people.
- `laserreach_list_senders`: list LinkedIn/email sender connections.
- `laserreach_create_local_sequence`: save locally generated outreach copy with
  `use_ai=false`; LaserReach does not call a hosted model.
- `laserreach_start_sequence`: start a sequence when the token has
  `outreach:send`.
- `laserreach_launch_campaign_segment`: queue a sequence for a selected segment.
- `laserreach_send_pipeline_message`: send a direct LinkedIn pipeline message.
- `laserreach_send_linkedin_message`: resolve a profile URL or provider ID to
  the exact recipient, find the old conversation across inbox pages, and send
  only to the verified chat. Use `dry_run: true` to preview the match.
- `laserreach_publish_content`: publish a content calendar item.
- `laserreach_send_newsletter`: send an account newsletter by email or Slack.
- `laserreach_sync_hubspot_outreach`: log local-agent outreach to HubSpot. Use `dry_run: true` first.
- `laserreach_revoke_self`: permanently revoke the current token.
- `laserreach_request`: generic scoped request for advanced use.

The normal MCP tools do not call LaserReach-hosted signal scoring, generation,
or agent runs. The local Claude, Codex, or other MCP client performs reasoning,
stores assessments with `laserreach_assess_signal`, and stores outreach copy
with `laserreach_create_local_sequence`. Direct API calls to model-backed
endpoints require the separate `hosted-ai:use` scope.

## ICP And Signal Workflow

1. Call `laserreach_list_icps`.
2. Call `laserreach_refresh_icps` after an ICP changes, or run the generated
   daily refresh schedule.
3. Call `laserreach_list_signals` with `quality: "raw"` when the local agent
   needs to assess new collection data.
4. Call `laserreach_assess_signal` with scores, ICP match, and reasoning.
5. Call `laserreach_list_signals` with the default `quality: "actionable"` for
   the filtered working queue.
6. For a job signal, find or create a real person and call
   `laserreach_resolve_signal_contact`.

## HubSpot Outreach Sync

When your local agent sends or stages outreach outside Laserreach-hosted runs, call:

```json
{
  "dry_run": true,
  "event_id": "local-demo-1",
  "company_id": "company_123",
  "person_id": "person_456",
  "channel": "email",
  "message": "Short message body or summary"
}
```

After the dry run returns the planned Company, Contact, Deal, and Note, call again with `dry_run: false` or omit it. Laserreach creates or updates the HubSpot records, associates them, writes one note, and records sync failures in the account.

## Webhook Receiver And Cron Runner

Create a config:

```bash
laserreach-local-agent init
```

Start the local receiver and scheduler:

```bash
export LASERREACH_WEBHOOK_SECRET="<shared_secret>"
laserreach-local-agent serve --config ./laserreach.local-agent.config.json
```

Health check:

```bash
curl http://127.0.0.1:8797/health
```

Local webhook smoke:

```bash
curl -X POST "http://127.0.0.1:8797/webhooks/signal.created" \
  -H "Content-Type: application/json" \
  -H "X-Laserreach-Signature: sha256=<HMAC-SHA256-of-the-exact-body>" \
  -d '{"event_id":"evt_demo","type":"signal.created","company_name":"ExampleCo"}'
```

Expose the webhook receiver with a tunnel only after setting `LASERREACH_WEBHOOK_SECRET`:

```bash
ngrok http 8797
```

Then configure your event source to post to:

```text
https://<your-tunnel-host>/webhooks/<event_type>
```

## Config Shape

```json
{
  "host": "127.0.0.1",
  "port": 8797,
  "webhooks": [
    {
      "event": "signal.created",
      "name": "Draft local follow-up",
      "command": "codex",
      "args": ["exec", "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--disable", "shell_tool", "--disable", "unified_exec", "--disable", "apps", "--disable", "browser_use", "-"],
      "template": "Use Laserreach APIs to inspect this event and propose next actions. Event: {{json}}"
    }
  ],
  "jobs": [
    {
      "name": "Refresh deterministic ICP scoring daily",
      "cron": "15 3 * * *",
      "request": {
        "method": "POST",
        "path": "/api/abm/icps/refresh",
        "body": { "limit": 500 }
      }
    },
    {
      "name": "Ask Codex to review new signals hourly",
      "cron": "0 * * * *",
      "request": {
        "method": "GET",
        "path": "/api/abm/signals",
        "query": {
          "require_icp_match": "true",
          "min_score": "0.5",
          "limit": "20"
        }
      },
      "command": "codex",
      "args": ["exec", "--sandbox", "read-only", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "--disable", "shell_tool", "--disable", "unified_exec", "--disable", "apps", "--disable", "browser_use", "-"],
      "template": "Review these Laserreach signals and recommend next actions. API result: {{result}}"
    }
  ]
}
```

Webhook signatures use HMAC SHA-256 over the raw JSON body. Send the hex digest in one of these headers:

```text
X-Laserreach-Signature: sha256=<hex>
X-Hub-Signature-256: sha256=<hex>
X-Signature: sha256=<hex>
```

## Security Notes

- Keep `LASERREACH_AGENT_TOKEN` in local environment variables or a secret manager.
- `serve` refuses to start with webhook handlers unless `LASERREACH_WEBHOOK_SECRET` is set.
- Do not store tokens in config files.
- Webhook and cron commands receive a minimal environment. Add command-specific values explicitly in the action's `env` object.
- Webhook event IDs are validated, stored under hashed filenames, and deduplicated before actions run. The state directory and event files are private to the local user.
- Leave `agent-runs:control` off unless the user explicitly wants a local agent to control Laserreach-hosted runs.
- Leave `hosted-ai:use` off when the local agent supplies signal reasoning and
  outreach copy.
- Grant `outreach:send` when the local agent should send messages, newsletters,
  or start campaigns. It does not imply `agent-runs:control`.
- Self-governed mode removes human approvals. Organization caps, sender and
  connector checks, business hours, deduplication, kill switches, scopes, and
  audit logging remain enforced.
- Use `laserreach_revoke_self` with `confirm: "REVOKE"` as the API kill switch.
- The local reply preset is an explicit no-review mode. Use its daily limit and revoke the token to stop it.
- Generic local drafting remains draft-only. Only inbound LinkedIn reply jobs can use the policy-gated send endpoint.

## Development

```bash
npm install
npm test
```

The tests cover the API client, webhook signature verification, command/template runner behavior, scheduled requests, the MCP stdio server, local reply prompt isolation, claim/draft/send flow, and no-retry behavior after local model failures.
