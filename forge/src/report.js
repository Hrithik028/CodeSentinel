import { RULES, SEVERITY_WEIGHT } from './shared/rules.js';

const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3 };

// Builds a report in the scanDirectory() shape (same scoring, grading and ordering) for app-side scans.
export function buildReport(findings, { target, startedAt, finishedAt, scannedFiles, scannedBytes, skipped, hitFileLimit, source = 'app', branch, commit }) {
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) severityCounts[finding.severity] += 1;

  const sorted = [...findings].sort((a, b) => PRIORITY[a.severity] - PRIORITY[b.severity]
    || a.file.localeCompare(b.file)
    || a.line - b.line);

  const deductions = Object.entries(severityCounts).reduce((total, [severity, count]) => total + SEVERITY_WEIGHT[severity] * count, 0);
  const score = Math.max(0, 100 - deductions);

  return {
    meta: {
      target,
      scannedAt: new Date(finishedAt).toISOString(),
      durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
      scannedFiles,
      scannedBytes,
      skippedFiles: skipped.length,
      hitFileLimit,
      ruleCount: RULES.length,
      source,
      branch,
      commit
    },
    summary: {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      totalFindings: sorted.length,
      severityCounts
    },
    findings: sorted,
    skipped
  };
}
