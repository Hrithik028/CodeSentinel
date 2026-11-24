# CodeSentinel privacy policy

CodeSentinel is a Forge app that runs on Atlassian infrastructure.

- **Stored in Forge storage:** linked repository URLs, scan summaries (scores, counts, rule IDs, file paths, line numbers, fingerprints, Jira issue keys) and project settings. GitHub PATs are stored as encrypted secrets; scan and MCP tokens are stored only as SHA-256 hashes.
- **Not stored or logged:** source file contents, PATs and tokens.
- **Sent to third parties:** GitHub (`api.github.com`) to read repository contents with the PAT you supply. If a Jira admin enables **Allow LLM suggestions**, the rule metadata and a redacted one-line excerpt are sent to the configured OpenAI-compatible endpoint when a user clicks **Suggest fix**.
- **Deletion:** uninstalling the app deletes its Forge storage.

Contact: open an issue at https://github.com/Hrithik028/CodeSentinel/issues.
