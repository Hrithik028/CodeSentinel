import { randomUUID } from 'node:crypto';
import { RULES } from './shared/rules.js';
import { scanContent } from './shared/scanner.js';
import { BATCH_SIZE, extensionOf } from './github.js';
import { buildReport } from './report.js';
import { processReport, redactSecretLines } from './processReport.js';
import { normalizeRepo } from './repos.js';

export const STEP_BUDGET_MS = 20_000;
export const MAX_CHECKPOINT_BYTES = 200 * 1024;
const MAX_SKIPPED = 100;
const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export class CheckpointTooLargeError extends Error {
  constructor() {
    super('Scan checkpoint exceeds the Forge storage limit; too many findings to resume safely.');
  }
}

// Checkpoints keep only what scanContent cannot re-derive from the rule; the rest is restored on completion.
const compact = ({ fingerprint, ruleId, file, line, column, excerpt }) => ({ fingerprint, ruleId, file, line, column, excerpt });

function expand(finding) {
  const rule = RULES_BY_ID.get(finding.ruleId);
  return {
    fingerprint: finding.fingerprint,
    ruleId: finding.ruleId,
    title: rule.title,
    severity: rule.severity,
    category: rule.category,
    file: finding.file,
    line: finding.line,
    column: finding.column,
    excerpt: finding.excerpt,
    message: rule.message,
    remediation: rule.remediation
  };
}

async function saveCheckpoint(store, repoUrl, state) {
  if (Buffer.byteLength(JSON.stringify(state)) > MAX_CHECKPOINT_BYTES) throw new CheckpointTooLargeError();
  await store.setScanState(repoUrl, state);
}

// Runs one time-boxed step of an app-side scan. Returns { status: 'continued', runId } after saving a
// checkpoint (the caller re-queues), { status: 'completed', result } after processReport, or
// { status: 'superseded' } when a newer run replaced this one.
export async function runScanStep(repo, { store, jira, github, runId = null, clock = Date.now, budgetMs = STEP_BUDGET_MS }) {
  const started = clock();
  const { owner, repo: name } = normalizeRepo(repo.repoUrl);
  let state = await store.getScanState(repo.repoUrl);

  if (runId) {
    if (!state || state.runId !== runId) return { status: 'superseded' };
  } else {
    const head = await github.resolveHead(owner, name);
    state = {
      runId: randomUUID(),
      startedAt: new Date(started).toISOString(),
      branch: head.branch,
      commit: head.commit,
      commitTime: head.commitTime ?? null,
      cursor: 0,
      findings: [],
      scannedFiles: 0,
      scannedBytes: 0,
      skipped: []
    };
  }

  const listing = await github.listScannableFiles(owner, name, state.commit);
  const files = listing.files;
  if (state.cursor === 0) {
    state.skipped = listing.skipped.slice(0, MAX_SKIPPED);
    state.skippedTruncated = listing.skipped.length > MAX_SKIPPED;
  }

  while (state.cursor < files.length) {
    if (clock() - started >= budgetMs) {
      await saveCheckpoint(store, repo.repoUrl, state);
      return { status: 'continued', runId: state.runId, cursor: state.cursor, total: files.length };
    }
    const batch = files.slice(state.cursor, state.cursor + BATCH_SIZE);
    const contents = await Promise.all(batch.map((file) => github.fetchBlob(owner, name, file.sha)));
    batch.forEach((file, index) => {
      const content = contents[index];
      if (content.includes('\u0000')) {
        if (state.skipped.length < MAX_SKIPPED) state.skipped.push({ path: file.path, reason: 'binary-file' });
        else state.skippedTruncated = true;
        return;
      }
      state.scannedFiles += 1;
      state.scannedBytes += file.size;
      // Redact per file before checkpointing so no stored state holds a raw secret.
      const { findings } = redactSecretLines({ findings: scanContent(content, file.path, extensionOf(file.path)) });
      state.findings.push(...findings.map(compact));
    });
    state.cursor += batch.length;
  }

  const report = buildReport(state.findings.map(expand), {
    target: `${owner}/${name}`,
    startedAt: state.startedAt,
    finishedAt: clock(),
    scannedFiles: state.scannedFiles,
    scannedBytes: state.scannedBytes,
    skipped: state.skipped,
    // A capped skipped list can't name every unscanned file, so resolution is suspended.
    hitFileLimit: listing.hitFileLimit || listing.truncatedTree || state.skippedTruncated === true,
    branch: state.branch,
    commit: state.commit
  });
  // Scan now may have replaced this run while it was fetching; never publish a superseded run.
  const current = await store.getScanState(repo.repoUrl);
  if (current && current.runId !== state.runId) return { status: 'superseded' };
  // A resumed run may have scanned a commit that is no longer the head; only the live head bypasses the stale check.
  const headIsCurrent = (await github.resolveHead(owner, name)).commit === state.commit;
  const result = await processReport(report, repo, { source: 'app', commit: state.commit, commitTime: state.commitTime ?? null, headIsCurrent, store, jira });
  if ((await store.getScanState(repo.repoUrl))?.runId === state.runId) await store.setScanState(repo.repoUrl, null);
  return { status: 'completed', result };
}
