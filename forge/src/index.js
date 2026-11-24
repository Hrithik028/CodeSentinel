import resolverModule from '@forge/resolver';
import { fetch, webTrigger } from '@forge/api';
import { Queue } from '@forge/events';
import { smokeTest } from './smoke.js';
import { createIngestHandler } from './ingestHandler.js';
import { createForgeStore } from './store/forgeStore.js';
import { jiraClient } from './jira.js';
import { createResolvers } from './resolvers.js';
import { canAdminister, canAdministerJira, canBrowse, canCommentOnIssue } from './permissions.js';
import { createGitHubClient } from './github.js';
import { runScanStep } from './scan.js';
import { createMcpHandler } from './mcpHandler.js';
import { getSecurityPosture, listOpenFindings } from './posture.js';
import { createLlmClient, createSuggestFix } from './suggestFix.js';
import { addComment } from './jira.js';
import { readIssueAsUser } from './issues.js';

// @forge/resolver is CommonJS; under "type": "module" its default import is module.exports.
const Resolver = resolverModule.default ?? resolverModule;
const store = createForgeStore();
const queue = new Queue({ key: 'scan-queue' });

const definitions = createResolvers({
  store,
  queue,
  canAdminister,
  canBrowse,
  canAdministerJira,
  ingestUrl: () => webTrigger.getUrl('ingest-trigger'),
  mcpUrl: () => webTrigger.getUrl('mcp-trigger')
});

const resolver = new Resolver();
for (const name of ['getConfig', 'saveRepo', 'clearPat', 'rotateScanToken', 'unlinkRepo', 'scanNow', 'getPosture', 'listLinkedProjects', 'rotateMcpToken', 'revokeMcpToken']) {
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

export const mcp = createMcpHandler({ store });

const llm = process.env.LLM_API_KEY
  ? createLlmClient({ fetch, apiKey: process.env.LLM_API_KEY, baseUrl: process.env.LLM_BASE_URL || undefined, model: process.env.LLM_MODEL || undefined })
  : null;
const suggest = createSuggestFix({ store, readIssue: readIssueAsUser, canComment: canCommentOnIssue, addComment, llm });
const suggestResolver = new Resolver();
suggestResolver.define('suggestFix', ({ context }) => suggest(context?.extension?.issue?.key));
export const suggestFix = suggestResolver.getDefinitions();

// Rovo passes action inputs at the top level of the payload; results are filtered to projects the user can browse.
export const rovoPosture = (payload) => getSecurityPosture(store, { projectKey: payload?.projectKey, canBrowse });
export async function rovoFindings(payload) {
  try {
    return await listOpenFindings(store, { projectKey: payload?.projectKey, severity: payload?.severity, canBrowse });
  } catch (error) {
    if (error instanceof RangeError) return { error: error.message };
    throw error;
  }
}
