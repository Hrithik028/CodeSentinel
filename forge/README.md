# CodeSentinel for Jira (Forge app)

Atlassian Forge app that turns CodeSentinel findings into Jira issues. See [`docs/spec/forge-integration.md`](../docs/spec/forge-integration.md) for the design.

## Layout

| Path | Purpose |
| --- | --- |
| `manifest.yml` | Modules: ingest/MCP web triggers, project config page, dashboard gadget, Suggest fix issue action, hourly rescan, scan queue consumer, Rovo actions and agent |
| `src/index.js` | Function handlers referenced by the manifest |
| `src/store/forgeStore.js` | Store interface (same as `src/store/fileStore.js`) over Forge KVS; PATs use secret storage |
| `src/jira.js` | `asApp()` Jira wrappers: `createIssue`, `findIssueByFingerprint`, `addComment`, `transitionToDone` |
| `src/ingestHandler.js` | `ingest-trigger` web trigger: auth, validation, then `processReport` |
| `src/processReport.js` | Shared pipeline for CI and app scans: diff, then create/comment/transition issues, then store the latest scan |
| `src/github.js` | GitHub REST client: default branch → recursive tree → filtered blobs (≤1 MB, scannable extension, no ignored dir, max 5000) |
| `src/scan.js` | Time-boxed app-side scan step (20 s budget, 20 blobs per batch). Saves a compact `scanstate:` checkpoint, re-queued on `scan-queue` |
| `src/report.js` | Builds `scanDirectory()`-shaped reports (same score/grade) for app scans |
| `src/configService.js`, `src/resolvers.js` | Config page and gadget resolvers: link repo, write-only PAT, scan token shown once, Scan now, posture. Admin/browse checks use `mypermissions` |
| `src/repos.js` | Scan-token hashing and comparison, GitHub repo URL normalisation |
| `src/adf.js` | Plain text ↔ Atlassian Document Format |
| `src/smoke.js` | Deploy smoke test (`node:crypto` + shared scanner in the Forge runtime) |
| `src/shared/` | **Generated** copies of `src/ingest.js`, `src/rules.js`, `src/scanner.js`. Edit the originals, then run `scripts/sync-shared.sh` |
| `static/*/build` | Custom UI bundles (config page, gadget, Suggest fix) |

## Develop

The Forge CLI needs Node 22 or newer. The scanner itself still runs on Node 18+.

```bash
npm install -g @forge/cli
cd forge && npm install
forge login            # or set FORGE_EMAIL and FORGE_API_TOKEN
forge register         # first time only; writes app.id into manifest.yml
forge lint
forge deploy -e development
forge install -e development --product jira --site <your-site>.atlassian.net
```

After changing `src/ingest.js`, `src/rules.js` or `src/scanner.js`, run `scripts/sync-shared.sh`. CI fails if the copies drift.

The `smokeTest` resolver returns `{ sha256, timingSafeEqual, scannerFindings, fingerprintLength }`. After deploying, call it from the config page console with `invoke('smokeTest')`, or run `forge tunnel`, to confirm that `node:crypto` works in the Forge runtime.

## CI ingest endpoint

Send `POST <ingest-trigger URL>` with the `--json` report as the body and these headers:

| Header | Value |
| --- | --- |
| `X-Scan-Token` | Token shown once on the project config page |
| `X-Repo` | `owner/repo` or `https://github.com/owner/repo`; must be linked to that token |
| `X-Commit` | Commit SHA (optional, shown on the gadget) |

| Status | When |
| --- | --- |
| `200` | Report processed. Body: `{"created":n,"resolved":n,"unchanged":n,"errors":[{fingerprint,operation,message}]}` |
| `405` | Method is not `POST` |
| `413` | Body is larger than 1 MB |
| `401` | Missing or unknown token |
| `404` | Token valid, but `X-Repo` is not linked to it |
| `400` | Body is not JSON or fails `validateReport` |

A Jira failure on one issue goes into `errors[]` and does not stop the run. A failed create stores no `fp:` record, so the next report retries it. Error messages contain only the HTTP status.

`forge/test/` covers the pipeline and handler against `FileStore` and a fake Jira client. This includes an idempotent re-send of `test/fixtures/scan-a.json` and the line-shift case `scan-a.json` → `scan-b.json`. The root `npm test` runs these tests.

## App-side scans

**Scan now** (config page) and the hourly `rescan` push `{repoUrl}` to `scan-queue`. Each `scanWorker` step:

1. Resolves the default-branch commit on the first step.
2. Re-lists the tree **at that commit**, which is deterministic, so the file list is never checkpointed.
3. Scans blobs in batches of 20 until 20 s have elapsed.
4. Saves `{runId, commit, cursor, findings (compact), counters}` and re-queues `{repoUrl, runId}`.

A step whose `runId` no longer matches the checkpoint is dropped as superseded. To fit in Forge storage, checkpoints keep only `fingerprint, ruleId, file, line, column, excerpt`; the rest is restored from `RULES` when the scan completes. A scan aborts with an error, without resolving anything, if its checkpoint would exceed 200 KB. The completed report goes through the same `processReport` as CI, with `source: 'app'`.

The PAT is kept in KVS secret storage (`pat:{repoUrl}`) and sent only as the `Authorization` header to `api.github.com`. It is never returned to the UI (`hasPat` only) or logged. Unlinking or changing the repo deletes it.
