# CodeSentinel for Jira (Forge app)

Atlassian Forge app that turns CodeSentinel findings into Jira issues. See [`docs/spec/forge-integration.md`](../docs/spec/forge-integration.md) for the design.

## Layout

| Path | Purpose |
| --- | --- |
| `manifest.yml` | Modules: ingest/MCP web triggers, project config page, dashboard gadget, Suggest fix issue action, hourly rescan, scan queue consumer, Rovo actions and agent |
| `src/index.js` | Function handlers referenced by the manifest |
| `src/store/forgeStore.js` | Store interface (same as `src/store/fileStore.js`) over Forge KVS; PATs use secret storage |
| `src/jira.js` | `asApp()` Jira wrappers: `createIssue`, `findIssueByFingerprint`, `addComment`, `transitionToDone` |
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
