# Judge setup

Time required: about 10 minutes. You need a Jira Cloud site where you are a site admin. A free developer site from <http://go.atlassian.com/cloud-dev> works.

## 1. Install the app

1. Open the install link: **_TBD: added at release (CS-8)_**.
2. Choose your Jira site and click **Get app**. The app asks for read and write access to Jira work items and app storage, and for egress to `api.github.com` and the LLM host.

## 2. Create a project

Create a Scrum or Kanban software project with key `SEC`, or use any existing project.

## 3a. CI path (recommended)

1. **Fork** <https://github.com/Hrithik028/codesentinel-demo>. It is intentionally vulnerable.
2. In Jira, open **Project settings → CodeSentinel**. Enter your fork's URL (`https://github.com/<you>/codesentinel-demo`) and save. Copy the **ingest URL** and the **scan token**; the token is shown only once.
3. In your fork, open **Settings → Secrets and variables → Actions**. Add `SCAN_ENDPOINT` (the ingest URL) and `SCAN_TOKEN` (the token).
4. In your fork's **Actions** tab, enable workflows. Then push any commit to `main`, or re-run the workflow.
5. Expected: the job log shows `{"created":5,"resolved":0,"unchanged":0,"errors":[]}`, and five issues labelled `codesentinel` appear in the project.
6. Re-run the workflow. Expected: `"created":0,"unchanged":5`.
7. In `server.js`, change line 5 to `const apiKey = process.env.API_KEY;` and push. Expected: the SEC001 issue is commented and moved to **Done**.

## 3b. App path (no CI)

1. Create a fine-grained GitHub PAT with **Contents: Read-only** on your fork (or any repo).
2. On the CodeSentinel project page, paste the PAT. The field is write-only and the PAT is never shown again. Click **Scan now**.
3. Expected: the last-scan status shows **App** with counts, and issues are created as in 3a. Rescans run hourly.

## 4. Dashboard, Rovo and MCP

- **Gadget:** Dashboards → Create dashboard → Add gadget → **CodeSentinel Security Posture** → choose the project.
- **Rovo:** open Rovo chat → agents → **CodeSentinel Security Analyst** → ask "What is the security posture of SEC?"
- **MCP:** on the project page, generate an **MCP token** and copy the MCP URL. Run `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, enter the URL, and add the header `Authorization: Bearer <token>`. See `docs/spec/mcp-tools.md`.
- **Suggest fix (optional):** tick **Allow LLM suggestions** on the project page. Open a CodeSentinel issue → **⋯ → Suggest fix**.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `401` in the Actions log | Wrong `SCAN_TOKEN`; regenerate it on the project page |
| `404` | `X-Repo` (`owner/repo`) does not match the linked repo URL |
| No POST step in the log | Not a push to the default branch, or a secret is missing (the workflow prints a notice) |
| Gadget says "No scans yet" | No report has been processed for the selected project |
