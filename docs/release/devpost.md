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
- Install link: [CodeSentinel install link](https://developer.atlassian.com/console/install/2b37e8b5-d95c-4b0f-9141-98ee30b14cde?signature=AYABeASxd2JovLx5eUyq1bJv93kAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB5TKoVd%2FBvRr%2FVzMw1LSa4QAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDMUbpAJEJgwTvzYUQQIBEIA76FrfVL8HjDcHaoUmVE1boRrlAG40LGKmHhDntzkPhMv7wMYXw8NDy3NP4z4%2BX9n0lfOt2xZlusPpcxQAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFVX6Fe%2F4faED75nJJ5TiG%2BAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMP8uPmOq437A5DmkeAgEQgDsDzpMbo1bP0kK2FLV6cGHekSsVo6iFyJ8R3SD4LiPKtmW5Jsl%2FG%2FRuMg9kB32by7%2Ft8DPqQ5sI3DK1AgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAddaiAbZqbObzWZdGxe0%2BbEAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwRg%2FW7%2FCrJgpcsshMCARCAO%2F00d3Csyv2kGUH%2FDKQtE83HPzW%2BwibGHwAiN1YL2nOc%2FwwK5Mr4Je1kk7r%2B6F2vWyozqsXN662DJgtFAgAAAAAMAAAQAAAAAAAAAAAAAAAAAEbrx85bkSK9GzFa40dJkyj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKspSA%2Fgna4RrufBmfQpO%2BWkMYZB%2Ftzfnnguh%2BOlcVzU3264G5SiBcKHXj7hwkfxwm9aW3HhBfDrDHGkQscoJGTX7M%3D&product=jira)
- Marketplace review ticket: _after submission_
- Video: _YouTube link_
