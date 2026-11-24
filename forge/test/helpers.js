import { mkdtemp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStore } from '../../src/store/fileStore.js';

export async function tempStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'codesentinel-forge-'));
  return createFileStore(path.join(dir, 'store.json'));
}

export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8'));
}

export function fakeJira({ failCreateFor = new Set(), existing = new Map() } = {}) {
  let next = 1;
  const jira = {
    created: [],
    comments: [],
    transitioned: [],
    async findIssueByFingerprint(projectKey, fingerprint) {
      return existing.get(fingerprint) ?? null;
    },
    async createIssue(projectKey, payload) {
      const fingerprint = /codesentinel-fp:([0-9a-f]{16})/.exec(payload.description)[1];
      if (failCreateFor.has(fingerprint)) throw Object.assign(new Error('boom: secret request body'), { status: 400 });
      const issue = { issueId: String(10000 + next), issueKey: `${projectKey}-${next}` };
      next += 1;
      jira.created.push({ ...issue, payload });
      return issue;
    },
    async addComment(issueKey, text) {
      jira.comments.push({ issueKey, text });
    },
    async transitionToDone(issueKey) {
      jira.transitioned.push(issueKey);
      return true;
    }
  };
  return jira;
}

export const REPO = {
  repoUrl: 'https://github.com/Hrithik028/codesentinel-demo',
  projectKey: 'SEC',
  issueType: 'Bug'
};

// FileStore plus the Forge-only PAT secret methods.
export async function tempForgeLikeStore() {
  const store = await tempStore();
  const pats = new Map();
  store.pats = pats;
  store.getPat = async (repoUrl) => pats.get(repoUrl) ?? null;
  store.setPat = async (repoUrl, pat) => { if (pat) pats.set(repoUrl, pat); else pats.delete(repoUrl); };
  return store;
}

export function fakeGitHub(files, { commit = 'c0ffee0000000000000000000000000000000000' } = {}) {
  const calls = { blobs: 0, lists: 0 };
  return {
    calls,
    async resolveHead() { return { branch: 'main', commit }; },
    async listScannableFiles() {
      calls.lists += 1;
      const { selectFiles } = await import('../src/github.js');
      return { truncatedTree: false, ...selectFiles(files.map((f) => ({ type: 'blob', path: f.path, sha: f.path, size: Buffer.byteLength(f.content) }))) };
    },
    async fetchBlob(owner, repo, sha) {
      calls.blobs += 1;
      return files.find((f) => f.path === sha).content;
    }
  };
}
