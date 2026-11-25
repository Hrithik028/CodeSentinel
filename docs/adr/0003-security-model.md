# ADR 0003: Security model

- Status: Accepted
- Date: 2026-11-20
- Issues: CS-4, CS-5, CS-7

## Assets

| Asset | Storage | Exposure |
| --- | --- | --- |
| Scan token (CI → web trigger) | Only `scanTokenHash` (SHA-256) in `config:repos` | Plaintext shown once on the config page |
| MCP token | Only `tokenHash` in `config:mcp` | Shown once |
| GitHub PAT | Forge secret storage `pat:{repoUrl}` | Write-only; the UI only sees `hasPat` |
| LLM API key | Forge encrypted variable `LLM_API_KEY` | Never in storage or the UI |
| Source code | Never stored | Only redacted excerpts (≤240 chars) are kept; on a line with a secret every quoted value is masked, including in scan checkpoints |

## Controls

- **Web trigger hardening (`ingest-fn`):** requests are rejected in this order:
  - 405 for anything but `POST`.
  - 413 for a body over 1 MB.
  - 401 for a bad `X-Scan-Token`. The token is hashed and compared with `timingSafeEqual`.
  - 404 when `X-Repo` does not match a linked `repoUrl`. The token must belong to that repo.
  - 400 when `validateReport` fails.
  - Error bodies never echo the input.
- **No secret logging:** handlers log only counts, keys and status codes. They never log headers, tokens, PATs, report bodies or file contents.
- **Least privilege:**
  - Scopes: `read:jira-work`, `write:jira-work` and `storage:app`.
  - Egress: only `api.github.com` and one LLM host.
  - The PAT should be fine-grained, with read-only Contents access on one repo.
- **Admin-only configuration:** project page resolvers check that the caller has `ADMINISTER_PROJECTS` before they save config or rotate tokens.
- **LLM opt-in:** Suggest fix is off unless `llmOptIn` is set for the repo.
  - The `codesentinel` label is not trusted: the issue must match a stored `fp:` record (same issue key, project and linked repo). Rule and excerpt come from app storage (the `fp:` record, falling back to the latest scan), not the editable issue text.
  - It sends only `ruleId`, title, remediation and the redacted excerpt.
  - The reply is posted as a comment prefixed `AI-generated suggestion (advisory only)`.
  - It never changes code or issue state.
- **Deterministic decisions:** only the scanner decides whether issues are created or resolved; the LLM never does.
- **Rotation:** regenerating a token replaces its hash, so the old token stops working immediately.

## Residual risks

- Web trigger URLs are unguessable but public, so both triggers require token auth.
- Pattern matching has false positives, and every issue says so.
- A leaked scan token lets someone submit fake reports for one repo. They could then create or close CodeSentinel-labelled issues. Mitigation: rotate the token; issue history shows every change.
