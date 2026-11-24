# Demo script (< 5 minutes)

Target length: 4:30. Record at 1080p, with Jira in a clean browser profile. Have three tabs open: Jira dashboard, GitHub `codesentinel-demo`, and Rovo chat. Record on the Forge demo site (`forge site provision`), which includes Rovo.

| Time | Screen | Narration / action |
| --- | --- | --- |
| 0:00–0:20 | Title card, then the GitHub `codesentinel-demo` repo | "Security scanners find problems. Teams fix *tickets*. CodeSentinel turns findings into tracked Jira work, automatically and idempotently." |
| 0:20–0:50 | Jira → Project settings → **CodeSentinel** page | Link `https://github.com/Hrithik028/codesentinel-demo` to project `SEC`. Paste a read-only PAT (the field is write-only). The scan token appears once; copy it. Leave **LLM suggestions** opted in. |
| 0:50–1:20 | GitHub → Settings → Secrets | Add `SCAN_ENDPOINT` and `SCAN_TOKEN`. Show `.github/workflows/codesentinel.yml`: CLI `--json`, then `curl` to the web trigger. |
| 1:20–1:50 | GitHub Actions run → Jira issue list | Push a commit. The job turns green and the response shows `{"created":5,...}`. Jira gets five issues labelled `codesentinel`, `sec-SEC001`, `sev-critical`, and so on. Open SEC001: location, redacted excerpt, remediation, and the fingerprint footer. |
| 1:50–2:10 | Re-run the workflow | Point out idempotency: the response shows `{"created":0,"unchanged":5}`, with no duplicates. |
| 2:10–2:45 | Edit `server.js`: replace the key with `process.env.API_KEY`, then push | The SEC001 issue gets a "No longer detected" comment and moves to **Done**. Mention the line-shift caveat in one sentence (ADR 0002). |
| 2:45–3:15 | Jira dashboard gadget | Score/grade badge (F → better), severity counts, findings table with issue links, delta vs. the previous scan, and the `CI` source badge. Click **Scan now** on the config page; the badge switches to `App` (app-side GitHub scan, no CI needed). |
| 3:15–3:45 | Open a high issue → **Suggest fix** | An LLM comment appears: "AI-generated suggestion (advisory only) …". Note that it is opt-in and sends only the rule and the redacted excerpt. |
| 3:45–4:10 | Rovo chat | "What's the security posture of SEC?" then "List open critical findings". The **CodeSentinel Security Analyst** agent answers using the `getSecurityPosture` and `listOpenFindings` actions. |
| 4:10–4:30 | Rovo Studio, then MCP Inspector | Create an agent and add the **CodeSentinel MCP** tools (`rovo:mcp`). Then MCP Inspector: `tools/list` shows `get_security_posture` and `list_open_findings`; run one. Close: "Runs on Forge, listed on Marketplace, works from CI or without it." |

Backup plan: if a live step fails, cut to the pre-recorded clip of the same step from the rehearsal (keep one take of each step in `recordings/`, not committed).
