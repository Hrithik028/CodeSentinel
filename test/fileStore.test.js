import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFileStore } from '../src/store/fileStore.js';

async function withStore(callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codesentinel-store-'));
  try {
    await callback(createFileStore(path.join(directory, 'nested', 'store.json')), directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('missing store file reads as empty', async () => {
  await withStore(async (store) => {
    assert.equal(await store.getFingerprint('0123456789abcdef'), null);
    assert.deepEqual(await store.allFingerprintRecords(), []);
    assert.equal(await store.getLatestScan('SEC'), null);
    assert.equal(await store.getConfig('repos'), null);
  });
});

test('fingerprint records, scans and config persist across instances', async () => {
  await withStore(async (store, directory) => {
    await store.setFingerprint('0123456789abcdef', { issueKey: 'SEC-1', status: 'open' });
    await store.setLatestScan('SEC', { summary: { score: 80 } });
    await store.setConfig('repos', [{ repoUrl: 'https://github.com/o/r', projectKey: 'SEC' }]);

    const reopened = createFileStore(path.join(directory, 'nested', 'store.json'));
    assert.deepEqual(await reopened.getFingerprint('0123456789abcdef'), {
      issueKey: 'SEC-1', status: 'open', fingerprint: '0123456789abcdef'
    });
    assert.equal((await reopened.allFingerprintRecords()).length, 1);
    assert.equal((await reopened.getLatestScan('SEC')).summary.score, 80);
    assert.equal((await reopened.getConfig('repos'))[0].projectKey, 'SEC');
  });
});

test('concurrent writes are serialised without losing records', async () => {
  await withStore(async (store) => {
    await Promise.all(Array.from({ length: 20 }, (_, index) =>
      store.setFingerprint(index.toString(16).padStart(16, '0'), { issueKey: `SEC-${index}` })));
    assert.equal((await store.allFingerprintRecords()).length, 20);
  });
});

test('scan state can be saved and cleared', async () => {
  await withStore(async (store) => {
    await store.setScanState('https://github.com/o/r', { cursor: 40 });
    assert.deepEqual(await store.getScanState('https://github.com/o/r'), { cursor: 40 });
    await store.setScanState('https://github.com/o/r', null);
    assert.equal(await store.getScanState('https://github.com/o/r'), null);
  });
});
