import assert from 'node:assert/strict';
import test from 'node:test';
import { createResolvers } from '../src/resolvers.js';
import { hashToken } from '../src/repos.js';
import { tempForgeLikeStore } from './helpers.js';

async function setup({ admin = true, browse = true } = {}) {
  const store = await tempForgeLikeStore();
  const pushed = [];
  const resolvers = createResolvers({
    store,
    queue: { push: async (event) => pushed.push(event) },
    canAdminister: async () => admin,
    canBrowse: async () => browse,
    ingestUrl: async () => 'https://example.atlassian-dev.net/x1/ingest'
  });
  return { store, pushed, resolvers };
}

const ctx = { extension: { project: { key: 'SEC' } } };

test('saving a repo returns the scan token once and stores only its hash and hasPat', async () => {
  const { store, resolvers } = await setup();
  const saved = await resolvers.saveRepo({ payload: { repoUrl: 'Hrithik028/codesentinel-demo', pat: 'ghp_x', llmOptIn: true }, context: ctx });
  assert.match(saved.scanToken, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(saved.repo.repoUrl, 'https://github.com/Hrithik028/codesentinel-demo');
  assert.equal(saved.repo.hasPat, true);
  assert.equal(saved.repo.scanTokenHash, undefined);

  const [stored] = await store.getConfig('repos');
  assert.equal(stored.scanTokenHash, hashToken(saved.scanToken));
  assert.ok(!JSON.stringify(stored).includes('ghp_x'));
  assert.equal(store.pats.get(stored.repoUrl), 'ghp_x');

  const again = await resolvers.saveRepo({ payload: { repoUrl: 'https://github.com/Hrithik028/codesentinel-demo' }, context: ctx });
  assert.equal(again.scanToken, null);
  assert.equal(again.repo.hasPat, true);

  const config = await resolvers.getConfig({ payload: {}, context: ctx });
  assert.ok(!JSON.stringify(config).includes('ghp_x'));
  assert.ok(!JSON.stringify(config).includes(stored.scanTokenHash));
  assert.equal(config.ingestUrl, 'https://example.atlassian-dev.net/x1/ingest');
});

test('rotating the token invalidates the old hash', async () => {
  const { store, resolvers } = await setup();
  const { scanToken } = await resolvers.saveRepo({ payload: { repoUrl: 'a/b' }, context: ctx });
  const rotated = await resolvers.rotateScanToken({ payload: {}, context: ctx });
  const [stored] = await store.getConfig('repos');
  assert.notEqual(rotated.scanToken, scanToken);
  assert.equal(stored.scanTokenHash, hashToken(rotated.scanToken));
});

test('changing the linked repo drops the old PAT and issues a new token', async () => {
  const { store, resolvers } = await setup();
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b', pat: 'ghp_1' }, context: ctx });
  const changed = await resolvers.saveRepo({ payload: { repoUrl: 'a/c' }, context: ctx });
  assert.ok(changed.scanToken);
  assert.equal(changed.repo.hasPat, false);
  assert.equal(store.pats.size, 0);
});

test('validates input and refuses a repo linked to another project', async () => {
  const { resolvers } = await setup();
  await assert.rejects(resolvers.saveRepo({ payload: { repoUrl: 'https://gitlab.com/a/b' }, context: ctx }), /GitHub repository/);
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b' }, context: ctx });
  await assert.rejects(resolvers.saveRepo({ payload: { repoUrl: 'a/b' }, context: { extension: { project: { key: 'OTH' } } } }), /already linked to project SEC/);
});

test('non-admins cannot read or change config', async () => {
  const { resolvers } = await setup({ admin: false });
  await assert.rejects(resolvers.getConfig({ payload: {}, context: ctx }), /administrators/);
  await assert.rejects(resolvers.saveRepo({ payload: { repoUrl: 'a/b' }, context: ctx }), /administrators/);
  await assert.rejects(resolvers.scanNow({ payload: {}, context: ctx }), /administrators/);
});

test('scan now requires a PAT and queues an event', async () => {
  const { pushed, resolvers } = await setup();
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b' }, context: ctx });
  await assert.rejects(resolvers.scanNow({ payload: {}, context: ctx }), /GitHub token/);
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b', pat: 'ghp_1' }, context: ctx });
  assert.deepEqual(await resolvers.scanNow({ payload: {}, context: ctx }), { queued: true });
  assert.deepEqual(pushed, [{ body: { repoUrl: 'https://github.com/a/b' } }]);
});

test('posture respects browse permission and reports unconfigured gadgets', async () => {
  const { resolvers } = await setup({ browse: false });
  assert.deepEqual(await resolvers.getPosture({ payload: {}, context: {} }), { configured: false });
  await assert.rejects(resolvers.getPosture({ payload: { projectKey: 'SEC' }, context: {} }), /access/);
});

test('saving without issueType keeps the stored issue type', async () => {
  const { store, resolvers } = await setup();
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b', issueType: 'Vulnerability' }, context: ctx });
  await resolvers.saveRepo({ payload: { repoUrl: 'a/b', llmOptIn: true }, context: ctx });
  const [stored] = await store.getConfig('repos');
  assert.equal(stored.issueType, 'Vulnerability');
  assert.equal(stored.llmOptIn, true);
});
||||||| a5e3384

test('a case-only repo edit keeps the PAT reachable', async () => {
  const { store, resolvers } = await setup();
  await resolvers.saveRepo({ payload: { repoUrl: 'Alice/Repo', pat: 'ghp_1' }, context: ctx });
  const saved = await resolvers.saveRepo({ payload: { repoUrl: 'alice/repo' }, context: ctx });
  assert.equal(saved.repo.hasPat, true);
  assert.equal(await store.getPat(saved.repo.repoUrl), 'ghp_1');
});
