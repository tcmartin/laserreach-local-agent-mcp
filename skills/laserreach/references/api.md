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

## LinkedIn enrollment preflight

When the deployment exposes it, `GET /api/abm/linkedin/preflight` accepts
`account_id`, `person_id`, `linkedin_url`, and `recipient_provider_id` as query
parameters. Supply all four exact identifiers. Use the authentication headers
above; discover a matching named tool first, otherwise use this direct REST read.
This read neither sends nor enrolls a recipient.

`include_pending_invitations=true` requests a bounded read of sent and received
pending invitations. Omit it when fresh cached evidence already answers that
question. A missing invitation is known absent only when both inventories are
exhausted. Provider errors, malformed results, pagination caps, and incomplete
inventories mean unknown, not permission to connect. Historical invitation
outcomes are not a complete prior-contact audit.

Inspect identity, relationship, manual-contact, suppression, and `connection_action`
separately. A confirmed existing connection can skip the invitation. The response
deliberately retains `clear_for_enrollment=false`: duplicate outreach, prior
conversations, sender policy, authorization, and scheduling remain separate checks.
Do not equate `checked_gates_passed=true` with authorization to launch. Fail closed
if required evidence is unknown or identifiers disagree. Cache the evidence and
observation time instead of repeating provider reads during the same review.

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
