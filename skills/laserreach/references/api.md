# Laserreach external-agent API reference

## Authentication

Every direct request uses the user's external-agent token and organization ID:

```http
Authorization: Bearer <external-agent-token>
X-Org-ID: <organization-id>
Accept: application/json
```

The default API base is `https://api.laserreach.com`.

## Discovery

- `GET /api/abm/agent/capabilities` returns the supported API groups, safety constraints, and public client distribution metadata.
- `GET /api/abm/agent/tools` returns the current token-filtered site tool catalog and JSON schemas.
- `POST /api/abm/agent/tools/{tool_name}/invoke` invokes a catalog tool with `{"arguments": {...}}`.

The helper exposes the same flow:

```bash
laserreach-local-agent capabilities
laserreach-local-agent tools --filter linkedin --schemas
laserreach-local-agent invoke linkedin_find_chat '{"account_id":"...","recipient_provider_id":"..."}'
laserreach-local-agent invoke <mutating-tool> '{...}' --confirm-mutation
```

Mutation access is declared in each tool's `x-laserreach-access` field. The CLI rejects mutation invocations unless `--confirm-mutation` is present.

## Recipient-bound LinkedIn send

The MCP convenience tool `laserreach_send_linkedin_message` and REST endpoint `POST /api/abm/linkedin/messages/send` support these identity guards:

- `account_id`: connected LinkedIn sender account.
- `linkedin_url`: intended recipient profile URL.
- `recipient_provider_id`: intended recipient provider ID.
- `chat_id`: optional existing conversation ID, verified against recipient identity.
- `require_existing_chat`: require the old conversation instead of starting a new one.
- `dry_run`: resolve and validate without sending.
- `text`: message body.

Use at least one stable recipient identifier. Prefer both the profile URL and provider ID when known. Always dry-run and inspect the resolved recipient before a real send.

## Errors

- `401`: missing, invalid, expired, or revoked token.
- `403`: organization mismatch, missing scope, or policy denial.
- `404`: resource or tool is unavailable to the token.
- `409`: identity, conversation, state, or idempotency conflict.
- `429`: organization or provider rate limit.

Do not work around an authorization or identity error by switching to a less-specific endpoint.
