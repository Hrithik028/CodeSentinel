# MCP tools

## Rovo MCP module

The `rovo:mcp` module `codesentinel-mcp` (name "CodeSentinel MCP") exposes the `get-security-posture` and `list-open-findings` actions as tools. Customers add them to their own agents in Rovo Studio or connect them to MCP-compatible clients through the Rovo MCP server. They use the same functions and per-user project filtering as the Rovo agent.

## Web trigger MCP server

CodeSentinel exposes a minimal [Model Context Protocol](https://modelcontextprotocol.io) server over the Forge web trigger `mcp-trigger` (function `mcp-fn`). It speaks JSON-RPC 2.0 over HTTP POST (Streamable HTTP transport, JSON responses only, no SSE).

## Endpoint and auth

- URL: the `mcp-trigger` web trigger URL, shown on the CodeSentinel project page (or `forge webtrigger` for the installation).
- Header: `Authorization: Bearer <MCP token>`; the token is generated once on the config page and stored only as a hash (`config:mcp`).
- Errors: `401` for a missing/invalid token, `405` for non-POST, JSON-RPC `-32700` parse error, `-32600` invalid request, `-32601` unknown method, `-32602` invalid params.

## Methods

| Method | Result |
| --- | --- |
| `initialize` | `{ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "codesentinel", version } }` |
| `notifications/initialized` | HTTP 202, no body |
| `ping` | `{}` |
| `tools/list` | The two tools below |
| `tools/call` | `{ content: [{ type: "text", text: "<JSON>" }], structuredContent: {…} }` |

## Tools

### `get_security_posture`

Input: `{ "projectKey": "SEC" }` (optional; omitted → every linked project).

Output (`structuredContent`):

```json
{
  "projects": [
    {
      "projectKey": "SEC",
      "repoUrl": "https://github.com/Hrithik028/codesentinel-demo",
      "score": 25, "grade": "F",
      "severityCounts": { "critical": 1, "high": 4, "medium": 3, "low": 0 },
      "openIssues": 5,
      "source": "ci", "scannedAt": "2026-11-20T12:00:00.000Z",
      "delta": { "scoreDelta": 0, "newFindings": 8, "fixedFindings": 0 }
    }
  ]
}
```

### `list_open_findings`

Input: `{ "projectKey": "SEC", "severity": "critical" | "high" | "medium" | "low", "limit": 20 }` (all optional; `limit` 1–100, default 20).

Output: `{ "findings": [{ ruleId, title, severity, file, line, excerpt, issueKey, projectKey }] }`. Excerpts are the scanner's redacted excerpts; no other file content is ever returned.

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP · URL: <mcp-trigger URL>
# Header: Authorization: Bearer <MCP token>
# Connect → Tools → List Tools → get_security_posture → Run
```

Curl equivalent:

```bash
curl -s "$MCP_URL" -H "Authorization: Bearer $MCP_TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_open_findings","arguments":{"severity":"critical"}}}'
```
