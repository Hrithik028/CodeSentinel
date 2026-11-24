# Devpost submission text (CS-8)

Copy each section into the matching Devpost field.

## Project name

CodeSentinel: security findings as tracked Jira work

## Tagline

Scan GitHub repos for secrets and unsafe code, and get exactly one Jira issue per real finding, closed automatically when it's fixed.

## Category and bonus prizes

- Category: **Apps for Software Teams**
- Bonus prizes: **Best Agents (Rovo)**, **Best app with Atlassian MCP**, **Best Marketplace published app**

## Inspiration

Security scanners produce reports that nobody triages. Teams work from tickets. We wanted scanner output to land where the work already happens, without duplicates and without a backend to run.

## What it does

- Links a GitHub repository to a Jira project from the **CodeSentinel** project page.
- Two ingestion paths into one pipeline:
  - **CI push:** a GitHub Actions job runs the dependency-free CodeSentinel CLI (`--json`) and POSTs the report to a token-protected Forge web trigger.
  - **App scan:** the app reads the repo through the GitHub REST API with a read-only PAT, on **Scan now** and hourly, in resumable chunks.
- Every `critical`/`high` finding becomes **one** Jira issue with location, redacted excerpt, remediation and a fingerprint. Rescans skip known findings; fixed findings get a comment and move to Done.
- A **dashboard gadget** shows score, grade, severity counts, the delta since the previous scan and a findings table linked to issues.
- **Rovo agent** "CodeSentinel Security Analyst" answers posture questions with the `get-security-posture` and `list-open-findings` actions.
- **Rovo MCP:** the `rovo:mcp` module `codesentinel-mcp` exposes the same actions as tools for Rovo Studio agents and MCP clients. A token-protected JSON-RPC MCP web trigger also works with MCP Inspector.
- **Suggest fix** (opt-in) posts an advisory LLM comment built only from rule metadata and the redacted one-line excerpt.

## How we built it

- Forge modules: `webtrigger` (ingest, MCP), `jira:projectPage`, `jira:dashboardGadget`, `jira:issueAction`, `scheduledTrigger`, `consumer` (queue), `action`, `rovo:agent`, `rovo:mcp`. Custom UI in React.
- A pure core (`diffReports`, `buildIssuePayload`, `summarizeDelta`) is shared, byte-for-byte, between the CLI and the Forge app, so CI and app scans produce identical fingerprints (ADR 0001, 0002).
- State lives in Forge KVS; PATs in Forge secret storage; scan and MCP tokens only as SHA-256 hashes (ADR 0003).
- Long scans exceed the Forge invocation budget, so they run through `@forge/events` with a checkpoint.

## Challenges

- Idempotency across two ingestion paths and line shifts (fingerprints include the line; documented trade-off in ADR 0002).
- Keeping secrets out of logs and storage while still letting CI authenticate.
- Forge runtime details: ESM import of the CommonJS resolver, admin checks on new projects.

## Accomplishments

- Live on Jira: first scan created 5 issues (score 25, F); rescan created 0; fixing a secret resolved its issue automatically.
- Negative paths verified on the live web trigger: 405, 401, 413, 400, 404.

## What we learned

Rovo actions are a clean way to make app data conversational. Exposing the same actions through `rovo:mcp` gave us MCP support without new data paths.

## What's next

Per-project storage for repo links, PR comments for new findings, and more rules.

## Technical explanation (main technology requirement)

CodeSentinel is a Forge app (`forge/manifest.yml`) that integrates with **Jira** (issues, project page, dashboard gadget, issue action) and **Rovo** (`rovo:agent`, `action`, `rovo:mcp`). It runs entirely on Forge: web triggers for CI ingestion and MCP, a scheduled trigger and an async queue for app-side scans, and Forge storage for state. No external backend.

## Links

- Source: https://github.com/Hrithik028/CodeSentinel
- Demo repo: https://github.com/Hrithik028/codesentinel-demo
- Judge setup: https://github.com/Hrithik028/CodeSentinel/blob/main/docs/judge-setup.md
- Install link: _from Distribution page_
- Marketplace review ticket: _after submission_
- Video: _YouTube link_
