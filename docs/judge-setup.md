# Judge setup

Time required: about 10 minutes. You need a Jira Cloud site where you are a site admin. To try the Rovo agent and Rovo MCP tools, use a site with Rovo, such as the free Forge demo site from `forge site provision` (includes Rovo Enterprise).

## 1. Install the app

1. Open the [CodeSentinel install link](https://developer.atlassian.com/console/install/2b37e8b5-d95c-4b0f-9141-98ee30b14cde?signature=AYABeASxd2JovLx5eUyq1bJv93kAAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4CxqLTo9l4lqXuFjNim1xJM%2Bp%2F3TVP9xHS2BrU5DRRucB5TKoVd%2FBvRr%2FVzMw1LSa4QAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDMUbpAJEJgwTvzYUQQIBEIA76FrfVL8HjDcHaoUmVE1boRrlAG40LGKmHhDntzkPhMv7wMYXw8NDy3NP4z4%2BX9n0lfOt2xZlusPpcxQAB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHi9bVMAkme4qVQX1fQHo6ePw3H40A7cGfz7yrmSfBWMXgFVX6Fe%2F4faED75nJJ5TiG%2BAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMP8uPmOq437A5DmkeAgEQgDsDzpMbo1bP0kK2FLV6cGHekSsVo6iFyJ8R3SD4LiPKtmW5Jsl%2FG%2FRuMg9kB32by7%2Ft8DPqQ5sI3DK1AgAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeDYASx0XCjkny4iLV6vz%2BKtEGSGT6kdt0QRpkn6D%2FlVEAddaiAbZqbObzWZdGxe0%2BbEAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAwRg%2FW7%2FCrJgpcsshMCARCAO%2F00d3Csyv2kGUH%2FDKQtE83HPzW%2BwibGHwAiN1YL2nOc%2FwwK5Mr4Je1kk7r%2B6F2vWyozqsXN662DJgtFAgAAAAAMAAAQAAAAAAAAAAAAAAAAAEbrx85bkSK9GzFa40dJkyj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADKspSA%2Fgna4RrufBmfQpO%2BWkMYZB%2Ftzfnnguh%2BOlcVzU3264G5SiBcKHXj7hwkfxwm9aW3HhBfDrDHGkQscoJGTX7M%3D&product=jira).
2. Choose your Jira site and click **Get app**. The app asks for read and write access to Jira work items and app storage, and for egress to `api.github.com` and the LLM host.

## 2. Create a project

Create a Scrum or Kanban software project with key `SEC`, or use any existing project.

## 3a. CI path (recommended)

1. **Fork** <https://github.com/Hrithik028/codesentinel-demo>. It is intentionally vulnerable.
2. In the project, open the **CodeSentinel** tab (under **More** in the project navigation). Enter your fork's URL (`https://github.com/<you>/codesentinel-demo`) and save. Copy the **ingest URL** and the **scan token**; the token is shown only once.
3. In your fork, open **Settings → Secrets and variables → Actions**. Add `SCAN_ENDPOINT` (the ingest URL) and `SCAN_TOKEN` (the token).
4. In your fork's **Actions** tab, enable workflows. Then push any commit to `main`, or re-run the workflow.
5. Expected: the job log shows `{"created":5,"resolved":0,"unchanged":0,"errors":[]}`, and five issues labelled `codesentinel` appear in the project.
6. Re-run the workflow. Expected: `"created":0,"unchanged":5`.
7. In `server.js`, change line 5 to `const apiKey = process.env.API_KEY;` and push. Expected: the SEC001 issue is commented and moved to **Done**.

## 3b. App path (no CI)

1. Create a fine-grained GitHub PAT with **Contents: Read-only** on your fork (or any repo).
2. On the project's **CodeSentinel** tab, paste the PAT and click **Save** (**Scan now** stays disabled until a PAT is saved). The field is write-only and the PAT is never shown again. Click **Scan now**.
3. Expected: the last-scan status shows **App** with counts, and issues are created as in 3a. Rescans run hourly.

## 4. Dashboard, Rovo and MCP

- **Gadget:** Dashboards → Create dashboard → Add gadget → **CodeSentinel Security Posture** → choose the project.
- **Rovo:** open Rovo chat → agents → **CodeSentinel Security Analyst** → ask "What is the security posture of SEC?"
- **Rovo MCP:** Rovo Studio → create an agent → add tools → **CodeSentinel MCP** (`get-security-posture`, `list-open-findings`). Studio creates a draft agent; delete it afterwards if you don't keep it.
- **MCP web trigger:** on the project page, generate an **MCP token** and copy the MCP URL. Run `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, enter the URL, and add the header `Authorization: Bearer <token>`. The web trigger's tools are `get_security_posture` and `list_open_findings` (snake_case). See `docs/spec/mcp-tools.md`.
- **Suggest fix (optional):** tick **Allow LLM suggestions** on the project page. Open a CodeSentinel issue → **⋯ → Suggest fix**.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `401` in the Actions log | Wrong `SCAN_TOKEN`; regenerate it on the project page |
| `404` | `X-Repo` (`owner/repo`) does not match the linked repo URL |
| No POST step in the log | Not a push to the default branch, or a secret is missing (the workflow prints a notice) |
| Gadget says "No scans for … yet" | No report has been processed for the selected project |
| Gadget says "Choose a project" | Edit the gadget and pick a linked project |
| Suggest fix says it is turned off | Tick **Enable "Suggest fix"** on the CodeSentinel tab and save |
