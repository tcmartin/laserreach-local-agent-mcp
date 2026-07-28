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
      description: "Trigger collection for a Laserreach source.",
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
    "laserreach_start_sequence",
    {
      title: "Start governed sequence",
      description: "Start an existing sequence using customer-local copy. Requires outreach:send and Laserreach policy approval; never starts a hosted agent run.",
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
      description: "Advanced scoped request. Do not mutate /api/abm/agent-runs or call Laserreach model-backed signal processing unless the user explicitly requests it.",
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
