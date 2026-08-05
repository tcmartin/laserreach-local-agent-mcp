---
name: laserreach
description: Operate a user's Laserreach workspace through the external-agent API or MCP server. Use for account-based marketing research, signals, ICPs, contacts, sequences, campaigns, content, newsletters, CRM sync, LinkedIn inbox lookup, recipient-safe LinkedIn messaging, and automatic local reply workflows. Requires a user-supplied organization ID and external-agent token; never assumes a particular Laserreach account.
---

# Laserreach

Use Laserreach as the governed system of record for outreach work. Discover the live tool catalog before acting because token scopes and server capabilities can differ by organization.

## Configure access

Require these values from the user's own Laserreach external-agent setup:

```bash
export LASERREACH_API_BASE="https://api.laserreach.com"
export LASERREACH_ORG_ID="<organization-id>"
export LASERREACH_AGENT_TOKEN="<one-time-token>"
```

Do not print, commit, transmit elsewhere, or embed the token in a prompt. Prefer the AI client's secret store or process environment. Never use credentials belonging to another organization.

## Connect

Prefer the bundled MCP server when the host supports MCP:

```bash
npx -y github:tcmartin/laserreach-local-agent-mcp mcp
```

For agents without MCP support, use the same package as a CLI:

```bash
npx -y github:tcmartin/laserreach-local-agent-mcp capabilities
npx -y github:tcmartin/laserreach-local-agent-mcp tools --filter linkedin
```

Read [references/api.md](references/api.md) when using the CLI or REST API directly.

## Operating workflow

1. Call `laserreach_capabilities` or `capabilities` to confirm authentication and current features.
2. Fetch `laserreach_site_tools_manifest` or run `tools` to discover only the tools allowed by the current token.
3. Read current state before proposing or performing a mutation.
4. Use canonical site tools for the requested operation. Do not invent endpoints or parameters.
5. Obtain explicit user authorization before outbound communication, campaign launch, publishing, deletion, or another externally visible mutation.
6. Invoke mutations through MCP or add `--confirm-mutation` to CLI `invoke` calls.
7. Read the affected resource again and report the verified result. Poll status endpoints when work is asynchronous.

Use `laserreach_invoke_site_tool` only when a canonical dynamic tool is unavailable in the host. Pass exactly the name and arguments returned by the live manifest.

## Recipient-safe LinkedIn messaging

Treat profile identity and conversation identity as separate facts. A profile URL is not a chat ID.

For a message to a named LinkedIn recipient:

1. Resolve the intended person with the exact LinkedIn URL or provider ID.
2. Select the sender `account_id` explicitly when more than one account is connected.
3. Find the existing conversation with `linkedin_find_chat`; request additional pages when necessary.
4. Read `linkedin_chat_messages` and confirm the participant identity and prior thread context.
5. Call `laserreach_send_linkedin_message` first with `dry_run: true`, `require_existing_chat: true`, the profile URL/provider ID, and the selected account.
6. Compare the returned resolved recipient and chat with the intended person.
7. After explicit authorization, repeat with `dry_run: false`.
8. Read the conversation again to verify that the message appears in the correct old thread.

Never send using a bare `chat_id` supplied from memory, search order, or a different contact record. Stop if the profile, provider ID, chat participants, or sender account disagree.

## Automatic local replies

Use a token created with the **Automatic local LinkedIn replies** preset, then run:

```bash
npx -y github:tcmartin/laserreach-local-agent-mcp replies --engine codex
```

The reply daemon may only process admitted inbound-reply jobs under the organization's policy and daily limit. Do not replace it with a generic send loop.

## Safety rules

- Follow token scopes and organization policy even if the user asks for an unavailable action.
- Default to reads and dry runs when recipient identity, audience, content, or side effects are uncertain.
- Keep audience filters and limits explicit for bulk operations.
- Never claim a send, launch, publish, sync, or deletion succeeded without reading the returned status or affected resource.
- Revoke a token from Laserreach immediately if it may have been exposed.
