# External-agent GTM playbook

Use this reference when the user asks to build or operate an acquisition program. The external agent owns research, prioritization, writing, and interpretation. Laserreach stores and executes the validated work through deterministic API/MCP operations. Do not delegate this workflow to the hosted ABM agent or internal AI writer. Persist exact copy with `use_ai=false` and verify readback.

## Establish the commercial brief

Record the buyer, problem, verified product capabilities, offer, price/terms, proof, conversion action, and revenue objective. Separate hypotheses from customer evidence. Prioritize segments by fit, buying-role access, current problem evidence, plausible deal value, and sales cycle. Distinguish multi-seat, reseller, individual-seat, and managed-service offers where applicable; choose one primary offer per first message. Do not import another customer's pricing or claimed outcomes.

Validate problem hypotheses with questions about recent behavior: what happened last time, who handled it, what failed, what it cost, and what they tried. Production artifacts demonstrate capability; they do not prove paid adoption or business outcomes.

## Research and qualify

Read replies and active conversations first. Then review direct engagement and referrals, current company signals, and qualified cold prospects. Use first-party company websites, careers pages, product releases, partner directories, public procurement, and RSS as discovery sources. Inspect the company website before enrichment. Do not guess email patterns. Record published named business addresses, role addresses, and enrichment fallback separately.

Use bounded, cached LinkedIn reads. A reaction on another person's content is an engagement signal, not a warm relationship. Funding, hiring, and engagement justify research; they do not prove purchase intent. Formal procurement must follow its designated channel.

Each candidate needs current person/company/role evidence, source URL and observation time, a reason this person owns the problem, the selected offer, contact provenance, relationship state, and exclusions. Validate suppression, prior outreach, active conversations, manual ownership, exact recipient identity, and sender availability before enrollment. Do not duplicate email and LinkedIn first touches without an intentional coordinated plan.

## Write and enroll

Write complete recipient-specific copy from inspected evidence. Explain the relevant observation, a plausible consequence without pretending certainty, and a useful next step. Each follow-up should add information. Use a small question or relevant artifact before asking for a large commitment. Avoid invented familiarity, unsupported ROI, generic congratulations, and unverified claims.

### Outbound text-hygiene gate

Before persisting or sending any email, LinkedIn message, reply, or other recipient-facing outreach, run the configured deterministic Unicode provenance cleaner over the exact subject and body. Use artifact-only cleanup: invisible Unicode and covert carrier removal with space normalization, NFKC, aggressive homoglyph replacement, emoji-glue removal, bidi stripping, and statistical rewriting disabled. Never use a paraphrasing or model-backed watermark-removal pass for outreach.

Inspect before cleaning. If the output differs, retain the before/after hashes and a character-level diff. Reject the change when it alters a recipient or company name, URL, email address, number, claim, quotation, evidence citation, template field, opt-out text, postal address, or other compliance language. Persist a new copy version after an accepted change. Run the deterministic cleaner again after personalization or template rendering and verify the provider-bound text when that read is available.

Treat an unavailable cleaner, partial scan, or unexplained diff as a hard pre-send failure. A zero-change result is valid and should be recorded; do not rewrite clean copy merely to produce a change. This gate does not authorize removing disclosures or disguising authorship, and it does not replace `use_ai=false` or exact-copy readback.

Create a paused sequence/campaign, inspect every recipient and exact template, run available no-send validation, then launch within existing user authorization. Discover live schemas before calls. Verify campaigns, pipelines, actual scheduled times, sender assignment, and provider objects independently. A queued pipeline is not a sent message; provider acceptance is not verified delivery.

### Inbound reply ownership

When the customer selects a local external reply runner, that runner owns research and wording for email, LinkedIn, SMS, and WhatsApp. Disable hosted reply generation for each selected channel. Claim inbound work before prospecting, content, or new enrollment. The application may provide the verified webhook payload, deterministic context, policy gates, transport, and audit record; it must not call its hosted AI as a fallback when local admission or generation fails.

Before sending, reconcile exact identity, latest thread state, manual-contact markers, opt-outs, suppression, policy, and transport health. Re-read LinkedIn at the provider. For email and phone messaging, require immutable verified-webhook message and thread identifiers. Cancel work that is stale or already handled. Standard phone-message opt-out keywords never receive a reply. Escalate identity ambiguity, legal/payment disputes, abuse complaints, suspicious links or attachments, unverified pricing, and custom commitments. Otherwise, a customer may grant standing authority for truthful routine replies through the governed send route.

Book a meeting only after the recipient agrees to meet or offers specific times. Read the designated calendar's busy windows, create one invitation with the recipient and conference link, verify the event readback, and record the calendar event ID as attribution evidence. Do not create speculative prospect holds.

### LinkedIn acceptance

Use the selected account and exact provider recipient. Read the existing conversation before enrollment. For unconnected prospects use `li_connect -> await_accept -> li_message`, with `enforce_connection_gate=true`, acceptance-step `delay_minutes=0`, and first-message `delay_minutes=0` when prompt follow-up is requested. Skip the invitation only when the provider confirms an existing connection. Never bypass acceptance to send an unsolicited first sequence message.

Use the [recipient preflight read](api.md#linkedin-enrollment-preflight) when
available. It verifies selected gates, not complete enrollment eligibility.
Reconcile prior outreach, conversations, and sender policy separately. Preserve
unknown states and bounded-read evidence; do not interpret an incomplete
invitation inventory as permission to send another invitation.

Stage the full copy before connection outreach. Acceptance should release the first eligible message through the production webhook/worker. A daily research wake cannot guarantee same-hour delivery. Verify deployed acceptance handling and bounded fallback recovery before promising latency. Record acceptance observation, eligible due time, accepted message time, provider ID, and any business-hour, holiday, reply, or rate-limit deferral. Preserve manual stops and suppression. Read back the correct conversation to verify exact text and uniqueness after sending.

### Email cadence and capacity

Use the customer's authorized healthy capacity and actual mailbox caps. Follow-ups consume slots. Prioritize replies, due commitments, warm opportunities, strong researched prospects, then qualified cold first touches. Reallocate unsent lower-priority work when better opportunities arrive; preserve active conversations.

Sequence delays are relative to the preceding step. Absolute D0/D1/D3/D7/D14 requires deltas 0/1/2/4/7 days. Verify actual pipeline timestamps, recipient business hours, and holidays. Shift downstream work consistently when rescheduling; do not compress steps or exceed caps. Stop on reply, opt-out, hard bounce, complaint, disqualification, or suppression. Recheck reply state immediately before execution.

Maintain enough researched companies and validated contacts to fill the authorized schedule. Derive reservoir size from actual new-lead demand and follow-up load, not a universal quota. Record unused capacity and its reason. Never weaken recipient quality or exceed limits to fill a target.

### Deliverability evidence

Read event-level deliverability, fleet health, and incidents daily for every active sending workspace. Include attempts, provider-visible deliveries, bounces, deferrals, complaints, unsubscribes, replies, authentication failures, throttles, pauses, blacklist evidence, freshness, and per-domain/per-mailbox rows. Keep denominators explicit. Missing provider events mean telemetry is unavailable; they do not prove zero problems, successful delivery, or inbox placement. SMTP acceptance is `sent`, never `delivered`.

When nominal fleet capacity conflicts with the customer's authorized campaign limit or actual mailbox cap, use the lower verified value and log the mismatch. Never route around a sender-health, external-recipient, suppression, or compliance gate to fill a quota.

## Content and discussion

Build content from real buyer questions, research findings, product demonstrations, and useful artifacts. Adapt a single idea into platform-specific posts and video scripts; verify every numerical claim and demonstration. Record script, copy version, evidence, CTA, and publication approval. Publish only authorized content, then verify provider state.

For third-party discussions, read the post and existing replies before drafting. Add missing evidence, a useful counterexample, or a concrete diagnostic question. Avoid generic praise and disguised promotion. Keep platform and community rules current. Reddit communities differ; some exclude entire product categories. X automated replies require separate rule checks, including AI-bot approval requirements. Do not infer publication permission from a request to research a channel.

## Measurement and learning

Use immutable acquisition_touch_id, person/company IDs, campaign, sequence, offer, experiment, and copy version. Preserve source evidence and observation timestamps. Add UTM fields and touch IDs to permitted links; retain first and last touch. Link checkout/customer/subscription/invoice metadata where implemented. Distinguish verified metadata linkage, inferred email/domain matches, self-reported discovery, and influence. Attribution is not proof of exclusive causation.

Report attempts, accepted sends, provider-visible deliveries, bounces, unique human replies, positive replies, opt-outs, complaints, meetings, opportunities, customers, seats, cash, MRR, ARR, refunds, and churn. Keep unavailable metrics null. Separate tenants, actual sender domains, mailboxes, offers, channels, cohorts, and dates before rolling up. Show counts and denominators. Compare cohorts with compatible observation windows.

For content, track exposed impressions/views, meaningful replies, shares, clicks, conversations, and downstream revenue. For LinkedIn sequences, add invitation acceptance and acceptance-to-first-message latency. Optimize for qualified revenue and useful conversations, not activity counts.

Record each experiment's hypothesis, variable, comparison, metric, observation window, guardrail, and next decision. Change a bounded set of variables. Label small samples inconclusive; do not invent performance. Pause affected recipients or senders for actual adverse evidence and preserve healthy authorized work.

## Daily operation and recovery

Use a date marker and durable checkpoints per customer timezone. Reconcile conversations and stops before due sends, then capacity and new enrollment, then content and metrics. Later wakes resume incomplete stages. Keep fast acceptance handling separate from the daily research completion marker.

Record discovered companies, researched people, verified contacts, drafted messages, valid enrollments, scheduled steps, accepted sends, and deliveries as separate counts. A completed run needs evidence for each required stage or an explicit unresolved blocker. Never count an empty first page as an exhausted inventory: honor cursors and filter after retrieval where required.

After a timeout, inspect exact resource IDs and persisted state before retrying a mutation. Use idempotency where supported and serialize production mutations. Cache bounded provider reads. Record run ID, checkpoint, errors, attempted recovery, next action, and source-of-truth IDs. Keep credentials and private customer records out of shared playbooks.

A failed enrollment can leave a campaign without a persisted pipeline. Reconcile
the exact campaign and pipeline state before retrying; preserve or cancel the
failed shell through supported operations. A campaign target count is not proof
of a pipeline or a send. Fix serialization or scheduling errors at their source
rather than changing the requested acceptance cadence to bypass a failure.

### Reply-runner credential changes

Local reply jobs belong to a runner token, not just an organization. A replacement token with the same scopes does not inherit the old token's queued jobs. An empty successful queue read after a credential change is not proof that the organization has no unanswered messages.

Before replacing a reply-runner credential, compare the active token ID, the configured local runner ID, and the existing job ownership. Preserve the original credential securely until its admitted jobs are reconciled through supported operations. Owner-managed changes to the configured runner affect future inbound jobs; they do not migrate existing jobs. Revoking the configured token can disable local replies.

Discover the current API before recovery. When a governed policy-adoption/reassignment operation is available, call it from the newly selected external runner and verify that hosted generation is disabled for every selected channel. It may migrate only queued work and claims whose lease has expired; never steal an active lease or move terminal/unrelated jobs. If no authorized reassignment operation exists, do not manufacture new inbound jobs, edit database ownership, or bypass the governed send route. Record the ownership gap separately from missing scopes and unhandled conversations. Use the original valid runner for its jobs, or request an owner-supported migration. Adding local-reply scopes does not authorize hosted AI, change send limits, or override a holiday hold.
