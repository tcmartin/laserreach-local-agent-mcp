# Claude Desktop Setup

1. Install the helper:

```bash
npm install -g github:tcmartin/laserreach-local-agent-mcp
```

2. Create a Laserreach external-agent token from **Settings > External Agents**.

3. Add this to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "laserreach": {
      "command": "npx",
      "args": ["-y", "github:tcmartin/laserreach-local-agent-mcp", "mcp"],
      "env": {
        "LASERREACH_API_BASE": "https://api.laserreach.com",
        "LASERREACH_ORG_ID": "<org_id>",
        "LASERREACH_AGENT_TOKEN": "<external_agent_token>",
        "LASERREACH_MCP_TOOL_MODE": "compact"
      }
    }
  }
}
```

The server negotiates the MCP 2026-07-28 protocol and remains compatible with
2025-era clients. Compact mode is recommended: it keeps stable convenience
tools visible and discovers uncommon site tools on demand instead of placing
the entire live catalog in every context.

Use `"LASERREACH_MCP_TOOL_MODE": "full"` only when a client requires every
canonical site tool to be registered as a top-level MCP tool.

4. Restart Claude Desktop.

5. Ask Claude:

```text
Call laserreach_capabilities and summarize the local-agent route groups. Search
for uncommon tools with laserreach_search_site_tools, then invoke an exact match
with laserreach_invoke_site_tool. Use the ICP, signal-assessment, and
contact-resolution convenience tools for local reasoning. Do not use
Laserreach-hosted run control.
```

Keep `agent-runs:control` off unless the user intentionally wants Claude to
control Laserreach-hosted runs.
