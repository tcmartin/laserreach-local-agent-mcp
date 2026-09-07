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

Create a paused sequence/campaign, inspect every recipient and exact template, run available no-send validation, then launch within existing user authorization. Discover live schemas before calls. Verify campaigns, pipelines, actual scheduled times, sender assignment, and provider objects independently. A queued pipeline is not a sent message; provider acceptance is not verified delivery.

### LinkedIn acceptance

Use the selected account and exact provider recipient. Read the existing conversation before enrollment. For unconnected prospects use `li_connect -> await_accept -> li_message`, with `enforce_connection_gate=true`, acceptance-step `delay_minutes=0`, and first-message `delay_minutes=0` when prompt follow-up is requested. Skip the invitation only when the provider confirms an existing connection. Never bypass acceptance to send an unsolicited first sequence message.

Stage the full copy before connection outreach. Acceptance should release the first eligible message through the production webhook/worker. A daily research wake cannot guarantee same-hour delivery. Verify deployed acceptance handling and bounded fallback recovery before promising latency. Record acceptance observation, eligible due time, accepted message time, provider ID, and any business-hour, holiday, reply, or rate-limit deferral. Preserve manual stops and suppression. Read back the correct conversation to verify exact text and uniqueness after sending.

### Email cadence and capacity

Use the customer's authorized healthy capacity and actual mailbox caps. Follow-ups consume slots. Prioritize replies, due commitments, warm opportunities, strong researched prospects, then qualified cold first touches. Reallocate unsent lower-priority work when better opportunities arrive; preserve active conversations.

Sequence delays are relative to the preceding step. Absolute D0/D1/D3/D7/D14 requires deltas 0/1/2/4/7 days. Verify actual pipeline timestamps, recipient business hours, and holidays. Shift downstream work consistently when rescheduling; do not compress steps or exceed caps. Stop on reply, opt-out, hard bounce, complaint, disqualification, or suppression. Recheck reply state immediately before execution.

Maintain enough researched companies and validated contacts to fill the authorized schedule. Derive reservoir size from actual new-lead demand and follow-up load, not a universal quota. Record unused capacity and its reason. Never weaken recipient quality or exceed limits to fill a target.

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

### Reply-runner credential changes

Local reply jobs belong to a runner token, not just an organization. A replacement token with the same scopes does not inherit the old token's queued jobs. An empty successful queue read after a credential change is not proof that the organization has no unanswered messages.

Before replacing a reply-runner credential, compare the active token ID, the configured local runner ID, and the existing job ownership. Preserve the original credential securely until its admitted jobs are reconciled through supported operations. Owner-managed changes to the configured runner affect future inbound jobs; they do not migrate existing jobs. Revoking the configured token can disable local replies.

Discover the current API before recovery. If it offers no authorized reassignment operation, do not manufacture new inbound jobs, edit database ownership, or bypass the governed send route. Record the ownership gap separately from missing scopes and unhandled conversations. Use the original valid runner for its jobs, or request an owner-supported migration. Adding local-reply scopes does not authorize hosted AI, change send limits, or override a holiday hold.
