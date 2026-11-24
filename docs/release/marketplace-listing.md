# Marketplace listing (CS-8)

Paste these into **developer.atlassian.com → Console → CodeSentinel Marketplace → Distribution → List on Marketplace**.

Submit from the **CodeSentinel Marketplace** app (`ari:cloud:ecosystem::app/ced0fd83-cabe-48c7-adcd-ca4440fa7b05`, same code, production deployed), not from the judge app `CodeSentinel`. Atlassian disables install-link sharing for an app once it is submitted to Marketplace, so the judge app must stay unsubmitted. To redeploy the Marketplace app, copy `forge/`, set `app.id` in `manifest.yml` to the ID above and run `forge deploy -e production`. The listing only needs to be *submitted* for the Codegeist Marketplace bonus; record the review ticket link in `docs/submission-checklist.md`.

## Basics

| Field | Value |
| --- | --- |
| App name | CodeSentinel |
| Tagline (≤ 80 chars) | Turn security findings into tracked, de-duplicated Jira work |
| Category | Code quality / Security (Software Development) |
| Hosting | Cloud, Forge (Runs on Atlassian is not claimed: egress to `api.github.com`, optional LLM host) |
| Pricing | Free |
| Product | Jira Cloud |
| Source | https://github.com/Hrithik028/CodeSentinel |
| Support | GitHub issues on the source repo |

## Summary (≤ 250 chars)

CodeSentinel scans your GitHub repository for hard-coded secrets, injection risks and unsafe patterns, then turns every critical and high finding into exactly one Jira issue, and closes it when the fix lands.

## Highlights

1. **Findings become Jira work, once.** Fingerprinted findings create one issue each; rescans never duplicate, fixes auto-resolve with a comment.
2. **CI or no CI.** Push a JSON report from GitHub Actions to a token-protected web trigger, or let the app scan the repo itself with a read-only PAT, hourly.
3. **Posture where teams look.** A dashboard gadget shows score, grade, severity counts and the delta since the last scan.
4. **Ask Rovo.** The CodeSentinel Security Analyst agent and the CodeSentinel MCP tools answer "what is our security posture?" from stored scans, filtered to projects the user can browse.

## Description

Security scanners find problems; teams fix tickets. CodeSentinel closes that gap inside Jira.

- Link a GitHub repository to a Jira project on the CodeSentinel project page.
- Findings at `critical` or `high` severity become issues labelled `codesentinel`, `sec-<rule>` and `sev-<severity>`, with location, a redacted excerpt and remediation guidance.
- Each issue carries a fingerprint. Rescans skip known findings, and findings that disappear are commented and transitioned to Done.
- **Suggest fix** (opt-in per project) adds an advisory comment generated from the rule metadata and the redacted one-line excerpt only.
- Rovo: agent `CodeSentinel Security Analyst`, actions `get-security-posture` and `list-open-findings`, exposed to Rovo Studio and MCP clients through the `rovo:mcp` module.

Privacy and security: GitHub PATs and scan tokens are stored only as encrypted secrets or hashes, never logged or shown again; file contents are never stored or logged; LLM use is off by default.

## Screenshots (1840×900 recommended)

1. `docs/screenshots/gadget-live.png` — dashboard gadget
2. `docs/screenshots/jira-issue-live.png` — generated issue
3. `docs/screenshots/suggest-fix-live.png` — advisory fix comment
4. Rovo chat answering "What is the security posture of SEC?" (capture on the demo site)
5. Config page with linked repo (capture on the demo site)

## Required links you provide

- Privacy policy: `https://github.com/Hrithik028/CodeSentinel/blob/main/docs/release/privacy.md`
- Partner profile: create one in the Marketplace partner console if you don't have one.
