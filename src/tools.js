import { z } from "zod";

function jsonText(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function errText(error) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: error.message,
            status: error.status,
            body: error.body,
          },
          null,
          2,
        ),
      },
    ],
  };
}

async function wrap(fn) {
  try {
    return jsonText(await fn());
  } catch (error) {
    return errText(error);
  }
}

function literalUnion(values) {
  const literals = [...new Set(values || [])].map((value) => z.literal(value));
  if (literals.length === 0) return z.any();
  if (literals.length === 1) return literals[0];
  return z.union(literals);
}

export function jsonSchemaToZod(schema = {}) {
  if (!schema || typeof schema !== "object") return z.any();
  if (Object.hasOwn(schema, "const")) return z.literal(schema.const);
  if (Array.isArray(schema.enum)) return literalUnion(schema.enum);
  const alternatives = schema.anyOf || schema.oneOf;
  if (Array.isArray(alternatives) && alternatives.length > 0) {
    const members = alternatives.map((entry) => jsonSchemaToZod(entry));
    return members.length === 1 ? members[0] : z.union(members);
  }
  const declaredTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
  const nullable = declaredTypes.includes("null") || schema.nullable === true;
  const type = declaredTypes.find((value) => value && value !== "null");
  let result;
  if (type === "object" || schema.properties) {
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    const shape = {};
    for (const [name, propertySchema] of Object.entries(schema.properties || {})) {
      const field = jsonSchemaToZod(propertySchema);
      shape[name] = required.has(name) ? field : field.optional();
    }
    result = z.object(shape);
    if (schema.additionalProperties !== false) result = result.passthrough();
  } else if (type === "array") {
    result = z.array(jsonSchemaToZod(schema.items || {}));
    if (Number.isInteger(schema.minItems)) result = result.min(schema.minItems);
    if (Number.isInteger(schema.maxItems)) result = result.max(schema.maxItems);
  } else if (type === "integer") {
    result = z.number().int();
  } else if (type === "number") {
    result = z.number();
  } else if (type === "boolean") {
    result = z.boolean();
  } else if (type === "string") {
    result = z.string();
    if (Number.isInteger(schema.minLength)) result = result.min(schema.minLength);
    if (Number.isInteger(schema.maxLength)) result = result.max(schema.maxLength);
    if (typeof schema.pattern === "string" && schema.pattern) {
      result = result.regex(new RegExp(schema.pattern));
    }
  } else {
    result = z.any();
  }
  if ((type === "integer" || type === "number") && typeof schema.minimum === "number") {
    result = result.min(schema.minimum);
  }
  if ((type === "integer" || type === "number") && typeof schema.maximum === "number") {
    result = result.max(schema.maximum);
  }
  return nullable ? result.nullable() : result;
}

export function registerSiteParityTools(server, client, manifest = {}) {
  const rows = Array.isArray(manifest.tools) ? manifest.tools : [];
  const registered = [];
  const seen = new Set();
  for (const row of rows) {
    const fn = row && typeof row === "object" ? row.function : null;
    const name = String(fn?.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const access = row["x-laserreach-access"] || {};
    const mutation = String(access.mutation || "write");
    server.registerTool(
      name,
      {
        title: name,
        description: [
          String(fn.description || name),
          `LaserReach site-tool parity; mutation=${mutation}; required scopes=${(access.required_scopes || []).join(",") || "none"}.`,
        ].join(" "),
        inputSchema: jsonSchemaToZod(fn.parameters || { type: "object", properties: {} }),
        annotations: {
          readOnlyHint: mutation === "read",
          destructiveHint: ["outbound", "publish", "runtime_shell"].includes(mutation),
          idempotentHint: mutation === "read",
        },
        _meta: {
          "laserreach/registryVersion": manifest.registry_version,
          "laserreach/access": access,
        },
      },
      async (args) => wrap(() => client.invokeSiteTool(name, args || {})),
    );
    registered.push(name);
  }
  return registered;
}

export function registerLaserreachTools(server, client) {
  server.registerTool(
    "laserreach_capabilities",
    {
      title: "Get Laserreach capabilities",
      description: "Fetch the live Laserreach capability catalog for this external-agent token.",
      inputSchema: {},
    },
    async () => wrap(() => client.capabilities()),
  );

  server.registerTool(
    "laserreach_site_tools_manifest",
    {
      title: "Get site-agent tool manifest",
      description: "Refresh the authoritative, token-scoped website-agent tool registry and policy decisions.",
      inputSchema: {
        include_instructions: z.boolean().default(false),
      },
    },
    async ({ include_instructions }) => wrap(
      () => client.siteTools({ includeInstructions: include_instructions }),
    ),
  );

  server.registerTool(
    "laserreach_list_sources",
    {
      title: "List Laserreach sources",
      description: "List configured Laserreach signal sources.",
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) => wrap(() => client.listSources(args)),
  );

  server.registerTool(
    "laserreach_collect_source",
    {
      title: "Collect source",
      description: "Collect raw signals without invoking LaserReach-hosted scoring. Assess the returned signals with the local agent.",
      inputSchema: {
        source_id: z.string().min(1),
        options: z.record(z.any()).optional(),
      },
    },
    async ({ source_id, options = {} }) => wrap(() => client.collectSource(source_id, options)),
  );

  server.registerTool(
    "laserreach_list_signals",
    {
      title: "List Laserreach signals",
      description: "List buyer signals. Defaults to ICP-matched, scored signals; choose raw only when broad collection data is needed.",
      inputSchema: {
        status: z.string().optional(),
        source_id: z.string().optional(),
        signal_type: z.string().optional(),
        quality: z.enum(["actionable", "raw"]).default("actionable"),
        min_score: z.number().min(0).max(1).optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
    },
    async ({ quality, ...args }) => wrap(() => client.listSignals({
      ...args,
      ...(quality === "actionable" ? {
        require_icp_match: true,
        min_score: args.min_score ?? 0.5,
      } : {}),
    })),
  );

  server.registerTool(
    "laserreach_assess_signal",
    {
      title: "Store local signal assessment",
      description: "Save fit and intent scores produced by this local agent. This does not call a Laserreach-hosted model.",
      inputSchema: {
        signal_id: z.string().min(1),
        intent_score: z.number().min(0).max(1),
        relevance_score: z.number().min(0).max(1),
        icp_match: z.boolean(),
        matched_icp_id: z.string().optional(),
        matched_icp_name: z.string().optional(),
        stage_classification: z.string().optional(),
        reasoning: z.string().min(1).max(2000),
      },
    },
    async ({ signal_id, ...body }) => wrap(() => client.assessSignal(signal_id, body)),
  );

  server.registerTool(
    "laserreach_resolve_signal_contact",
    {
      title: "Attach signal contact",
      description: "Attach an existing same-company Laserreach person to a signal, including job-posting signals.",
      inputSchema: {
        signal_id: z.string().min(1),
        person_id: z.string().min(1),
      },
    },
    async ({ signal_id, person_id }) => wrap(
      () => client.resolveSignalContact(signal_id, person_id),
    ),
  );

  server.registerTool(
    "laserreach_list_icps",
    {
      title: "List ICPs",
      description: "List Laserreach ICP definitions and their current status.",
      inputSchema: {
        status: z.enum(["active", "inactive", "draft"]).optional(),
      },
    },
    async (args) => wrap(() => client.listIcps(args)),
  );

  server.registerTool(
    "laserreach_manage_icp",
    {
      title: "Manage ICP",
      description: "Create, update, or delete a Laserreach ICP. For create, include the complete ICP definition.",
      inputSchema: {
        action: z.enum(["create", "update", "delete"]),
        icp_id: z.string().optional(),
        icp: z.record(z.any()).optional(),
      },
    },
    async ({ action, icp_id, icp = {} }) => wrap(() => {
      if (action === "create") return client.createIcp(icp);
      if (!icp_id) throw new Error("icp_id is required for update or delete");
      if (action === "delete") return client.deleteIcp(icp_id);
      return client.updateIcp(icp_id, icp);
    }),
  );

  server.registerTool(
    "laserreach_refresh_icps",
    {
      title: "Refresh ICP scoring",
      description: "Reapply deterministic ICP rules without using a Laserreach-hosted model.",
      inputSchema: {
        icp_id: z.string().optional(),
        limit: z.number().int().positive().max(500).default(500),
      },
    },
    async ({ icp_id = "", limit }) => wrap(
      () => client.refreshIcps({ limit }, icp_id),
    ),
  );

  server.registerTool(
    "laserreach_approve_signal",
    {
      title: "Approve signal",
      description: "Approve a Laserreach signal.",
      inputSchema: {
        signal_id: z.string().min(1),
        note: z.string().optional(),
      },
    },
    async ({ signal_id, ...body }) => wrap(() => client.approveSignal(signal_id, body)),
  );

  server.registerTool(
    "laserreach_dismiss_signal",
    {
      title: "Dismiss signal",
      description: "Dismiss a Laserreach signal.",
      inputSchema: {
        signal_id: z.string().min(1),
        reason: z.string().optional(),
      },
    },
    async ({ signal_id, ...body }) => wrap(() => client.dismissSignal(signal_id, body)),
  );

  server.registerTool(
    "laserreach_list_targets",
    {
      title: "List targets",
      description: "List Laserreach companies or people.",
      inputSchema: {
        kind: z.enum(["companies", "people"]).default("companies"),
        q: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ kind, ...query }) => wrap(() => client.listTargets(kind, query)),
  );

  server.registerTool(
    "laserreach_list_senders",
    {
      title: "List senders",
      description: "List connected LinkedIn or email senders.",
      inputSchema: {
        kind: z.enum(["all", "linkedin", "email"]).default("all"),
      },
    },
    async ({ kind }) => wrap(() => client.listSenders(kind)),
  );

  server.registerTool(
    "laserreach_sync_hubspot_outreach",
    {
      title: "Sync outreach to HubSpot",
      description: "Log local-agent outreach activity to HubSpot through Laserreach. Start with dry_run=true during setup.",
      inputSchema: {
        dry_run: z.boolean().optional(),
        event_id: z.string().optional(),
        pipeline_id: z.string().optional(),
        sequence_id: z.string().optional(),
        campaign_id: z.string().optional(),
        signal_id: z.string().optional(),
        person_id: z.string().optional(),
        company_id: z.string().optional(),
        channel: z.enum(["email", "linkedin", "phone", "other"]).optional(),
        message: z.string().optional(),
        contact_name: z.string().optional(),
        contact_email: z.string().optional(),
        contact_title: z.string().optional(),
        company_name: z.string().optional(),
        company_domain: z.string().optional(),
        company_website: z.string().optional(),
        deal_name: z.string().optional(),
        note_body: z.string().optional(),
      },
    },
    async (body) => wrap(() => client.syncHubspotOutreach(body)),
  );

  server.registerTool(
    "laserreach_create_local_sequence",
    {
      title: "Create sequence from local copy",
      description: "Create a sequence from copy generated by this local agent. Every step is stored with use_ai=false, so LaserReach does not invoke a hosted model.",
      inputSchema: {
        name: z.string().min(1),
        steps: z.array(z.object({
          type: z.enum(["li_connect", "await_accept", "li_message", "email", "wait"]),
          delay_minutes: z.number().int().nonnegative().optional(),
          message: z.string().optional(),
          subject: z.string().optional(),
          email_sender: z.any().optional(),
          smtp_server: z.string().optional(),
        })).min(1),
        target_criteria: z.record(z.any()).optional(),
        auto_trigger: z.boolean().optional(),
      },
    },
    async (body) => wrap(() => client.createLocalSequence(body)),
  );

  server.registerTool(
    "laserreach_start_sequence",
    {
      title: "Start sequence",
      description: "Start an existing sequence using customer-local copy. Requires outreach:send. Self-governed tokens skip human approval while Laserreach retains caps and execution controls. Never starts a hosted agent run.",
      inputSchema: {
        sequence_id: z.string().min(1),
        confirm_outbound: z.literal(true),
        options: z.record(z.any()).optional(),
      },
    },
    async ({ sequence_id, options = {} }) => wrap(
      () => client.startSequence(sequence_id, options),
    ),
  );

  server.registerTool(
    "laserreach_launch_campaign_segment",
    {
      title: "Launch campaign segment",
      description: "Queue a sequence for a selected segment. Requires outreach:send. Account caps and execution controls remain enforced.",
      inputSchema: {
        sequence_id: z.string().min(1),
        linkedin_account: z.string().min(1),
        company_ids: z.array(z.string()).optional(),
        icp_id: z.string().optional(),
        require_icp_match: z.boolean().optional(),
        min_intent_score: z.number().min(0).max(1).optional(),
        max_intent_score: z.number().min(0).max(1).optional(),
        role_tags: z.array(z.string()).optional(),
        limit_companies: z.number().int().positive().optional(),
        limit_people_per_company: z.number().int().positive().optional(),
        max_people: z.number().int().positive().optional(),
        skip_enrichment: z.boolean().optional(),
        dry_run: z.boolean().optional(),
        options: z.record(z.any()).optional(),
      },
    },
    async ({
      sequence_id,
      linkedin_account,
      options = {},
      ...criteria
    }) => wrap(() => client.launchCampaignSegment({
      ...options,
      ...criteria,
      sequence_id,
      linkedin_account,
    })),
  );

  server.registerTool(
    "laserreach_send_pipeline_message",
    {
      title: "Send LinkedIn pipeline message",
      description: "Send a direct LinkedIn message from an existing pipeline. Requires outreach:send and an active sender. The token actor is recorded in Laserreach audit logs.",
      inputSchema: {
        pipeline_id: z.string().min(1),
        text: z.string().min(1),
        confirm_outbound: z.literal(true),
      },
    },
    async ({ pipeline_id, text }) => wrap(
      () => client.sendPipelineMessage(pipeline_id, text),
    ),
  );

  server.registerTool(
    "laserreach_send_linkedin_message",
    {
      title: "Send recipient-bound LinkedIn message",
      description: "Resolve one LinkedIn recipient, find their exact existing conversation across all inbox pages, and send only to that verified chat. Requires outreach:send. Set require_existing_chat=true when the user asks for an old conversation. A mismatched chat_id is always rejected.",
      inputSchema: {
        text: z.string().min(1),
        confirm_outbound: z.literal(true),
        linkedin_url: z.string().url().optional(),
        recipient_provider_id: z.string().min(1).optional(),
        provider_id: z.string().min(1).optional(),
        person_id: z.string().min(1).optional(),
        chat_id: z.string().min(1).optional(),
        account_id: z.string().min(1).optional(),
        require_existing_chat: z.boolean().default(true),
        dry_run: z.boolean().optional(),
        inmail: z.boolean().optional(),
      },
    },
    async ({ confirm_outbound: _confirm, ...body }) => {
      if (!body.linkedin_url && !body.recipient_provider_id && !body.provider_id && !body.person_id) {
        throw new Error("linkedin_url, recipient_provider_id, provider_id, or person_id is required");
      }
      return wrap(() => client.sendLinkedinMessage(body));
    },
  );

  server.registerTool(
    "laserreach_publish_content",
    {
      title: "Publish content",
      description: "Publish a content calendar item through its configured connector. Requires content:publish. Self-governed tokens skip human approval while caps and connector checks remain enforced.",
      inputSchema: {
        calendar_item_id: z.string().min(1),
        connector: z.string().optional(),
        channel: z.string().optional(),
        dry_run: z.boolean().optional(),
        options: z.record(z.any()).optional(),
      },
    },
    async ({
      calendar_item_id,
      connector,
      channel,
      dry_run,
      options = {},
    }) => wrap(() => client.publishContent({
      ...options,
      calendar_item_id,
      ...(connector ? { connector } : {}),
      ...(channel ? { channel } : {}),
      ...(dry_run !== undefined ? { dry_run } : {}),
    })),
  );

  server.registerTool(
    "laserreach_send_newsletter",
    {
      title: "Send account newsletter",
      description: "Send an existing newsletter by email or Slack. Requires outreach:send. Sender and connector checks remain enforced.",
      inputSchema: {
        newsletter_id: z.string().min(1),
        channel: z.enum(["email", "slack"]).optional(),
        recipients: z.array(z.string()).optional(),
        subject: z.string().optional(),
        body: z.string().optional(),
        options: z.record(z.any()).optional(),
        confirm_outbound: z.literal(true),
      },
    },
    async ({
      newsletter_id,
      channel,
      recipients,
      subject,
      body,
      options = {},
    }) => wrap(() => client.sendNewsletter(newsletter_id, {
      ...options,
      ...(channel ? { channel } : {}),
      ...(recipients ? { recipients } : {}),
      ...(subject ? { subject } : {}),
      ...(body ? { body } : {}),
    })),
  );

  server.registerTool(
    "laserreach_revoke_self",
    {
      title: "Revoke this agent token",
      description: "Immediate kill switch for the currently configured token. The token cannot be used after this succeeds.",
      inputSchema: {
        confirm: z.literal("REVOKE"),
      },
    },
    async () => wrap(() => client.revokeSelf()),
  );

  server.registerTool(
    "laserreach_request",
    {
      title: "Generic Laserreach request",
      description: "Advanced scoped request. Do not mutate /api/abm/agent-runs or call endpoints requiring hosted-ai:use unless the user explicitly requests it.",
      inputSchema: {
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
        path: z.string().min(1),
        query: z.record(z.any()).optional(),
        body: z.any().optional(),
      },
    },
    async (args) => wrap(() => client.request(args)),
  );
}
