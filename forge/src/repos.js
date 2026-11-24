import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Last-scan status lives under its own key so scans never rewrite the shared repos list.
// Footer line in issue descriptions naming the repo a finding came from; used to scope JQL matches.
export const REPO_MARKER = 'codesentinel-repo: ';

export const lastScanKey = (projectKey) => `lastScan:${projectKey}`;

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function generateToken() {
  return randomBytes(24).toString('base64url');
}

export function tokenMatches(token, expectedHash) {
  if (typeof token !== 'string' || !token || typeof expectedHash !== 'string' || expectedHash.length !== 64) return false;
  return timingSafeEqual(Buffer.from(hashToken(token), 'hex'), Buffer.from(expectedHash, 'hex'));
}

// Accepts "owner/repo", "https://github.com/owner/repo", with optional ".git" or trailing slash.
export function normalizeRepo(value) {
  const match = /^(?:https:\/\/github\.com\/)?([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2], repoUrl: `https://github.com/${match[1]}/${match[2]}` };
}

export function sameRepo(a, b) {
  return a?.toLowerCase() === b?.toLowerCase();
}
