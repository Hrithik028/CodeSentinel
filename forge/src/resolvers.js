import { AccessError, createConfigService } from './configService.js';

const RUNNING = 'running';

// Custom UI resolver definitions for the config page and the gadget. Dependencies are injected:
// store, queue ({ push }), canAdminister(projectKey), canBrowse(projectKey), ingestUrl().
export function createResolvers({ store, queue, canAdminister, canBrowse, ingestUrl }) {
  const config = createConfigService({ store });

  const projectFrom = (payload, context) => payload?.projectKey ?? context?.extension?.project?.key;

  async function requireAdmin(payload, context) {
    const projectKey = projectFrom(payload, context);
    if (!projectKey || !(await canAdminister(projectKey))) throw new AccessError('Only project administrators can change CodeSentinel settings.');
    return projectKey;
  }

  async function requireBrowse(payload, context) {
    const projectKey = projectFrom(payload, context);
    if (!projectKey || !(await canBrowse(projectKey))) throw new AccessError('You do not have access to this project.');
    return projectKey;
  }

  async function scanStatus(repoUrl) {
    const state = await store.getScanState(repoUrl);
    return state ? { status: RUNNING, startedAt: state.startedAt, cursor: state.cursor } : null;
  }

  return {
    async getConfig({ payload, context }) {
      const projectKey = await requireAdmin(payload, context);
      const repo = await config.getProjectConfig(projectKey);
      return {
        projectKey,
        repo,
        ingestUrl: await ingestUrl(),
        scan: repo ? await scanStatus(repo.repoUrl) : null
      };
    },

    async saveRepo({ payload, context }) {
      const projectKey = await requireAdmin(payload, context);
      return config.saveRepo(projectKey, payload ?? {});
    },

    async clearPat({ payload, context }) {
      return config.clearPat(await requireAdmin(payload, context));
    },

    async rotateScanToken({ payload, context }) {
      return config.rotateScanToken(await requireAdmin(payload, context));
    },

    async unlinkRepo({ payload, context }) {
      await config.unlink(await requireAdmin(payload, context));
      return { ok: true };
    },

    async scanNow({ payload, context }) {
      const projectKey = await requireAdmin(payload, context);
      const repo = await config.repoForProject(projectKey);
      if (!repo) throw new Error('Link a repository first.');
      if (!repo.hasPat) throw new Error('Add a GitHub token to scan from the app.');
      await store.setScanState(repo.repoUrl, null);
      await queue.push({ body: { repoUrl: repo.repoUrl } });
      return { queued: true };
    },

    async getPosture({ payload, context }) {
      const projectKey = payload?.projectKey ?? context?.extension?.gadgetConfiguration?.projectKey ?? context?.extension?.project?.key;
      if (!projectKey) return { configured: false };
      if (!(await canBrowse(projectKey))) throw new AccessError('You do not have access to this project.');
      const repo = await config.repoForProject(projectKey);
      return {
        configured: true,
        projectKey,
        repoUrl: repo?.repoUrl ?? null,
        lastScan: repo?.lastScan ?? null,
        scan: (await store.getLatestScan(projectKey)) ?? null,
        running: repo ? await scanStatus(repo.repoUrl) : null
      };
    },

    async listLinkedProjects({ context }) {
      const repos = await config.repos();
      const visible = [];
      for (const repo of repos) if (await canBrowse(repo.projectKey)) visible.push({ projectKey: repo.projectKey, repoUrl: repo.repoUrl });
      return visible;
    },

    requireBrowse
  };
}
