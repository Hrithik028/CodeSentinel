import { generateToken, hashToken, normalizeRepo, sameRepo } from './repos.js';

export class AccessError extends Error {}

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,49}$/;

// Never returns scanTokenHash or the PAT: the config page only ever sees hasPat.
export function publicRepo(repo) {
  if (!repo) return null;
  const { scanTokenHash, ...rest } = repo;
  return { ...rest, hasScanToken: Boolean(scanTokenHash) };
}

export function createConfigService({ store, now = () => new Date().toISOString() }) {
  async function repos() {
    return (await store.getConfig('repos')) ?? [];
  }

  async function repoForProject(projectKey) {
    return (await repos()).find((repo) => repo.projectKey === projectKey) ?? null;
  }

  return {
    repos,
    repoForProject,

    async getProjectConfig(projectKey) {
      return publicRepo(await repoForProject(projectKey));
    },

    // Links (or re-links) one repo to one project. Returns the scan token only when a new one was generated.
    async saveRepo(projectKey, { repoUrl, pat, llmOptIn = false, issueType = 'Bug' }) {
      if (!PROJECT_KEY.test(projectKey ?? '')) throw new Error('Invalid project key.');
      const target = normalizeRepo(repoUrl);
      if (!target) throw new Error('Enter a GitHub repository as https://github.com/owner/repo.');
      if (typeof issueType !== 'string' || !issueType.trim() || issueType.length > 60) throw new Error('Invalid issue type.');

      const all = await repos();
      const clash = all.find((repo) => sameRepo(repo.repoUrl, target.repoUrl) && repo.projectKey !== projectKey);
      if (clash) throw new Error(`That repository is already linked to project ${clash.projectKey}.`);

      const existing = all.find((repo) => repo.projectKey === projectKey);
      const repoChanged = existing && !sameRepo(existing.repoUrl, target.repoUrl);
      let scanToken = null;
      const next = {
        ...(existing ?? { createdAt: now() }),
        // Keep the stored spelling for case-only edits; the PAT and checkpoint are keyed by it.
        repoUrl: existing && !repoChanged ? existing.repoUrl : target.repoUrl,
        projectKey,
        issueType: issueType.trim(),
        llmOptIn: Boolean(llmOptIn),
        hasPat: repoChanged ? false : Boolean(existing?.hasPat)
      };
      if (!existing?.scanTokenHash || repoChanged) {
        scanToken = generateToken();
        next.scanTokenHash = hashToken(scanToken);
      }
      if (repoChanged) {
        delete next.lastScan;
        await store.setPat(existing.repoUrl, null);
        await store.setScanState(existing.repoUrl, null);
      }
      if (typeof pat === 'string' && pat.trim()) {
        await store.setPat(next.repoUrl, pat.trim());
        next.hasPat = true;
      }

      await store.setConfig('repos', [...all.filter((repo) => repo.projectKey !== projectKey), next]);
      return { repo: publicRepo(next), scanToken };
    },

    async clearPat(projectKey) {
      const repo = await repoForProject(projectKey);
      if (!repo) throw new Error('No repository is linked to this project.');
      await store.setPat(repo.repoUrl, null);
      return this.update(projectKey, { hasPat: false });
    },

    async rotateScanToken(projectKey) {
      const scanToken = generateToken();
      await this.update(projectKey, { scanTokenHash: hashToken(scanToken) });
      return { scanToken };
    },

    async update(projectKey, patch) {
      const all = await repos();
      const repo = all.find((item) => item.projectKey === projectKey);
      if (!repo) throw new Error('No repository is linked to this project.');
      const next = { ...repo, ...patch };
      await store.setConfig('repos', all.map((item) => (item.projectKey === projectKey ? next : item)));
      return publicRepo(next);
    },

    async unlink(projectKey) {
      const all = await repos();
      const repo = all.find((item) => item.projectKey === projectKey);
      if (!repo) return;
      await store.setPat(repo.repoUrl, null);
      await store.setScanState(repo.repoUrl, null);
      await store.setConfig('repos', all.filter((item) => item.projectKey !== projectKey));
    }
  };
}
