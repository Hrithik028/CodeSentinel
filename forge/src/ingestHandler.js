import { validateReport } from './shared/ingest.js';
import { processReport } from './processReport.js';
import { normalizeRepo, sameRepo, tokenMatches } from './repos.js';

export const MAX_BODY_BYTES = 1024 * 1024;

function respond(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(body) };
}

// Web trigger headers arrive lower-cased with array values.
function header(event, name) {
  const value = event?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function createIngestHandler({ store, jira, log = console }) {
  return async function ingest(event) {
    if (String(event?.method ?? '').toUpperCase() !== 'POST') return respond(405, { error: 'Method not allowed' });

    const body = typeof event.body === 'string' ? event.body : '';
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return respond(413, { error: 'Report exceeds 1 MB' });

    const repos = (await store.getConfig('repos')) ?? [];
    const token = header(event, 'x-scan-token');
    const tokenRepos = repos.filter((repo) => tokenMatches(token, repo.scanTokenHash));
    if (!tokenRepos.length) return respond(401, { error: 'Invalid scan token' });

    const target = normalizeRepo(header(event, 'x-repo'));
    const repo = target && tokenRepos.find((item) => sameRepo(item.repoUrl, target.repoUrl));
    if (!repo) return respond(404, { error: 'Repository is not linked to this scan token' });

    let report;
    try {
      report = JSON.parse(body);
    } catch {
      return respond(400, { error: 'Body is not valid JSON' });
    }
    const invalid = validateReport(report);
    if (invalid) return respond(400, { error: invalid });

    const commit = header(event, 'x-commit') ?? null;
    const result = await processReport(report, repo, {
      source: 'ci',
      commit: /^[0-9a-f]{7,40}$/i.test(commit ?? '') ? commit : null,
      store,
      jira
    });
    log.info?.(`ingest ${repo.projectKey}: created=${result.created} resolved=${result.resolved} unchanged=${result.unchanged} errors=${result.errors.length}`);
    return respond(200, result);
  };
}
