import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ISSUE_SEVERITIES, buildIssuePayload, diffReports, extractFingerprint, summarizeDelta, validateReport
} from '../src/ingest.js';

const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const scanA = load('scan-a.json');
const scanB = load('scan-b.json');
const eligible = (report) => report.findings.filter((finding) => ISSUE_SEVERITIES.has(finding.severity));
const fingerprints = (findings) => findings.map((finding) => finding.fingerprint).sort();

test('empty previous state creates every critical and high finding', () => {
  const diff = diffReports([], scanA);
  assert.deepEqual(fingerprints(diff.toCreate), fingerprints(eligible(scanA)));
  assert.equal(diff.toCreate.length, 5);
  assert.deepEqual(diff.toResolve, []);
  assert.deepEqual(diff.unchanged, []);
});

test('identical scan leaves every issue unchanged', () => {
  const previous = eligible(scanA).map((finding) => finding.fingerprint);
  const diff = diffReports(previous, scanA);
  assert.deepEqual(diff.toCreate, []);
  assert.deepEqual(diff.toResolve, []);
  assert.equal(diff.unchanged.length, 5);
});

test('fingerprints missing from the new scan are resolved', () => {
  const previous = eligible(scanA).map((finding) => ({ fingerprint: finding.fingerprint }));
  const fixed = { ...scanA, findings: scanA.findings.filter((finding) => finding.ruleId !== 'SEC001') };
  const diff = diffReports(previous, fixed);
  assert.deepEqual(diff.toResolve, ['3312544839d17cc7']);
  assert.deepEqual(diff.toCreate, []);
  assert.equal(diff.unchanged.length, 4);
});

test('medium and low findings never create issues', () => {
  const report = {
    ...scanA,
    findings: [
      ...scanA.findings.filter((finding) => finding.severity === 'medium'),
      { ...scanA.findings[0], fingerprint: 'aaaaaaaaaaaaaaaa', severity: 'low' }
    ]
  };
  const diff = diffReports([], report);
  assert.deepEqual(diff.toCreate, []);
  assert.deepEqual(diff.unchanged, []);
});

test('a line shift resolves the old fingerprint and creates a new one', () => {
  const previous = eligible(scanA).map((finding) => finding.fingerprint);
  const diff = diffReports(previous, scanB);
  assert.deepEqual(diff.toCreate.map((finding) => `${finding.ruleId}:${finding.line}`).sort(), ['SEC003:14', 'SEC005:18']);
  assert.deepEqual(diff.toResolve.sort(), ['3312544839d17cc7', '7c7f3e8d9a19a095', 'cf741b0f32dab763']);
  assert.deepEqual(diff.unchanged.map((finding) => finding.ruleId).sort(), ['SEC004', 'SEC006']);
});

test('duplicate fingerprints in one report produce a single issue', () => {
  const report = { ...scanA, findings: [scanA.findings[0], scanA.findings[0]] };
  assert.equal(diffReports([], report).toCreate.length, 1);
});

test('issue payload carries summary, location, labels and fingerprint footer', () => {
  const finding = scanA.findings[0];
  const payload = buildIssuePayload(finding);
  assert.equal(payload.summary, '[CRITICAL] SEC001: Possible hard-coded secret in server.js');
  assert.deepEqual(payload.labels, ['codesentinel', 'sec-SEC001', 'sev-critical']);
  assert.match(payload.description, /server\.js:5:7/);
  assert.match(payload.description, /\[REDACTED\]/);
  assert.match(payload.description, new RegExp(finding.remediation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(payload.description.trimEnd().endsWith(`codesentinel-fp:${finding.fingerprint}`));
  assert.equal(extractFingerprint(payload.description), finding.fingerprint);
});

test('fingerprint footer wins over a marker inside the excerpt', () => {
  const finding = { ...scanA.findings[0], excerpt: '// codesentinel-fp:ffffffffffffffff' };
  assert.equal(extractFingerprint(buildIssuePayload(finding).description), finding.fingerprint);
});

test('issue summary is capped at the Jira limit', () => {
  const payload = buildIssuePayload({ ...scanA.findings[0], file: `${'a/'.repeat(200)}x.js` });
  assert.equal(payload.summary.length, 255);
});

test('delta compares score, severity counts and fingerprints', () => {
  const delta = summarizeDelta(scanA, scanB);
  assert.equal(delta.hasPrevious, true);
  assert.equal(delta.scoreDelta, 20);
  assert.equal(delta.totalDelta, -1);
  assert.deepEqual(delta.severityDeltas, { critical: -1, high: 0, medium: 0, low: 0 });
  assert.equal(delta.newFindings, 3);
  assert.equal(delta.fixedFindings, 4);
  assert.equal(summarizeDelta(null, scanA).hasPrevious, false);
  const duplicated = { ...scanA, findings: [scanA.findings[0], scanA.findings[0]] };
  assert.equal(summarizeDelta(null, duplicated).newFindings, 1);
});

test('report validation accepts scanner output and rejects malformed bodies', () => {
  assert.equal(validateReport(scanA), null);
  assert.match(validateReport([]), /object/);
  assert.match(validateReport({ summary: { score: 1 }, findings: [{ fingerprint: 'nope' }] }), /fingerprint/);
});
