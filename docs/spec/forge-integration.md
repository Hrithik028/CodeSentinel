# CodeSentinel × Forge — integration specification

Status: accepted for Codegeist 2026 · Category: **Apps for Software Teams** · Bonus tracks: **Marketplace**, **Rovo agent**, **Atlassian MCP** (no Teamwork Graph, see [ADR 0004](../adr/0004-bonus-scope.md)).

## Goal

Turn CodeSentinel findings into tracked Jira work. A team links a GitHub repository to a Jira project; every critical or high finding becomes exactly one Jira issue, fixed findings are transitioned to Done automatically, and the project's security posture is visible on a dashboard gadget, through Rovo, and through an MCP endpoint.

## Ingestion paths

| Path | Trigger | Who scans | Transport |
| --- | --- | --- | --- |
| **CI push** | `push` to the default branch (PRs and branches only upload the artifact) | GitHub Actions runs `node src/cli.js --json .` | `POST` report to the `ingest-trigger` web trigger with `X-Scan-Token` |
| **App scan** | Hourly scheduled trigger, or **Scan now** on the config page | The Forge app, via the GitHub REST API and a write-only PAT | In-app (`@forge/events` queue for long scans) |

Both paths produce a report in the `scanDirectory()` shape ([report schema](report-schema.md)) and hand it to the same `processReport()` pipeline, so Jira behaviour is identical regardless of source. `meta.source` is `ci` or `app` and is shown as a badge on the gadget.

## Pipeline (`forge/src/processReport.js`)

```text
processReport(report, repo, { source, commit })
  open   = fingerprint records where repoUrl == repo.repoUrl && status == 'open'
  diff   = diffReports(open, report)                       # src/ingest.js
  for f in diff.toCreate:   find existing open issue (fp:{f} record → JQL fallback)
                            else createIssue(buildIssuePayload(f)); setFingerprint(open)
  for fp in diff.toResolve: addComment("No longer detected …"); transitionToDone; setFingerprint(resolved)
  for f in diff.unchanged:  setFingerprint(lastSeenAt = now)
  setLatestScan(projectKey, trimmed report + delta + issue links)
  return { created, resolved, unchanged, errors[] }
```

Per-issue Jira failures are collected in `errors[]` and do not abort the run; a failed create leaves no `fp:` record, so the next scan retries it. Only `critical` and `high` findings create issues (`ISSUE_SEVERITIES`); medium/low findings are visible on the gadget only.

Issue format (from `buildIssuePayload`):

- Summary: `[CRITICAL] SEC001: Possible hard-coded secret in server.js`
- Labels: `codesentinel`, `sec-SEC001`, `sev-critical`
- Description: location `file:line:column`, redacted excerpt, explanation, remediation, footer `codesentinel-fp:<fingerprint>`.

## Forge modules

| Module | Key | Function / resource | Purpose |
| --- | --- | --- | --- |
| `webtrigger` | `ingest-trigger` | `ingest-fn` | CI report ingestion |
| `webtrigger` | `mcp-trigger` | `mcp-fn` | MCP JSON-RPC endpoint ([tools](mcp-tools.md)) |
| `jira:projectPage` | `config-page` | Custom UI `config` | Link repo, PAT, scan token, LLM opt-in, Scan now |
| `jira:dashboardGadget` | `posture-gadget` | Custom UI `gadget` | Score, severity counts, findings, delta |
| `jira:issueAction` | `suggest-fix` | Custom UI `suggest-fix` | LLM fix suggestion as a comment (opt-in) |
| `scheduledTrigger` | `hourly-rescan` | `rescan-fn` | Re-scan every linked repo hourly |
| `consumer` | `scan-consumer` | `scan-worker-fn` | Resumable GitHub scans (`scan-queue`) |
| `action` ×2 | `get-security-posture`, `list-open-findings` | `rovo-posture-fn`, `rovo-findings-fn` | Rovo actions |
| `rovo:agent` | `codesentinel-agent` | — | Rovo agent that uses both actions |

Function `scan-now-fn` is the Custom UI resolver behind the config page (`scanNow`, `saveRepo`, `getStatus`, …).

Scopes: `read:jira-work`, `write:jira-work`, `storage:app`. Egress (`external.fetch.backend`): `api.github.com` and the configured LLM host.

## GitHub app-side scan

1. `GET /repos/{owner}/{repo}` → default branch; `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`.
2. Keep blobs with `size ≤ 1 MB`, an extension in `scannableExtensions()`, and no ignored directory segment (`node_modules`, `.git`, `dist`, …); cap at 5000 files.
3. Fetch blobs 20 at a time (`GET /git/blobs/{sha}`), base64-decode, skip content containing `\u0000`, run `scanContent()`.
4. After ~20 s of work, persist `scanstate:{repoUrl}` (`cursor`, partial findings, counters) and push an async event to resume; the final step assembles the report (`meta.source = 'app'`) and calls `processReport()`.

## Data and security

See [storage schema](storage-schema.md) and [ADR 0003](../adr/0003-security-model.md). In short: the scan token is stored only as a SHA-256 hash and shown once; the PAT is stored with Forge secret storage and never returned to the browser; nothing logs tokens, PATs or file contents; LLM calls are opt-in per repo and send only `ruleId` + the already-redacted excerpt.

## Code sharing

`src/ingest.js`, `src/rules.js` and `src/scanner.js` are copied verbatim into `forge/src/shared/` by `scripts/sync-shared.sh`; CI fails if the copies drift (`scripts/sync-shared.sh --check`). `src/store/fileStore.js` and `forge/src/store/forgeStore.js` implement the same store interface, so the pipeline is unit-testable with the file store.

## Known limitations

- Fingerprints include the line number: moving code resolves the old issue and opens a new one ([ADR 0002](../adr/0002-dedup-and-line-shift.md)).
- Pattern-based analysis has false positives; every issue says so.
- Forge key-value values are limited in size, so the stored latest scan keeps at most 200 findings (`truncated: true` when trimmed).
