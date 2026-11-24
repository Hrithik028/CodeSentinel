# Test log

Record every manual or end-to-end verification here: date, environment, steps, result, and evidence (screenshot or run link). Automated test counts come from `npm test`.

| Date | Area | Environment | Steps | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 2026-11-20 | Shared core (CS-2) | Node 20, Ubuntu | `npm test`, `npm run check` | Pass: 25 tests | PR #10 CI |
| 2026-11-20 | Report schema example | Node 20 | `npm run scan -- --json samples/vulnerable-app` | Score 25 (F); 1 critical, 4 high, 3 medium; exit 2 | `docs/spec/report-schema.md` |
| 2026-11-20 | Forge deploy | `development`, hrithikjadhav028.atlassian.net | `forge lint`, `forge deploy`, `forge install` | Pass: lint clean, installed | `forge install list` |
| 2026-11-20 | App path (live) | Jira `SEC`, repo `Hrithik028/codesentinel-demo` | Link repo + PAT → Scan now | Score 25 (F); 5 created (SEC-1..5: 1 critical, 4 high) | ![issue](screenshots/jira-issue-live.png) |
| 2026-11-20 | App path rescan (live) | same | Scan now again | 0 created, 0 resolved | config page status |
| 2026-11-20 | CI ingest (live) | web trigger, local `node src/cli.js --json` of the demo repo | POST report | 0 created, 5 unchanged (same fingerprints as app scan) | HTTP 200 body |
| 2026-11-20 | CI ingest fix/regress (live) | same | Replace hard-coded secret → POST; restore → POST | 1 resolved (SEC-1 → Done + comment); then 1 created | HTTP 200 bodies |
| 2026-11-20 | Web trigger negatives (live) | same | GET; bad token; 1.1 MB body; invalid JSON; unknown repo | 405, 401, 413, 400, 404 | curl |
| 2026-11-20 | MCP (live) | `mcp-trigger` | No token; `initialize`; `tools/list`; `tools/call` both tools; MCP Inspector CLI `tools/list` | 401; all 200 with expected payloads; Inspector lists both tools | curl + `npx @modelcontextprotocol/inspector --cli` |
| 2026-11-20 | Suggest fix (live) | SEC-1, OpenAI | Issue action → Suggest fix | Advisory comment posted; excerpt redacted; status unchanged | ![suggest fix](screenshots/suggest-fix-live.png) |
| 2026-11-20 | Dashboard gadget (live) | dashboard `CodeSentinel`, project SEC | Add gadget → select SEC | Grade F 25/100, severity counts, CI badge, delta, findings with issue links | ![gadget](screenshots/gadget-live.png) |
| 2026-11-24 | `rovo:mcp` + demo site | `development` on one-atlas-cieg.atlassian.net (Forge demo site, Rovo Enterprise) | `forge lint`, `forge deploy`, `forge install --demo-site` | Pass: lint clean, v4.2.0 installed | `forge install list` |
| 2026-11-24 | Production deploy | `production` | `forge variables set --encrypt LLM_API_KEY`, `forge deploy -e production` | Pass: v2.0.0 deployed | CLI output |
| 2026-11-24 | CI ingest (demo site) | `development` on one-atlas-cieg, project SEC | codesentinel-demo Actions run 44747991711 with fresh `SCAN_TOKEN` | Pass: `{"created":5,"resolved":0,"unchanged":0}`; rerun `{"created":0,"unchanged":5}` (no duplicates) | Actions log |
| 2026-11-24 | Rovo agent (demo site) | `development` on one-atlas-cieg | Rovo chat → CodeSentinel Security Analyst: "What is the security posture of SEC?", "List open critical findings" | Pass: F / 25, 5 open, severity counts; SEC-1 SEC001 with redacted excerpt | `docs/screenshots/rovo-posture-demo-site.png`, `docs/screenshots/rovo-findings-demo-site.png` |
| 2026-11-24 | `rovo:mcp` in Rovo Studio | `development` on one-atlas-cieg | Studio → new agent → Add tools → Connected apps → CodeSentinel | Pass: `Get security posture` and `List open findings` listed as tools | `docs/screenshots/rovo-mcp-studio-tools.png` |
| 2026-11-24 | Judge install link | `production` app `CodeSentinel` | Distribution → Sharing with anyone → Jira; open link | Pass: install page shows CodeSentinel, vendor, privacy policy, support contact, Jira scopes and 2 egress domains | `docs/screenshots/judge-install-page.png` |
| 2026-11-24 | Marketplace app | `production` app `CodeSentinel Marketplace` (`ced0fd83-cabe-48c7-adcd-ca4440fa7b05`) | `forge register`, `forge variables set --encrypt LLM_API_KEY`, `forge deploy -e production` | Pass: deployed; separate app ID keeps the judge install link working after Marketplace submission | CLI output |

## Pending end-to-end runs

- [ ] CI path, clean site: install with the judge link → link repo → push → 5 issues → re-push → 0 created → fix secret → 1 resolved
- [ ] App path, clean site: link repo + PAT → Scan now → 5 issues; hourly rescan observed in logs (no new issues)
- [x] Web trigger negative cases: 405, 401, 413, 400, 404
- [x] Rovo: both actions invoked from chat
- [x] MCP Inspector: `initialize`, `tools/list`, `tools/call` for both tools
- [ ] Suggest fix: blocked when `llmOptIn` is false (unit-tested); comment posted when true (verified live)
