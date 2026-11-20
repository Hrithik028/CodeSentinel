# Report schema

The report is the object returned by `scanDirectory()` in `src/scanner.js` and printed by `node src/cli.js --json <dir>`. The Forge app accepts exactly this shape on the `ingest-trigger` web trigger and produces the same shape for app-side scans.

## Fields

| Path | Type | Notes |
| --- | --- | --- |
| `meta.target` | string | Base name of the scanned directory |
| `meta.scannedAt` | ISO-8601 string | Scan finish time |
| `meta.durationMs` | integer | |
| `meta.scannedFiles` / `meta.scannedBytes` | integer | Files actually evaluated |
| `meta.skippedFiles` | integer | Length of `skipped` |
| `meta.hitFileLimit` | boolean | `true` when the 5000-file cap was reached |
| `meta.ruleCount` | integer | Rules in the catalogue (12) |
| `meta.source` | `"ci"` \| `"app"` | **Added by the Forge app**; absent in CLI output |
| `summary.score` | integer 0–100 | 100 − (20·critical + 10·high + 5·medium + 2·low), floored at 0 |
| `summary.grade` | `A`–`F` | ≥90 A, ≥80 B, ≥70 C, ≥60 D, else F |
| `summary.totalFindings` | integer | |
| `summary.severityCounts` | object | `critical`, `high`, `medium`, `low` |
| `findings[]` | array | Sorted by severity, file, line |
| `skipped[]` | array | `{ path, reason }`; reasons `file-too-large`, `binary-file`, `unreadable`, errno codes |

## Finding

| Field | Type | Notes |
| --- | --- | --- |
| `fingerprint` | 16 hex chars | `sha256(`${ruleId}:${relativePath}:${line}:${match}`).slice(0, 16)` |
| `ruleId` | `SEC001`–`SEC012` | See README rule table |
| `title`, `category`, `message`, `remediation` | string | From the rule catalogue |
| `severity` | `critical` \| `high` \| `medium` \| `low` | |
| `file` | string | POSIX path relative to the scan root |
| `line`, `column` | integer ≥ 1 | |
| `excerpt` | string ≤ 240 chars | Trimmed source line; SEC001 values replaced by `[REDACTED]` |

## Validation on ingest

`validateReport()` in `src/ingest.js` rejects (HTTP 400) bodies that are not objects, lack `summary.score`, lack a `findings` array, or contain findings without a 16-hex `fingerprint`, a known `severity`, string `ruleId`/`title`/`file`, or a positive integer `line`.

## Example

Generated with `npm run scan -- --json samples/vulnerable-app` (exit code 2 because a critical finding exists):

```json
{
  "meta": {
    "target": "vulnerable-app",
    "scannedAt": "2026-11-20T12:10:09.350Z",
    "durationMs": 11,
    "scannedFiles": 2,
    "scannedBytes": 789,
    "skippedFiles": 0,
    "hitFileLimit": false,
    "ruleCount": 12
  },
  "summary": {
    "score": 25,
    "grade": "F",
    "totalFindings": 8,
    "severityCounts": {
      "critical": 1,
      "high": 4,
      "medium": 3,
      "low": 0
    }
  },
  "findings": [
    {
      "fingerprint": "3312544839d17cc7",
      "ruleId": "SEC001",
      "title": "Possible hard-coded secret",
      "severity": "critical",
      "category": "Secrets",
      "file": "server.js",
      "line": 5,
      "column": 7,
      "excerpt": "const apiKey = '[REDACTED]';",
      "message": "A credential-like value appears to be stored directly in source code.",
      "remediation": "Move the value to an environment variable or secret manager, revoke the exposed value, and rotate it."
    },
    {
      "fingerprint": "1931ac06927d28aa",
      "ruleId": "SEC006",
      "title": "Unsafe HTML assignment",
      "severity": "high",
      "category": "Cross-site scripting",
      "file": "client.js",
      "line": 2,
      "column": 37,
      "excerpt": "document.querySelector('#welcome').innerHTML = name;",
      "message": "Writing arbitrary HTML can execute attacker-controlled scripts in the browser.",
      "remediation": "Use textContent for plain text or sanitize trusted markup with a maintained allow-list sanitizer."
    },
    {
      "fingerprint": "dc0ac80e34cece3f",
      "ruleId": "SEC004",
      "title": "SQL query built with string interpolation",
      "severity": "high",
      "category": "Injection",
      "file": "server.js",
      "line": 9,
      "column": 26,
      "excerpt": "return database.query(`SELECT * FROM users WHERE name = '${name}'`);",
      "message": "Building SQL with values embedded in a string can create a SQL injection vulnerability.",
      "remediation": "Use parameterised queries or prepared statements and pass data separately from SQL text."
    },
    {
      "fingerprint": "7c7f3e8d9a19a095",
      "ruleId": "SEC003",
      "title": "Shell command execution",
      "severity": "high",
      "category": "Injection",
      "file": "server.js",
      "line": 13,
      "column": 3,
      "excerpt": "exec(`ping ${host}`, () => {});",
      "message": "Shell execution becomes dangerous when any argument can contain user-controlled data.",
      "remediation": "Prefer execFile/spawn with a fixed executable and validated argument array; never concatenate untrusted input."
    },
    {
      "fingerprint": "cf741b0f32dab763",
      "ruleId": "SEC005",
      "title": "Weak password hashing algorithm",
      "severity": "high",
      "category": "Cryptography",
      "file": "server.js",
      "line": 17,
      "column": 17,
      "excerpt": "return crypto.createHash('md5').update(password).digest('hex');",
      "message": "MD5 and SHA-1 are too fast and collision-prone for password storage.",
      "remediation": "Use Argon2id, scrypt, or bcrypt with an appropriate work factor and a unique salt."
    },
    {
      "fingerprint": "0c3e4c0baada8153",
      "ruleId": "SEC008",
      "title": "Insecure HTTP endpoint",
      "severity": "medium",
      "category": "Transport security",
      "file": "client.js",
      "line": 6,
      "column": 33,
      "excerpt": "const response = await fetch('http://api.example.com/profile');",
      "message": "Plain HTTP can expose data to interception or modification in transit.",
      "remediation": "Use HTTPS and validate the remote certificate. Redirect public HTTP traffic to HTTPS."
    },
    {
      "fingerprint": "27813f06006fc8dc",
      "ruleId": "SEC009",
      "title": "Debug mode enabled",
      "severity": "medium",
      "category": "Configuration",
      "file": "server.js",
      "line": 6,
      "column": 7,
      "excerpt": "const debug = true;",
      "message": "Debug mode may reveal stack traces, environment details, or privileged developer endpoints.",
      "remediation": "Disable debug mode in deployed environments and keep detailed errors in protected logs."
    },
    {
      "fingerprint": "71b0647b9926f1a1",
      "ruleId": "SEC012",
      "title": "Sensitive data written to logs",
      "severity": "medium",
      "category": "Data exposure",
      "file": "server.js",
      "line": 20,
      "column": 1,
      "excerpt": "console.log('token', apiKey);",
      "message": "Logs may retain sensitive values longer than the application and expose them to more people.",
      "remediation": "Remove the sensitive field or log only a redacted identifier with structured access controls."
    }
  ],
  "skipped": []
}
```
