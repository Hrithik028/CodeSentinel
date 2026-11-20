import assert from 'node:assert/strict';
import test from 'node:test';
import { processReport, MAX_STORED_FINDINGS, recordKey } from '../src/processReport.js';
import { fakeJira, fixture, REPO, tempStore } from './helpers.js';

const eligible = (report) => new Set(report.findings.filter((f) => ['critical', 'high'].includes(f.severity)).map((f) => f.fingerprint)).size;

test('first report creates one issue per critical/high finding and stores the latest scan', async () => {
  const store = await tempStore();
  await store.setConfig('repos', [REPO]);
  const jira = fakeJira();
  const report = fixture('scan-a.json');

  const result = await processReport(report, REPO, { source: 'ci', commit: 'abc1234', store, jira });

  assert.equal(result.created, eligible(report));
  assert.deepEqual({ resolved: result.resolved, unchanged: result.unchanged, errors: result.errors }, { resolved: 0, unchanged: 0, errors: [] });
  assert.ok(jira.created.every((issue) => issue.payload.labels.includes('codesentinel')));
  const latest = await store.getLatestScan('SEC');
  assert.equal(latest.source, 'ci');
  assert.equal(latest.findings.filter((f) => f.issueKey).length, result.created);
  assert.ok(latest.findings.filter((f) => ['medium', 'low'].includes(f.severity)).every((f) => f.issueKey === null));
  assert.equal((await store.getConfig('repos'))[0].lastScan.created, result.created);
});

test('re-sending the same report is idempotent', async () => {
  const store = await tempStore();
  const jira = fakeJira();
  const report = fixture('scan-a.json');
  await processReport(report, REPO, { source: 'ci', store, jira });
  const second = await processReport(report, REPO, { source: 'ci', store, jira });

  assert.deepEqual(second, { created: 0, resolved: 0, unchanged: eligible(report), errors: [] });
  assert.equal(jira.created.length, eligible(report));
  assert.equal((await store.getLatestScan('SEC')).delta.newFindings, 0);
});

test('fixed and line-shifted findings are resolved, shifted ones re-created', async () => {
  const store = await tempStore();
  const jira = fakeJira();
  const first = await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira });
  const second = await processReport(fixture('scan-b.json'), REPO, { source: 'app', store, jira });

  assert.ok(second.resolved >= 1);
  assert.equal(jira.transitioned.length, second.resolved);
  assert.equal(jira.comments.length, second.resolved);
  assert.equal(second.created + second.unchanged, eligible(fixture('scan-b.json')));
  const records = await store.allFingerprintRecords();
  assert.equal(records.filter((r) => r.status === 'resolved').length, second.resolved);
  assert.equal(records.length, first.created + second.created);
  assert.equal((await store.getLatestScan('SEC')).source, 'app');
});

test('per-issue Jira failures are reported without aborting or leaking messages, then retried', async () => {
  const store = await tempStore();
  const report = fixture('scan-a.json');
  const failing = report.findings.find((f) => f.severity === 'critical').fingerprint;
  const result = await processReport(report, REPO, { source: 'ci', store, jira: fakeJira({ failCreateFor: new Set([failing]) }) });

  assert.equal(result.created, eligible(report) - 1);
  assert.deepEqual(result.errors, [{ fingerprint: failing, operation: 'create', message: 'Jira request failed with HTTP 400' }]);
  assert.equal(await store.getFingerprint(recordKey('SEC', failing)), null);

  const retry = await processReport(report, REPO, { source: 'ci', store, jira: fakeJira() });
  assert.equal(retry.created, 1);
  assert.equal((await store.getConfig('repos')), null);
});

test('an existing open Jira issue is linked instead of duplicated', async () => {
  const store = await tempStore();
  const report = fixture('scan-a.json');
  const fingerprint = report.findings.find((f) => f.severity === 'critical').fingerprint;
  const jira = fakeJira({ existing: new Map([[fingerprint, { issueId: '9', issueKey: 'SEC-9' }]]) });

  await processReport(report, REPO, { source: 'ci', store, jira });

  assert.equal((await store.getFingerprint(recordKey('SEC', fingerprint))).issueKey, 'SEC-9');
  assert.equal(jira.created.length, eligible(report) - 1);
});

test('records from other repos are not resolved', async () => {
  const store = await tempStore();
  await store.setFingerprint('ffffffffffffffff', { repoUrl: 'https://github.com/other/repo', projectKey: 'OTH', issueKey: 'OTH-1', status: 'open' });
  const jira = fakeJira();
  const result = await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira });

  assert.equal(result.resolved, 0);
  assert.equal((await store.getFingerprint('ffffffffffffffff')).status, 'open');
});

test('stored latest scan is capped', async () => {
  const store = await tempStore();
  const base = fixture('scan-a.json');
  const medium = base.findings.find((f) => f.severity === 'medium');
  const findings = Array.from({ length: MAX_STORED_FINDINGS + 5 }, (_, i) => ({ ...medium, fingerprint: i.toString(16).padStart(16, '0') }));
  await processReport({ ...base, findings }, REPO, { source: 'app', store, jira: fakeJira() });

  const latest = await store.getLatestScan('SEC');
  assert.equal(latest.findings.length, MAX_STORED_FINDINGS);
  assert.equal(latest.truncated, true);
});

test('a missing Done transition is an error and keeps the record open', async () => {
  const store = await tempStore();
  await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira: fakeJira() });
  const jira = fakeJira();
  jira.transitionToDone = async () => false;
  const result = await processReport({ ...fixture('scan-a.json'), findings: [] }, REPO, { source: 'ci', store, jira });

  assert.equal(result.resolved, 0);
  assert.ok(result.errors.length > 0 && result.errors.every((e) => e.operation === 'resolve'));
  assert.equal(jira.comments.length, 0);
  assert.ok((await store.allFingerprintRecords()).every((r) => r.status === 'open'));
});

test('a fork linked to another project does not overwrite the original record', async () => {
  const store = await tempStore();
  const fork = { repoUrl: 'https://github.com/someone/codesentinel-demo', projectKey: 'FRK' };
  await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira: fakeJira() });
  await processReport(fixture('scan-a.json'), fork, { source: 'ci', store, jira: fakeJira() });
  const jira = fakeJira();
  const clean = await processReport({ ...fixture('scan-a.json'), findings: [] }, REPO, { source: 'ci', store, jira });

  assert.ok(clean.resolved > 0);
  assert.ok(jira.transitioned.every((key) => key.startsWith('SEC-')));
  const records = await store.allFingerprintRecords();
  assert.ok(records.filter((r) => r.projectKey === 'FRK').every((r) => r.status === 'open'));
});

test('excerpts on a line with a secret are redacted for every rule', async () => {
  const store = await tempStore();
  const base = fixture('scan-a.json');
  const secret = base.findings.find((f) => f.ruleId === 'SEC001');
  const other = { ...base.findings.find((f) => f.severity === 'high'), fingerprint: 'aaaaaaaaaaaaaaaa', file: secret.file, line: secret.line, excerpt: 'leaky "sk_live_raw_value"' };
  const jira = fakeJira();
  await processReport({ ...base, findings: [secret, other] }, REPO, { source: 'ci', store, jira });

  assert.ok(jira.created.every((issue) => !issue.payload.description.includes('sk_live_raw_value')));
  assert.ok(!JSON.stringify(await store.getLatestScan('SEC')).includes('sk_live_raw_value'));
});

test('an issue already closed in Jira resolves the record without a comment', async () => {
  const store = await tempStore();
  await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira: fakeJira() });
  const jira = fakeJira();
  jira.transitionToDone = async () => 'already-done';
  const result = await processReport({ ...fixture('scan-a.json'), findings: [] }, REPO, { source: 'ci', store, jira });

  assert.ok(result.resolved > 0);
  assert.equal(result.errors.length, 0);
  assert.equal(jira.comments.length, 0);
  assert.ok((await store.allFingerprintRecords()).every((r) => r.status === 'resolved'));
});

test('a scan that hit the file limit never resolves issues', async () => {
  const store = await tempStore();
  await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira: fakeJira() });
  const jira = fakeJira();
  const base = fixture('scan-a.json');
  const result = await processReport({ ...base, meta: { ...base.meta, hitFileLimit: true }, findings: [] }, REPO, { source: 'app', store, jira });
  assert.equal(result.resolved, 0);
  assert.equal(jira.transitioned.length, 0);
  assert.ok((await store.allFingerprintRecords()).every((r) => r.status === 'open'));
});
