import { buildIssuePayload, diffReports, summarizeDelta } from './shared/ingest.js';
import { lastScanKey } from './repos.js';

export const MAX_STORED_FINDINGS = 200;
// Forge KVS values are capped at 240 KiB; keep the published scan well below that.
export const MAX_STORED_SCAN_BYTES = 200 * 1024;
const MAX_STORED_EXCERPT = 240;

const SECRET_RULE = 'SEC001';
const RESOLVE_COMMENT = 'CodeSentinel no longer detects this finding on the latest scan, so it was transitioned to Done.';
// The closing quote is optional: excerpts are capped at 240 chars and may cut a credential off.
const CREDENTIAL_VALUE = /([:=]\s*["'])[^"'\n]*(["']|$)/g;

const redactCredentials = (excerpt) => (typeof excerpt === 'string' ? excerpt.replace(CREDENTIAL_VALUE, '$1[REDACTED]$2') : excerpt);

// Every finding on a line that holds a secret gets the SEC001 excerpt with every quoted value masked,
// so neither another rule's excerpt nor a second credential on the same line can leak.
export function redactSecretLines(report) {
  const secretExcerpts = new Map();
  for (const finding of report.findings ?? []) {
    if (finding.ruleId === SECRET_RULE) secretExcerpts.set(`${finding.file}:${finding.line}`, redactCredentials(finding.excerpt));
  }
  return {
    ...report,
    findings: (report.findings ?? []).map((finding) => {
      const redacted = secretExcerpts.get(`${finding.file}:${finding.line}`);
      return redacted !== undefined ? { ...finding, excerpt: redacted } : finding;
    })
  };
}

export const recordKey = (projectKey, fingerprint) => `${projectKey}:${fingerprint}`;

const storedFinding = ({ fingerprint, ruleId, title, severity, category, message, file, line, column, excerpt }, issueKey) => ({
  fingerprint, ruleId, title, severity, category, message, file, line, column,
  excerpt: typeof excerpt === 'string' ? excerpt.slice(0, MAX_STORED_EXCERPT) : excerpt,
  issueKey
});

export function fitLatestScan(scan, findings, maxBytes = MAX_STORED_SCAN_BYTES) {
  let kept = findings.slice(0, MAX_STORED_FINDINGS);
  let stored = { ...scan, findings: kept, truncated: kept.length < findings.length };
  while (kept.length && Buffer.byteLength(JSON.stringify(stored)) > maxBytes) {
    kept = kept.slice(0, Math.floor(kept.length * 0.8));
    stored = { ...scan, findings: kept, truncated: true };
  }
  return stored;
}

const isOlder = (commitTime, previous) => Boolean(commitTime && previous?.commitTime && Date.parse(commitTime) < Date.parse(previous.commitTime));

export async function processReport(rawReport, repo, { source, commit = null, commitTime = null, store, jira, now = () => new Date().toISOString() }) {
  const report = redactSecretLines(rawReport);
  const { repoUrl, projectKey } = repo;
  const previousScan = await store.getLatestScan(projectKey);
  // A report for an older commit arriving late must not roll back state from a newer one.
  if (previousScan?.repoUrl === repoUrl && isOlder(commitTime, previousScan)) {
    return { created: 0, resolved: 0, unchanged: 0, errors: [], stale: true };
  }

  const timestamp = now();
  // A file that was skipped (too large, binary, ...) proves nothing about the findings it used to contain.
  // `skipped` is not schema-validated, so it is read defensively before any Jira write.
  const skippedFiles = new Set((Array.isArray(report.skipped) ? report.skipped : [])
    .map((item) => item?.path ?? item?.file)
    .filter((path) => typeof path === 'string'));
  const allRecords = await store.allFingerprintRecords();
  const records = allRecords.filter((record) => record.repoUrl === repoUrl && record.projectKey === projectKey);
  // Issues still tracked for a previously linked repo in this project are never adopted for this repo.
  const foreignIssueKeys = new Set(allRecords
    .filter((record) => record.projectKey === projectKey && record.repoUrl !== repoUrl && record.status === 'open')
    .map((record) => record.issueKey));
  const openRecords = records.filter((record) => record.status === 'open');
  const diff = diffReports(openRecords, report);
  const result = { created: 0, resolved: 0, unchanged: diff.unchanged.length, errors: [] };
  const issueKeys = new Map(openRecords.map((record) => [record.fingerprint, record.issueKey]));

  for (const finding of diff.toCreate) {
    try {
      const found = await jira.findIssueByFingerprint(projectKey, finding.fingerprint);
      const issue = found && !foreignIssueKeys.has(found.issueKey)
        ? found
        : await jira.createIssue(projectKey, buildIssuePayload(finding), repo.issueType ?? 'Bug');
      await store.setFingerprint(recordKey(projectKey, finding.fingerprint), {
        fingerprint: finding.fingerprint,
        repoUrl,
        projectKey,
        issueKey: issue.issueKey,
        issueId: issue.issueId,
        status: 'open',
        ruleId: finding.ruleId,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        resolvedAt: null
      });
      issueKeys.set(finding.fingerprint, issue.issueKey);
      result.created += 1;
    } catch (error) {
      result.errors.push({ fingerprint: finding.fingerprint, operation: 'create', message: safeMessage(error) });
    }
  }

  const partial = report.meta?.hitFileLimit === true;
  for (const fingerprint of partial ? [] : diff.toResolve) {
    const record = openRecords.find((item) => item.fingerprint === fingerprint);
    if (skippedFiles.has(record.file)) continue;
    try {
      const transitioned = await jira.transitionToDone(record.issueKey);
      if (!transitioned) {
        result.errors.push({ fingerprint, operation: 'resolve', message: 'No transition to a Done status is available' });
        continue;
      }
      if (transitioned !== 'already-done') await jira.addComment(record.issueKey, RESOLVE_COMMENT);
      await store.setFingerprint(recordKey(projectKey, fingerprint), { ...record, status: 'resolved', resolvedAt: timestamp });
      issueKeys.delete(fingerprint);
      result.resolved += 1;
    } catch (error) {
      result.errors.push({ fingerprint, operation: 'resolve', message: safeMessage(error) });
    }
  }

  for (const finding of diff.unchanged) {
    const record = openRecords.find((item) => item.fingerprint === finding.fingerprint);
    await store.setFingerprint(recordKey(projectKey, finding.fingerprint), { ...record, line: finding.line, lastSeenAt: timestamp });
  }

  const findings = (report.findings ?? []).map((finding) => storedFinding(finding, issueKeys.get(finding.fingerprint) ?? null));
  await store.setLatestScan(projectKey, fitLatestScan({
    repoUrl,
    source,
    commit,
    commitTime,
    receivedAt: timestamp,
    meta: report.meta ?? {},
    summary: report.summary,
    delta: summarizeDelta(previousScan, report),
    previousSummary: previousScan?.summary ?? null,
    result: { created: result.created, resolved: result.resolved, unchanged: result.unchanged, errors: result.errors.length }
  }, findings));

  await setLastScan(store, repo, {
    at: timestamp,
    source,
    commit,
    status: result.errors.length ? 'partial' : 'ok',
    score: report.summary?.score ?? null,
    grade: report.summary?.grade ?? null,
    created: result.created,
    resolved: result.resolved,
    unchanged: result.unchanged,
    errors: result.errors.length
  });

  return result;
}

// Writes only the per-project lastScan key, so settings saved while a scan runs are never overwritten.
export async function setLastScan(store, { repoUrl, projectKey }, lastScan) {
  const repos = (await store.getConfig('repos')) ?? [];
  if (!repos.some((repo) => repo.repoUrl === repoUrl && repo.projectKey === projectKey)) return;
  await store.setConfig(lastScanKey(projectKey), lastScan);
}

function safeMessage(error) {
  return error?.status ? `Jira request failed with HTTP ${error.status}` : 'Jira request failed';
}
