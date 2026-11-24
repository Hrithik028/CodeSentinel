import assert from 'node:assert/strict';
import test from 'node:test';
import { generateToken, hashToken, normalizeRepo, tokenMatches } from '../src/repos.js';
import { adfToText, textToAdf } from '../src/adf.js';
import { buildIssuePayload, extractFingerprint } from '../src/shared/ingest.js';
import { fixture } from './helpers.js';

test('tokens are random and compared by hash', () => {
  const token = generateToken();
  assert.match(token, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(token, generateToken());
  assert.equal(tokenMatches(token, hashToken(token)), true);
  assert.equal(tokenMatches('nope', hashToken(token)), false);
  assert.equal(tokenMatches(undefined, hashToken(token)), false);
  assert.equal(tokenMatches(token, undefined), false);
});

test('normalizes GitHub repository identifiers', () => {
  assert.equal(normalizeRepo('Hrithik028/codesentinel-demo').repoUrl, 'https://github.com/Hrithik028/codesentinel-demo');
  assert.equal(normalizeRepo('https://github.com/a/b.git/').repoUrl, 'https://github.com/a/b');
  assert.equal(normalizeRepo('https://gitlab.com/a/b'), null);
  assert.equal(normalizeRepo('a/b/c'), null);
  assert.equal(normalizeRepo(''), null);
});

test('issue description survives the ADF round trip with its fingerprint', () => {
  const finding = fixture('scan-a.json').findings[0];
  const adf = textToAdf(buildIssuePayload(finding).description);
  assert.equal(adf.type, 'doc');
  assert.ok(adf.content.some((node) => node.type === 'codeBlock'));
  assert.equal(extractFingerprint(adfToText(adf)), finding.fingerprint);
});

test('pickIssueType falls back when the project has no Bug type', async () => {
  const { pickIssueType } = await import('../src/jira.js');
  const types = [{ id: '1', name: 'Epic', hierarchyLevel: 1 }, { id: '2', name: 'Sub-task', subtask: true }, { id: '3', name: 'Story', hierarchyLevel: 0 }, { id: '4', name: 'Task', hierarchyLevel: 0 }];
  assert.equal(pickIssueType([...types, { id: '5', name: 'Bug' }], 'bug').id, '5');
  assert.equal(pickIssueType(types, 'Bug').id, '4');
  assert.equal(pickIssueType(types.filter((t) => t.name !== 'Task'), 'Bug').id, '3');
  assert.equal(pickIssueType(types, '3').id, '3');
  assert.equal(pickIssueType([], 'Bug'), null);
});

test('clearing the PAT clears the checkpoint; lastScan lives outside the repos list', async () => {
  const { createConfigService } = await import('../src/configService.js');
  const { tempForgeLikeStore } = await import('./helpers.js');
  const store = await tempForgeLikeStore();
  const config = createConfigService({ store });
  await config.saveRepo('SEC', { repoUrl: 'https://github.com/Hrithik028/codesentinel-demo', pat: 'github_pat_x' });
  await store.setScanState('https://github.com/Hrithik028/codesentinel-demo', { runId: 'r1' });
  await store.setConfig('lastScan:SEC', { status: 'ok', score: 90 });

  assert.equal((await config.getProjectConfig('SEC')).lastScan.score, 90);
  await config.clearPat('SEC');
  assert.equal(await store.getScanState('https://github.com/Hrithik028/codesentinel-demo'), null);
  await config.saveRepo('SEC', { repoUrl: 'https://github.com/Hrithik028/other' });
  assert.equal(await store.getConfig('lastScan:SEC'), null);
});
