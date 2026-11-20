import Resolver from '@forge/resolver';
import { fetch, webTrigger } from '@forge/api';
import { Queue } from '@forge/events';
import { smokeTest } from './smoke.js';
import { createIngestHandler } from './ingestHandler.js';
import { createForgeStore } from './store/forgeStore.js';
import { jiraClient } from './jira.js';
import { createResolvers } from './resolvers.js';
import { canAdminister, canBrowse } from './permissions.js';
import { createGitHubClient } from './github.js';
import { runScanStep } from './scan.js';

const store = createForgeStore();
const queue = new Queue({ key: 'scan-queue' });

const notImplemented = (name) => async () => {
  throw new Error(`${name} is not implemented yet`);
};

const definitions = createResolvers({
  store,
  queue,
  canAdminister,
  canBrowse,
  ingestUrl: () => webTrigger.getUrl('ingest-trigger')
});

const resolver = new Resolver();
for (const name of ['getConfig', 'saveRepo', 'clearPat', 'rotateScanToken', 'unlinkRepo', 'scanNow', 'getPosture', 'listLinkedProjects']) {
  resolver.define(name, (request) => definitions[name](request));
}
resolver.define('smokeTest', () => smokeTest());

export const resolverHandler = resolver.getDefinitions();
export { resolverHandler as resolver };

export const ingest = createIngestHandler({ store, jira: jiraClient });

export async function scanWorker(event) {
  const { repoUrl, runId = null } = event?.body ?? {};
  const repo = ((await store.getConfig('repos')) ?? []).find((item) => item.repoUrl === repoUrl);
  if (!repo?.hasPat) return;
  const pat = await store.getPat(repo.repoUrl);
  if (!pat) return;
  const github = createGitHubClient({ fetch, pat });
  try {
    const step = await runScanStep(repo, { store, jira: jiraClient, github, runId });
    if (step.status === 'continued') await queue.push({ body: { repoUrl, runId: step.runId } });
    if (step.status === 'completed') console.info(`app scan ${repo.projectKey}: created=${step.result.created} resolved=${step.result.resolved}`);
  } catch (error) {
    await store.setScanState(repo.repoUrl, null);
    const lastScan = { at: new Date().toISOString(), source: 'app', status: 'error', error: error.status ? `GitHub or Jira returned HTTP ${error.status}` : error.message };
    const repos = (await store.getConfig('repos')) ?? [];
    await store.setConfig('repos', repos.map((item) => (item.repoUrl === repoUrl ? { ...item, lastScan } : item)));
    console.warn(`app scan ${repo.projectKey} failed: ${lastScan.error}`);
  }
}

export async function rescan() {
  const repos = (await store.getConfig('repos')) ?? [];
  const due = repos.filter((repo) => repo.hasPat);
  for (const repo of due) {
    if (await store.getScanState(repo.repoUrl)) continue;
    await queue.push({ body: { repoUrl: repo.repoUrl } });
  }
  console.info(`hourly rescan queued ${due.length} repo(s)`);
}

export const mcp = async () => ({ statusCode: 501, headers: { 'Content-Type': ['application/json'] }, body: '{"error":"Not implemented"}' });
export const suggestFix = new Resolver().getDefinitions();
export const rovoPosture = notImplemented('rovoPosture');
export const rovoFindings = notImplemented('rovoFindings');
