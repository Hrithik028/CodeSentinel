# ADR 0001: Forge app with two ingestion paths over a shared pure core

- Status: Accepted
- Date: 2026-11-20
- Issues: CS-1, CS-2, CS-4

## Context

CodeSentinel is a dependency-free Node scanner (`src/scanner.js`, `src/rules.js`). For Codegeist 2026, findings must become Jira work without us running a backend. Some teams can add a CI step; others want the app to scan without touching CI.

## Decision

1. Ship a **Forge app** (`forge/`). It runs on Atlassian infrastructure and keeps state in Forge storage, so there is no server to host.
2. Provide **two ingestion paths**: CI push (`ingest-trigger` web trigger) and app scan (GitHub REST API with a PAT, run hourly and on Scan now). Both feed one `processReport()` pipeline.
3. Keep decision logic **pure** in `src/ingest.js` (`diffReports`, `buildIssuePayload`, `summarizeDelta`). Copy it, with `rules.js` and `scanner.js`, into `forge/src/shared/` using `scripts/sync-shared.sh`; CI fails if the copies drift.
4. Put persistence behind one store interface. `fileStore` (JSON file, for tests) and `forgeStore` (Forge KVS) are interchangeable.
5. Limit `scanner.js` changes to two exports, `scanContent` and `scannableExtensions`; the scanner stays dependency-free.

## Consequences

- CI and app scans use the same rules and fingerprints, so both paths report identical findings for the same commit.
- Copying files instead of publishing a package avoids a build step and an npm dependency, at the cost of a sync script and a drift check.
- Jira calls run `asApp()`, so the app user creates issues. Project admins choose which project is linked.
- Long app scans exceed the ~25 s Forge invocation budget. They run in chunks through `@forge/events`, with a checkpoint in storage.
