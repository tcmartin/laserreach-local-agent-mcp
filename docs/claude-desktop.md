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
        "LASERREACH_AGENT_TOKEN": "<external_agent_token>"
      }
    }
  }
}
```

4. Restart Claude Desktop.

5. Ask Claude:

```text
Call laserreach_capabilities and summarize the local-agent route groups. Do not use Laserreach-hosted run control.
```

Keep `agent-runs:control` off unless the user intentionally wants Claude to control Laserreach-hosted runs.
