# Test log

Record every manual or end-to-end verification here: date, environment, steps, result, and evidence (screenshot or run link). Automated test counts come from `npm test`.

| Date | Area | Environment | Steps | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-11-20 | Shared core (CS-2) | Node 20, Ubuntu | `npm test`, `npm run check` | Pass: 25 tests | PR #10 CI |
| 2026-11-20 | Report schema example | Node 20 | `npm run scan -- --json samples/vulnerable-app` | Score 25 (F); 1 critical, 4 high, 3 medium; exit 2 | `docs/spec/report-schema.md` |

## Pending end-to-end runs

- [ ] CI path, clean site: install with the judge link → link repo → push → 5 issues → re-push → 0 created → fix secret → 1 resolved
- [ ] App path, clean site: link repo + PAT → Scan now → 5 issues; hourly rescan observed in logs (no new issues)
- [ ] Web trigger negative cases: 405, 401, 413, 400, 404
- [ ] Rovo: both actions invoked from chat
- [ ] MCP Inspector: `initialize`, `tools/list`, `tools/call` for both tools
- [ ] Suggest fix: blocked when `llmOptIn` is false; comment posted when true
