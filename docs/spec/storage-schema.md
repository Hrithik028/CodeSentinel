# Storage schema

The Forge app uses Forge key-value storage (`@forge/kvs`) through `forge/src/store/forgeStore.js`. The CLI-side `src/store/fileStore.js` implements the same interface over a JSON file, so the ingest pipeline is tested without Forge.

## Interface

| Method | File store | Forge store |
| --- | --- | --- |
| `getFingerprint(fp)` / `setFingerprint(fp, record)` | `fingerprints[fp]` | `fp:{fp}` |
| `allFingerprintRecords()` | `Object.values(fingerprints)` | query `fp:` prefix, paginated |
| `getLatestScan(projectKey)` / `setLatestScan(projectKey, scan)` | `scans[projectKey]` | `scan:{projectKey}:latest` |
| `getConfig(key)` / `setConfig(key, value)` | `config[key]` | `config:{key}` (e.g. `config:repos`, `config:mcp`) |
| `getScanState(repoUrl)` / `setScanState(repoUrl, state \| null)` | `scanState[repoUrl]` | `scanstate:{repoUrl}` |

Forge-only (secret storage, `kvs.setSecret`/`getSecret`, encrypted, never sent to the frontend):

| Key | Value |
| --- | --- |
| `pat:{repoUrl}` | GitHub fine-grained PAT (Contents: read). Write-only from the UI. |
| `llmkey` | Not stored in KVS: the LLM API key is a Forge encrypted environment variable (`forge variables set --encrypt LLM_API_KEY`). |

## Records

### `fp:{fingerprint}`

```json
{
  "fingerprint": "3312544839d17cc7",
  "repoUrl": "https://github.com/Hrithik028/codesentinel-demo",
  "projectKey": "SEC",
  "issueKey": "SEC-12",
  "issueId": "10042",
  "status": "open",
  "ruleId": "SEC001",
  "severity": "critical",
  "file": "server.js",
  "line": 5,
  "firstSeenAt": "2026-11-20T12:00:00.000Z",
  "lastSeenAt": "2026-11-21T09:00:00.000Z",
  "resolvedAt": null
}
```

`status` is `open` or `resolved`. The set of previous fingerprints for a run is `allFingerprintRecords()` filtered by `repoUrl` and `status === 'open'`.

### `config:repos`

```json
[
  {
    "repoUrl": "https://github.com/Hrithik028/codesentinel-demo",
    "projectKey": "SEC",
    "issueType": "Bug",
    "scanTokenHash": "sha256 hex of the scan token",
    "hasPat": true,
    "llmOptIn": false,
    "createdAt": "2026-11-20T12:00:00.000Z",
    "lastScan": { "at": "…", "source": "ci", "status": "ok", "created": 5, "resolved": 0, "unchanged": 0, "errors": 0 }
  }
]
```

The plaintext scan token is generated server-side (`crypto.randomBytes(24)`, base64url), returned to the config page exactly once, and stored only as `scanTokenHash`. Comparison uses `crypto.timingSafeEqual` on the hashes.

### `config:mcp`

`{ "tokenHash": "sha256 hex", "createdAt": "…" }` — bearer token for the MCP endpoint, generated and shown once on the config page.

### `scan:{projectKey}:latest`

```json
{
  "repoUrl": "https://github.com/Hrithik028/codesentinel-demo",
  "source": "ci",
  "commit": "9f1c…",
  "receivedAt": "2026-11-20T12:00:05.000Z",
  "meta": { "...": "report.meta" },
  "summary": { "...": "report.summary" },
  "findings": [{ "...": "finding", "issueKey": "SEC-12" }],
  "truncated": false,
  "delta": { "...": "summarizeDelta(previous, report)" },
  "previousSummary": { "...": "summary of the previous scan or null" }
}
```

At most 200 findings are stored (Forge values are size-limited); `truncated` is `true` when more existed. Medium/low findings are stored without `issueKey`.

### `scanstate:{repoUrl}`

Checkpoint of an in-progress app-side scan: `{ runId, startedAt, branch, commit, files: [{ path, sha }], cursor, findings, scannedFiles, scannedBytes, skipped, hitFileLimit }`. Deleted when the scan completes; a new run with a different `runId` overwrites a stale checkpoint.
