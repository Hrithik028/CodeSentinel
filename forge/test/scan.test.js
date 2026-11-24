import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createGitHubClient, selectFiles, MAX_FILES, MAX_FILE_BYTES } from '../src/github.js';
import { runScanStep } from '../src/scan.js';
import { processReport } from '../src/processReport.js';
import { scanDirectory } from '../src/shared/scanner.js';
import { fakeGitHub, fakeJira, fixture, REPO, tempForgeLikeStore } from './helpers.js';

const sampleDir = new URL('../../samples/vulnerable-app/', import.meta.url);
const sampleFiles = readdirSync(sampleDir).map((name) => ({ path: name, content: readFileSync(new URL(name, sampleDir), 'utf8') }));

test('selectFiles filters by extension, ignored dirs and size, and caps the count', () => {
  const { files, skipped, hitFileLimit } = selectFiles([
    { type: 'blob', path: 'src/app.js', sha: 'a', size: 10 },
    { type: 'blob', path: 'node_modules/x/index.js', sha: 'b', size: 10 },
    { type: 'blob', path: 'README.md', sha: 'c', size: 10 },
    { type: 'tree', path: 'src', sha: 'd' },
    { type: 'blob', path: 'big.js', sha: 'e', size: MAX_FILE_BYTES + 1 }
  ]);
  assert.deepEqual(files.map((f) => f.path), ['src/app.js']);
  assert.deepEqual(skipped, [{ path: 'big.js', reason: 'file-too-large' }]);
  assert.equal(hitFileLimit, false);

  const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({ type: 'blob', path: `f${i}.js`, sha: String(i), size: 1 }));
  const capped = selectFiles(many);
  assert.equal(capped.files.length, MAX_FILES);
  assert.equal(capped.hitFileLimit, true);
});

test('app scan of the sample matches the CLI scan and creates issues with source=app', async () => {
  const store = await tempForgeLikeStore();
  const jira = fakeJira();
  const step = await runScanStep(REPO, { store, jira, github: fakeGitHub(sampleFiles) });
  const cli = await scanDirectory(new URL(sampleDir).pathname);

  assert.equal(step.status, 'completed');
  const latest = await store.getLatestScan('SEC');
  assert.equal(latest.source, 'app');
  assert.equal(latest.summary.score, cli.summary.score);
  assert.deepEqual(latest.summary.severityCounts, cli.summary.severityCounts);
  assert.deepEqual(latest.findings.map((f) => f.fingerprint).sort(), cli.findings.map((f) => f.fingerprint).sort());
  assert.deepEqual(latest.findings.map(({ issueKey, ...f }) => f).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
    cli.findings.map(({ remediation, ...f }) => f).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)));
  assert.equal(step.result.created, cli.summary.severityCounts.critical + cli.summary.severityCounts.high);
  assert.equal(await store.getScanState(REPO.repoUrl), null);
});

test('a scan over budget checkpoints, resumes and produces the same result', async () => {
  const files = Array.from({ length: 45 }, (_, i) => ({ path: `f${i}.js`, content: i === 30 ? 'eval(userInput)\n' : 'const x = 1;\n' }));
  const store = await tempForgeLikeStore();
  const github = fakeGitHub(files);
  let ticks = 0;
  const clock = () => (ticks += 10);

  const first = await runScanStep(REPO, { store, jira: fakeJira(), github, clock, budgetMs: 25 });
  assert.equal(first.status, 'continued');
  const checkpoint = await store.getScanState(REPO.repoUrl);
  assert.equal(checkpoint.runId, first.runId);
  assert.ok(checkpoint.cursor > 0 && checkpoint.cursor < files.length);

  let step = first;
  while (step.status === 'continued') step = await runScanStep(REPO, { store, jira: fakeJira(), github, runId: step.runId, clock, budgetMs: 25 });
  assert.equal(step.status, 'completed');
  assert.equal(github.calls.blobs, files.length);
  const latest = await store.getLatestScan('SEC');
  assert.equal(latest.meta.scannedFiles, files.length);
  assert.equal(latest.findings.length, 1);
});

test('a stale run is superseded', async () => {
  const store = await tempForgeLikeStore();
  const step = await runScanStep(REPO, { store, jira: fakeJira(), github: fakeGitHub(sampleFiles), runId: 'old' });
  assert.equal(step.status, 'superseded');
});

test('binary content is skipped', async () => {
  const store = await tempForgeLikeStore();
  await runScanStep(REPO, { store, jira: fakeJira(), github: fakeGitHub([{ path: 'x.js', content: 'eval(a)\u0000' }]) });
  const latest = await store.getLatestScan('SEC');
  assert.equal(latest.findings.length, 0);
  assert.deepEqual(latest.meta.skippedFiles, 1);
});

test('GitHub client sends the PAT only in the Authorization header and decodes base64 blobs', async () => {
  const requests = [];
  const fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/git/blobs/abc')) return { ok: true, json: async () => ({ encoding: 'base64', content: Buffer.from('hello').toString('base64') }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const client = createGitHubClient({ fetch, pat: 'ghp_secret' });
  assert.equal(await client.fetchBlob('o', 'r', 'abc'), 'hello');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer ghp_secret');
  assert.ok(!requests[0].url.includes('ghp_secret'));
  await assert.rejects(client.resolveHead('o', 'r'), (error) => error.status === 404 && !error.message.includes('ghp_secret'));
});

test('a run replaced mid-scan does not publish its results', async () => {
  const store = await tempForgeLikeStore();
  const github = fakeGitHub(sampleFiles);
  const original = github.fetchBlob;
  github.fetchBlob = async (...args) => {
    await store.setScanState(REPO.repoUrl, { runId: 'newer', commit: 'x', cursor: 0, findings: [] });
    return original(...args);
  };
  const step = await runScanStep(REPO, { store, jira: fakeJira(), github });
  assert.equal(step.status, 'superseded');
  assert.equal(await store.getLatestScan('SEC'), null);
  assert.equal((await store.getScanState(REPO.repoUrl)).runId, 'newer');
});

test('checkpoints never hold a raw secret, even in other rules\' excerpts', async () => {
  const line = 'fetch("http://api.example.com", { token: "tok_live_raw_value_1", password: "second_raw_value_2" })\n';
  const files = Array.from({ length: 45 }, (_, i) => ({ path: `f${i}.js`, content: i < 5 ? line : 'const x = 1;\n' }));
  const store = await tempForgeLikeStore();
  const writes = [];
  const setScanState = store.setScanState.bind(store);
  store.setScanState = async (key, value) => { writes.push(JSON.stringify(value)); return setScanState(key, value); };
  let ticks = 0;
  const step = await runScanStep(REPO, { store, jira: fakeJira(), github: fakeGitHub(files), clock: () => (ticks += 10), budgetMs: 25 });

  assert.equal(step.status, 'continued');
  assert.ok(writes.some((w) => w.includes('[REDACTED]')));
  assert.ok(writes.every((w) => !w.includes('tok_live_raw_value_1') && !w.includes('second_raw_value_2')));
});

test('app scans record the commit time used to order reports', async () => {
  const store = await tempForgeLikeStore();
  const github = { ...fakeGitHub(sampleFiles), resolveHead: async () => ({ branch: 'main', commit: 'c0ffee', commitTime: '2026-11-20T00:00:00Z' }) };
  await runScanStep(REPO, { store, jira: fakeJira(), github });
  assert.equal((await store.getLatestScan('SEC')).commitTime, '2026-11-20T00:00:00Z');
});

test('an app scan whose commit is no longer the head cannot override a newer report', async () => {
  for (const [moved, stale] of [[true, true], [false, undefined]]) {
    const store = await tempForgeLikeStore();
    await processReport({ ...fixture('scan-a.json'), findings: [] }, REPO, { source: 'ci', commitTime: '2026-11-21T00:00:00Z', store, jira: fakeJira() });
    let calls = 0;
    const github = { ...fakeGitHub(sampleFiles), resolveHead: async () => ({ branch: 'main', commit: moved && calls++ > 0 ? 'beef' : 'c0ffee', commitTime: '2026-11-20T00:00:00Z' }) };
    const step = await runScanStep(REPO, { store, jira: fakeJira(), github });
    assert.equal(step.result.stale, stale);
  }
});
