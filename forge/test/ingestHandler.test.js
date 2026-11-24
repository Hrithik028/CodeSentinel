import assert from 'node:assert/strict';
import test from 'node:test';
import { createIngestHandler, MAX_BODY_BYTES } from '../src/ingestHandler.js';
import { hashToken } from '../src/repos.js';
import { fakeJira, fixture, REPO, tempStore } from './helpers.js';

const TOKEN = 'test-token-123';
const silent = { info() {} };

async function setup() {
  const store = await tempStore();
  await store.setConfig('repos', [{ ...REPO, scanTokenHash: hashToken(TOKEN) }, { repoUrl: 'https://github.com/other/repo', projectKey: 'OTH', scanTokenHash: hashToken('other-token') }]);
  const jira = fakeJira();
  return { store, jira, ingest: createIngestHandler({ store, jira, log: silent }) };
}

function event({ method = 'POST', token = TOKEN, repo = 'Hrithik028/codesentinel-demo', body = JSON.stringify(fixture('scan-a.json')), commit = 'f0389c9c' } = {}) {
  const headers = { 'content-type': ['application/json'] };
  if (token !== null) headers['x-scan-token'] = [token];
  if (repo !== null) headers['x-repo'] = [repo];
  if (commit !== null) headers['x-commit'] = [commit];
  return { method, headers, body };
}

const status = async (ingest, options) => (await ingest(event(options))).statusCode;

test('rejects bad requests with the documented status codes', async () => {
  const { ingest } = await setup();
  assert.equal(await status(ingest, { method: 'GET' }), 405);
  assert.equal(await status(ingest, { body: 'x'.repeat(MAX_BODY_BYTES + 1) }), 413);
  assert.equal(await status(ingest, { token: null }), 401);
  assert.equal(await status(ingest, { token: 'wrong' }), 401);
  assert.equal(await status(ingest, { repo: 'someone/else' }), 404);
  assert.equal(await status(ingest, { token: 'other-token' }), 404);
  assert.equal(await status(ingest, { repo: null }), 404);
  assert.equal(await status(ingest, { body: '{not json' }), 400);
  assert.equal(await status(ingest, { body: JSON.stringify({ summary: {}, findings: [] }) }), 400);
});

test('error responses never echo the request', async () => {
  const { ingest } = await setup();
  const response = await ingest(event({ token: 'leaky-token', body: '{"secret":"value"' }));
  assert.ok(!response.body.includes('leaky-token'));
  const invalid = await ingest(event({ body: '{"secret":"value"' }));
  assert.ok(!invalid.body.includes('secret'));
});

test('accepts a valid report and is idempotent on re-send', async () => {
  const { ingest, store, jira } = await setup();
  const first = await ingest(event({ repo: 'https://github.com/hrithik028/codesentinel-demo.git' }));
  assert.equal(first.statusCode, 200);
  assert.deepEqual(first.headers, { 'Content-Type': ['application/json'] });
  const created = JSON.parse(first.body).created;
  assert.ok(created > 0);

  const second = JSON.parse((await ingest(event())).body);
  assert.deepEqual(second, { created: 0, resolved: 0, unchanged: created, errors: [] });
  assert.equal(jira.created.length, created);
  assert.equal((await store.getLatestScan('SEC')).commit, 'f0389c9c');
});

test('ignores a malformed commit header', async () => {
  const { ingest, store } = await setup();
  await ingest(event({ commit: '<script>' }));
  assert.equal((await store.getLatestScan('SEC')).commit, null);
});
