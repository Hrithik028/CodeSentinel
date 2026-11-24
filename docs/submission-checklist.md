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

- [x] `forge deploy -e production` done, with the production LLM key set (`forge variables set -e production --encrypt LLM_API_KEY …`)
- [x] Distribution: sharing enabled (Sharing with anyone, Jira); judge install link generated and recorded in `judge-setup.md`
- [ ] Marketplace listing submitted from the separate **CodeSentinel Marketplace** app (`ced0fd83-cabe-48c7-adcd-ca4440fa7b05`), not the judge app (copy in `docs/release/marketplace-listing.md`); review ticket link recorded below
- [ ] Clean-site E2E for both paths logged in `test-log.md`
- [ ] Tag `v2.0.0-forge` pushed; CS-1..CS-8 closed; milestone `codegeist-2026` closed

## Devpost

- [ ] Public YouTube video under 5 minutes, following `demo-script.md`
- [ ] Devpost text pasted from `docs/release/devpost.md`
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
| Judge install link | [install link](https://developer.atlassian.com/console/install/2b37e8b5-d95c-4b0f-9141-98ee30b14cde?signature=AYABeASxd2JovLx5eUyq1bJv93kAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB5TKoVd%2FBvRr%2FVzMw1LSa4QAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDMUbpAJEJgwTvzYUQQIBEIA76FrfVL8HjDcHaoUmVE1boRrlAG40LGKmHhDntzkPhMv7wMYXw8NDy3NP4z4%2BX9n0lfOt2xZlusPpcxQAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFVX6Fe%2F4faED75nJJ5TiG%2BAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMP8uPmOq437A5DmkeAgEQgDsDzpMbo1bP0kK2FLV6cGHekSsVo6iFyJ8R3SD4LiPKtmW5Jsl%2FG%2FRuMg9kB32by7%2Ft8DPqQ5sI3DK1AgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAddaiAbZqbObzWZdGxe0%2BbEAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwRg%2FW7%2FCrJgpcsshMCARCAO%2F00d3Csyv2kGUH%2FDKQtE83HPzW%2BwibGHwAiN1YL2nOc%2FwwK5Mr4Je1kk7r%2B6F2vWyozqsXN662DJgtFAgAAAAAMAAAQAAAAAAAAAAAAAAAAAEbrx85bkSK9GzFa40dJkyj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKspSA%2Fgna4RrufBmfQpO%2BWkMYZB%2Ftzfnnguh%2BOlcVzU3264G5SiBcKHXj7hwkfxwm9aW3HhBfDrDHGkQscoJGTX7M%3D&product=jira) |
| YouTube video | _TBD_ |
| Devpost entry | _TBD_ |
