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
      description: "List current buyer signals. Use filters from capabilities when available.",
      inputSchema: {
        status: z.string().optional(),
        source_id: z.string().optional(),
        company_id: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) => wrap(() => client.listSignals(args)),
  );

  server.registerTool(
    "laserreach_score_pending_signals",
    {
      title: "Score pending signals",
      description: "Ask Laserreach to score pending signals. This uses Laserreach processing, not hosted agent runs.",
      inputSchema: {
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) => wrap(() => client.scorePendingSignals(args)),
  );

  server.registerTool(
    "laserreach_process_signals",
    {
      title: "Process signals",
      description: "Ask Laserreach to process queued signals.",
      inputSchema: {
        source_id: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) => wrap(() => client.processSignals(args)),
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
    "laserreach_prepare_messages",
    {
      title: "Prepare messages",
      description: "Prepare outreach messages for review. This stages work; sending still follows Laserreach scopes and policy.",
      inputSchema: {
        sequence_id: z.string().optional(),
        company_id: z.string().optional(),
        person_ids: z.array(z.string()).optional(),
        context: z.record(z.any()).optional(),
      },
    },
    async (body) => wrap(() => client.prepareMessages(body)),
  );

  server.registerTool(
    "laserreach_request",
    {
      title: "Generic Laserreach request",
      description: "Advanced scoped request. Avoid /api/abm/agent-runs mutation unless the user explicitly requests hosted run control and the token has agent-runs:control.",
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
