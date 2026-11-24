# ADR 0002: Fingerprint-based deduplication and the line-shift limitation

- Status: Accepted
- Date: 2026-11-20
- Issues: CS-2, CS-4

## Context

Each scan must map findings to Jira issues idempotently. Re-sending a report must not create duplicates, and fixed findings must close their issues. The scanner already emits `fingerprint = sha256("ruleId:relativePath:line:match").slice(0,16)`.

## Decision

- The scanner fingerprint is the identity of a Jira issue.
- `diffReports(openFingerprints, report)` compares the repo's open `fp:` records with the report's critical and high findings. It returns:
  - `toCreate`: in the report but not open.
  - `toResolve`: open but no longer in the report.
  - `unchanged`: in both.
- Before creating an issue, the pipeline checks `fp:{fingerprint}`, then runs a JQL fallback (`project = X AND labels = codesentinel AND text ~ "codesentinel-fp:<fp>" AND statusCategory != Done`). This survives retries and storage loss.
- The description footer carries `codesentinel-fp:<fp>`; the `sec-<ruleId>` and `sev-<severity>` labels support filtering.

## Known limitation: line shifts

The fingerprint includes the **line number**. Inserting or deleting a line above a finding changes its fingerprint. The old issue is then resolved with a "No longer detected" comment and a new issue is opened. `test/fixtures/scan-b.json` reproduces this: one inserted line shifts SEC003 and SEC005.

We accept this for the hackathon because:

- Changing the fingerprint means editing `scanner.js` beyond the two allowed exports, and it would break existing CLI consumers.
- The behaviour is deterministic and visible. The new issue has the same `sec-<ruleId>` label, so it is easy to relate to the old one.

Future work: a line-independent `matchKey` (ruleId + path + normalised match + occurrence index) to re-key moved findings instead of resolving and recreating them.

## Other notes

- Fingerprints do not include the repository. `fp:` records store `repoUrl`, and open sets are filtered per repo. We treat 64-bit collisions across repos as negligible.
- A JQL match is not adopted when it is an open issue tracked for a different repo previously linked to the same project; a new issue is created instead.
- Skipped files (too large, binary, unreadable) never resolve the findings they used to contain, and reports for an older commit (by `commitTime`) are ignored.
- If a resolved finding reappears, a new issue is created. Done issues are not reopened.
- Only default-branch pushes in CI should send reports. A feature branch that removes a finding would otherwise resolve an issue that still exists on the default branch. The demo workflow enforces this.
