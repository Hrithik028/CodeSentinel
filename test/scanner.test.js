import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { scanDirectory } from '../src/scanner.js';

async function withFixture(files, callback) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codesentinel-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(directory, name);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }
    await callback(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test('detects high-risk patterns and returns locations', async () => {
  await withFixture({
    'app.js': `const password = 'super-secret-password';\nconst result = eval(userInput);\n`
  }, async (directory) => {
    const report = await scanDirectory(directory);
    assert.equal(report.summary.totalFindings, 2);
    assert.equal(report.summary.severityCounts.critical, 2);
    assert.deepEqual(report.findings.map((item) => item.ruleId).sort(), ['SEC001', 'SEC002']);
    assert.equal(report.findings[0].file, 'app.js');
    assert.ok(report.findings.every((item) => item.line > 0));
  });
});

test('redacts secrets from report excerpts', async () => {
  await withFixture({ 'config.js': `const apiKey = 'abcdefghijk123456';` }, async (directory) => {
    const report = await scanDirectory(directory);
    assert.equal(report.findings.length, 1);
    assert.match(report.findings[0].excerpt, /\[REDACTED\]/);
    assert.doesNotMatch(report.findings[0].excerpt, /abcdefghijk/);
  });
});

test('ignores dependency folders and unsupported files', async () => {
  await withFixture({
    'safe.js': `const greeting = 'hello';`,
    'notes.txt': `password = 'this-should-not-be-scanned';`,
    'node_modules/package/index.js': `eval('ignored')`
  }, async (directory) => {
    const report = await scanDirectory(directory);
    assert.equal(report.summary.totalFindings, 0);
    assert.equal(report.meta.scannedFiles, 1);
  });
});

test('produces a perfect score for a clean project', async () => {
  await withFixture({ 'safe.js': `export const add = (a, b) => a + b;` }, async (directory) => {
    const report = await scanDirectory(directory);
    assert.equal(report.summary.score, 100);
    assert.equal(report.summary.grade, 'A');
  });
});
