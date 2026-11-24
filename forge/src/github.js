import { scannableExtensions } from './shared/scanner.js';

export const IGNORED_DIRECTORIES = new Set([
  '.git', '.idea', '.next', '.nuxt', '.vscode', 'build', 'coverage', 'dist',
  'node_modules', 'target', 'vendor', 'venv', '.venv', '__pycache__'
]);
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_FILES = 5000;
export const BATCH_SIZE = 20;

export class GitHubError extends Error {
  constructor(operation, status) {
    super(`GitHub ${operation} failed with HTTP ${status}`);
    this.status = status;
  }
}

export function extensionOf(filePath) {
  const name = filePath.slice(filePath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

export function createGitHubClient({ fetch, pat }) {
  async function request(operation, path) {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'CodeSentinel-Forge',
        ...(pat ? { Authorization: `Bearer ${pat}` } : {})
      }
    });
    if (!response.ok) throw new GitHubError(operation, response.status);
    return response.json();
  }

  const repoPath = (owner, repo) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  return {
    async resolveHead(owner, repo) {
      const info = await request('getRepository', repoPath(owner, repo));
      const branch = info.default_branch;
      const ref = await request('getBranch', `${repoPath(owner, repo)}/branches/${encodeURIComponent(branch)}`);
      return { branch, commit: ref.commit.sha };
    },

    // Deterministic for a given commit, so a resumed scan re-lists instead of checkpointing the file list.
    async listScannableFiles(owner, repo, commit) {
      const tree = await request('getTree', `${repoPath(owner, repo)}/git/trees/${commit}?recursive=1`);
      return { truncatedTree: Boolean(tree.truncated), ...selectFiles(tree.tree ?? []) };
    },

    async fetchBlob(owner, repo, sha) {
      const blob = await request('getBlob', `${repoPath(owner, repo)}/git/blobs/${sha}`);
      return blob.encoding === 'base64' ? Buffer.from(blob.content, 'base64').toString('utf8') : String(blob.content ?? '');
    }
  };
}

export function selectFiles(entries) {
  const extensions = scannableExtensions();
  const files = [];
  const skipped = [];
  let hitFileLimit = false;
  for (const entry of entries) {
    if (entry.type !== 'blob') continue;
    if (entry.path.split('/').some((segment) => IGNORED_DIRECTORIES.has(segment))) continue;
    if (!extensions.has(extensionOf(entry.path))) continue;
    if (entry.size > MAX_FILE_BYTES) {
      skipped.push({ path: entry.path, reason: 'file-too-large' });
      continue;
    }
    if (files.length >= MAX_FILES) {
      hitFileLimit = true;
      break;
    }
    files.push({ path: entry.path, sha: entry.sha, size: entry.size ?? 0 });
  }
  return { files, skipped, hitFileLimit };
}
