import { buildIssuePayload, diffReports, summarizeDelta } from './shared/ingest.js';

export const MAX_STORED_FINDINGS = 200;

const SECRET_RULE = 'SEC001';
const RESOLVE_COMMENT = 'CodeSentinel no longer detects this finding on the latest scan, so it was transitioned to Done.';

// Shared pipeline for CI-pushed and app-side reports. Store and Jira client are injected so the
// pipeline runs against the file store and a fake Jira in tests.
// Only the secret rule redacts its excerpt; another rule matching the same line would expose the value.
export function redactSecretLines(report) {
  const secretExcerpts = new Map();
  for (const finding of report.findings ?? []) {
    if (finding.ruleId === SECRET_RULE) secretExcerpts.set(`${finding.file}:${finding.line}`, finding.excerpt);
  }
  return {
    ...report,
    findings: (report.findings ?? []).map((finding) => {
      const redacted = secretExcerpts.get(`${finding.file}:${finding.line}`);
      return redacted !== undefined && finding.ruleId !== SECRET_RULE ? { ...finding, excerpt: redacted } : finding;
    })
  };
}

// Records are keyed per project (one repo per project), so a fork linked to another project
// never overwrites the original repository's tracking record.
export const recordKey = (projectKey, fingerprint) => `${projectKey}:${fingerprint}`;

export async function processReport(rawReport, repo, { source, commit = null, store, jira, now = () => new Date().toISOString() }) {
  const report = redactSecretLines(rawReport);
  const { repoUrl, projectKey } = repo;
  const timestamp = now();
  const records = (await store.allFingerprintRecords()).filter((record) => record.repoUrl === repoUrl && record.projectKey === projectKey);
  const openRecords = records.filter((record) => record.status === 'open');
  const diff = diffReports(openRecords, report);
  const result = { created: 0, resolved: 0, unchanged: diff.unchanged.length, errors: [] };
  const issueKeys = new Map(openRecords.map((record) => [record.fingerprint, record.issueKey]));

  for (const finding of diff.toCreate) {
    try {
      const issue = await jira.findIssueByFingerprint(projectKey, finding.fingerprint)
        ?? await jira.createIssue(projectKey, buildIssuePayload(finding), repo.issueType ?? 'Bug');
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

  // A scan that stopped at the file cap (or a truncated GitHub tree) can't prove a finding is gone.
  const partial = report.meta?.hitFileLimit === true;
  for (const fingerprint of partial ? [] : diff.toResolve) {
    const record = openRecords.find((item) => item.fingerprint === fingerprint);
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

  const previousScan = await store.getLatestScan(projectKey);
  const findings = (report.findings ?? []).map((finding) => ({ ...finding, issueKey: issueKeys.get(finding.fingerprint) ?? null }));
  await store.setLatestScan(projectKey, {
    repoUrl,
    source,
    commit,
    receivedAt: timestamp,
    meta: report.meta ?? {},
    summary: report.summary,
    findings: findings.slice(0, MAX_STORED_FINDINGS),
    truncated: findings.length > MAX_STORED_FINDINGS,
    delta: summarizeDelta(previousScan, report),
    previousSummary: previousScan?.summary ?? null,
    result: { created: result.created, resolved: result.resolved, unchanged: result.unchanged, errors: result.errors.length }
  });

  await updateRepoLastScan(store, repoUrl, {
    at: timestamp,
    source,
    commit,
    status: result.errors.length ? 'partial' : 'ok',
    created: result.created,
    resolved: result.resolved,
    unchanged: result.unchanged,
    errors: result.errors.length
  });

  return result;
}

async function updateRepoLastScan(store, repoUrl, lastScan) {
  const repos = (await store.getConfig('repos')) ?? [];
  if (!repos.some((repo) => repo.repoUrl === repoUrl)) return;
  await store.setConfig('repos', repos.map((repo) => (repo.repoUrl === repoUrl ? { ...repo, lastScan } : repo)));
}

// Jira error messages may echo request content; only the operation and HTTP status are surfaced.
function safeMessage(error) {
  return error?.status ? `Jira request failed with HTTP ${error.status}` : 'Jira request failed';
}
