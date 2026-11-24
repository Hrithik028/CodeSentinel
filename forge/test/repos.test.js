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
