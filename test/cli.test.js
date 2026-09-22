import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(currentDirectory, '../src/cli.js');

async function runFixture(source) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codesentinel-cli-'));
  try {
    await fs.writeFile(path.join(directory, 'app.js'), source);
    return spawnSync(process.execPath, [cliPath, directory], { encoding: 'utf8' });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('CLI returns zero for a scan without high or critical findings', async () => {
  const result = await runFixture(`export const add = (a, b) => a + b;`);
  assert.equal(result.status, 0);
});

test('CLI returns one when the highest finding is high severity', async () => {
  const result = await runFixture(`document.body.innerHTML = userInput;`);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /\[HIGH\]/);
});

test('CLI returns two when a critical finding exists', async () => {
  const result = await runFixture(`const value = eval(userInput);`);
  assert.equal(result.status, 2);
  assert.match(result.stdout, /\[CRITICAL\]/);
});

test('CLI returns three when the target cannot be scanned', () => {
  const missingPath = path.join(os.tmpdir(), `codesentinel-missing-${Date.now()}`);
  const result = spawnSync(process.execPath, [cliPath, missingPath], { encoding: 'utf8' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /could not scan the target/i);
});
