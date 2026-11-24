# ADR 0004: Bonus scope — Marketplace, Rovo, Atlassian MCP; no Teamwork Graph

- Status: Accepted
- Date: 2026-11-20
- Issues: CS-7, CS-8

## Decision

| Bonus | In scope | Delivered by |
| --- | --- | --- |
| Marketplace | Yes | Listing submitted early; the review ticket link is enough for judging |
| Rovo agent | Yes | `rovo:agent` "CodeSentinel Security Analyst" with actions `getSecurityPosture` and `listOpenFindings` |
| Atlassian MCP | Yes | `rovo:mcp` module `codesentinel-mcp` exposing the two Rovo actions as tools for Rovo Studio agents and MCP clients; plus the `mcp-trigger` web trigger with JSON-RPC `initialize`, `tools/list` and `tools/call`, exposing `get_security_posture` and `list_open_findings` |
| Teamwork Graph | **No** | — |

## Why not Teamwork Graph

- **Data model mismatch:** our data is per-finding security state keyed by fingerprint. Jira issues already hold the relationships we need (project, labels, status). A connector would mirror Jira data instead of adding new edges.
- **Scope and risk:** connector registration, object schemas and permission mapping add a third data surface, with its own privacy review. In a time-boxed hackathon that time comes out of hardening ingestion and the judge path.
- **Security posture:** pushing findings into a broader graph, even redacted ones, widens who can see vulnerability details. That conflicts with the least-exposure model in ADR 0003.
- **Judging:** three solid, demoable bonuses are worth more than four shallow ones.

## Consequences

- Rovo and MCP read the same storage (`scan:{projectKey}:latest` and `fp:` records). They add no new data paths.
- Teamwork Graph stays an explicit non-goal. Revisit it only if CodeSentinel later stores cross-tool relationships, such as finding ↔ PR ↔ deploy ↔ incident.
