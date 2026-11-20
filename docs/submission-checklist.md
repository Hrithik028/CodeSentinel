# Codegeist 2026 submission checklist

Category: **Apps for Software Teams**. Bonuses claimed: **Marketplace**, **Rovo agent**, **Atlassian MCP**. Teamwork Graph is not claimed (ADR 0004).

## Build

- [ ] CS-1 docs merged (`feat/forge-docs`)
- [ ] CS-2 shared core merged (`feat/forge-core`); `npm test` and `npm run check` green
- [ ] CS-3 `codesentinel-demo` workflow merged; one green run with POST
- [ ] CS-4 Forge skeleton and ingest merged; `forge lint` green; idempotent round-trip logged
- [ ] CS-5 app-side GitHub scan merged; resumable scan verified on a repo with more than 20 s of work
- [ ] CS-6 gadget and config page merged; loading, empty and error states captured
- [ ] CS-7 Rovo actions invoked from chat (screenshot); MCP Inspector session (screenshot); Suggest fix gated on `llmOptIn`
- [ ] `scripts/sync-shared.sh --check` passes in CI

## Release

- [ ] `forge deploy -e production` done, with the production LLM key set (`forge variables set -e production --encrypt LLM_API_KEY …`)
- [ ] Distribution: sharing enabled; judge install link generated and recorded in `judge-setup.md`
- [ ] Marketplace listing submitted; review ticket link recorded below
- [ ] Clean-site E2E for both paths logged in `test-log.md`
- [ ] Tag `v2.0.0-forge` pushed; CS-1..CS-8 closed; milestone `codegeist-2026` closed

## Devpost

- [ ] Public YouTube video under 5 minutes, following `demo-script.md`
- [ ] Category: Apps for Software Teams
- [ ] Bonus checkboxes: Marketplace, Rovo, Atlassian MCP
- [ ] Technical explanation: architecture (ADR 0001), dedup (ADR 0002), security (ADR 0003), bonus scope (ADR 0004)
- [ ] Repo links: CodeSentinel, codesentinel-demo
- [ ] Judge install link and `judge-setup.md` link
- [ ] Screenshots: gadget, issue, Rovo chat, MCP Inspector, config page

## Links (fill in)

| Item | Link |
| --- | --- |
| Marketplace review ticket | _TBD_ |
| Judge install link | _TBD_ |
| YouTube video | _TBD_ |
| Devpost entry | _TBD_ |
