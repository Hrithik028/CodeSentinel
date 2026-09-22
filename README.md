# CodeSentinel

CodeSentinel is an AI-aware quality-gate project whose first working component is a local-first static security scanner. The shipped MVP includes a browser dashboard, a command-line interface, a reusable scanning engine, twelve explainable security rules, a deliberately vulnerable sample project, and automated tests.

No source code is uploaded and no third-party package is required.

## Implementation status

The repository originally described a broader CI/CD quality gate. The current implementation covers the local security-analysis portion of that design; it does not claim that every planned stage is complete.

| Original capability | Current status | Evidence |
| --- | --- | --- |
| Local validation | **Partially implemented** | Security rules, structured findings, scoring, JSON output, and reliable CLI exit codes |
| CI integration | **Planned** | The CLI is CI-compatible, but a checked-in GitHub Actions workflow and evidence artifact publishing are not included yet |
| Runtime validation | **Planned** | Isolated build, startup, health, and API smoke checks are not included yet |
| AI feedback | **Planned** | Findings use deterministic explanations; no source or report data is sent to an AI service |
| Deployment protection | **Planned** | Staging checks, deployment health gates, and rollback signals are not included yet |

The deterministic scanner—not an AI model—decides the current pass/fail exit status. A clean scan reduces known pattern-based risk but does not prove that an application is secure.

## Quick start

Requirements: Node.js 18 or newer.

```powershell
git clone https://github.com/Hrithik028/CodeSentinel.git
cd CodeSentinel
npm start
```

Open `http://127.0.0.1:4173`, keep the default `samples/vulnerable-app` path, and select **Run security scan**.

To use the CLI:

```powershell
npm run scan -- samples/vulnerable-app
```

For machine-readable output:

```powershell
npm run scan -- samples/vulnerable-app --json
```

The CLI exits with code `0` when no high or critical finding exists, `1` for high findings, `2` for critical findings, and `3` when the scan cannot run. This makes it usable in a CI pipeline.

## What it detects

| Rule | Detection | Severity |
| --- | --- | --- |
| SEC001 | Possible hard-coded secret | Critical |
| SEC002 | Dynamic code execution | Critical |
| SEC003 | Shell command execution | High |
| SEC004 | SQL built with string interpolation | High |
| SEC005 | Weak password hashing | High |
| SEC006 | Unsafe HTML assignment | High |
| SEC007 | Permissive CORS | Medium |
| SEC008 | Insecure HTTP endpoint | Medium |
| SEC009 | Debug mode enabled | Medium |
| SEC010 | TLS verification disabled | Critical |
| SEC011 | Potential path traversal | High |
| SEC012 | Sensitive data written to logs | Medium |

## Project structure

```text
CodeSentinel/
├── public/                  # Dashboard HTML, CSS, and browser JavaScript
├── samples/vulnerable-app/  # Safe, deliberately vulnerable demonstration files
├── src/
│   ├── cli.js               # Terminal interface
│   ├── rules.js             # Security rule catalogue
│   ├── scanner.js           # File discovery, analysis, scoring, and reports
│   └── server.js            # HTTP API and static file server
├── test/scanner.test.js     # Automated scanner tests
└── package.json
```

## How the scan works

1. The scanner recursively discovers files while ignoring dependencies, version-control data, build output, virtual environments, symbolic links, and files larger than 1 MB.
2. It reads supported text files and evaluates only rules that apply to each file extension.
3. Each match becomes a finding with severity, file, line, column, explanation, remediation, and a stable fingerprint. Suspected secret values are redacted in the report.
4. The report is sorted by urgency. The score starts at 100 and subtracts 20 points for critical, 10 for high, 5 for medium, and 2 for low findings, with a minimum of zero.

## Commands

```powershell
npm start       # Run the dashboard
npm run dev     # Run with automatic restart when server files change
npm test        # Run automated tests
npm run check   # Syntax-check every JavaScript entry point
npm run scan -- <folder> [--json]
```

## Security boundaries

The dashboard deliberately accepts only folders inside the CodeSentinel project. It also caps request bodies, skips symbolic links and large files, binds to localhost by default, sends a strict Content Security Policy, redacts detected secrets, and never sends scanned content to another service.

## Important limitation

CodeSentinel is an educational static-analysis MVP. Pattern matching can produce false positives and false negatives. Treat its report as an early warning system—not a replacement for dependency scanning, dynamic testing, threat modelling, penetration testing, or expert code review.

## Roadmap

1. Add a configurable runner that normalizes lint, type-check, test, build, and security evidence.
2. Add a GitHub Actions integration that publishes the structured report as a build artifact and job summary.
3. Add isolated application startup, health, and API smoke checks with restricted credentials.
4. Add optional AI explanations with explicit opt-in and data-sharing controls; AI output remains advisory.
5. Add deployment health gates and provider-neutral rollback signals.

## License

MIT
