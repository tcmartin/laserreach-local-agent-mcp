# Laserreach Local Agent MCP

Use Claude Desktop, Codex, or another local agent with Laserreach without handing control of Laserreach-hosted runs to that agent.

This package provides:

- an MCP stdio server with Laserreach tools for local agents;
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
6. Copy the one-time setup block.

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
- `laserreach_collect_source`: trigger collection for one source.
- `laserreach_list_signals`: list current signals.
- `laserreach_score_pending_signals`: ask Laserreach to score pending signals.
- `laserreach_process_signals`: ask Laserreach to process signal backlog.
- `laserreach_approve_signal`: approve a signal.
- `laserreach_dismiss_signal`: dismiss a signal.
- `laserreach_list_targets`: list companies or people.
- `laserreach_list_senders`: list LinkedIn/email sender connections.
- `laserreach_prepare_messages`: prepare outreach messages for review.
- `laserreach_sync_hubspot_outreach`: log local-agent outreach to HubSpot. Use `dry_run: true` first.
- `laserreach_request`: generic scoped request for advanced use.

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
      "args": ["exec", "--skip-git-repo-check"],
      "template": "Use Laserreach APIs to inspect this event and propose next actions. Event: {{json}}"
    }
  ],
  "jobs": [
    {
      "name": "Score pending signals every 30 minutes",
      "cron": "*/30 * * * *",
      "request": {
        "method": "POST",
        "path": "/api/abm/signals/score-pending",
        "body": { "limit": 25 }
      }
    },
    {
      "name": "Ask Codex to review new signals hourly",
      "cron": "0 * * * *",
      "request": {
        "method": "GET",
        "path": "/api/abm/signals",
        "query": { "status": "NEW", "limit": "20" }
      },
      "command": "codex",
      "args": ["exec", "--skip-git-repo-check"],
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
- Keep `LASERREACH_WEBHOOK_SECRET` set before exposing the webhook receiver.
- Do not store tokens in config files.
- Leave `agent-runs:control` off unless the user explicitly wants a local agent to control Laserreach-hosted runs.
- Prefer staging outreach for human review. Laserreach still enforces token scopes and org policies.

## Development

```bash
npm install
npm test
```

The tests cover the API client, webhook signature verification, command/template runner behavior, scheduled request behavior, and the MCP stdio server.
