export const ISSUE_SEVERITIES = new Set(['critical', 'high']);
export const FINGERPRINT_MARKER = 'codesentinel-fp:';

const SUMMARY_LIMIT = 255;
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function toFingerprintSet(previousFingerprints) {
  const set = new Set();
  for (const item of previousFingerprints ?? []) {
    const fingerprint = typeof item === 'string' ? item : item?.fingerprint;
    if (fingerprint) set.add(fingerprint);
  }
  return set;
}

export function issueEligibleFindings(report) {
  const seen = new Set();
  const eligible = [];
  for (const finding of report?.findings ?? []) {
    if (!ISSUE_SEVERITIES.has(finding.severity) || seen.has(finding.fingerprint)) continue;
    seen.add(finding.fingerprint);
    eligible.push(finding);
  }
  return eligible;
}

export function diffReports(previousFingerprints, report) {
  const previous = toFingerprintSet(previousFingerprints);
  const toCreate = [];
  const unchanged = [];
  const current = new Set();

  for (const finding of issueEligibleFindings(report)) {
    current.add(finding.fingerprint);
    if (previous.has(finding.fingerprint)) unchanged.push(finding);
    else toCreate.push(finding);
  }

  const toResolve = [...previous].filter((fingerprint) => !current.has(fingerprint));
  return { toCreate, toResolve, unchanged };
}

export function buildIssuePayload(finding) {
  const summary = `[${finding.severity.toUpperCase()}] ${finding.ruleId}: ${finding.title} in ${finding.file}`;
  const description = [
    `Location: ${finding.file}:${finding.line}:${finding.column}`,
    `Severity: ${finding.severity}`,
    `Category: ${finding.category}`,
    '',
    'Excerpt:',
    finding.excerpt,
    '',
    `Why it matters: ${finding.message}`,
    '',
    `Remediation: ${finding.remediation}`,
    '',
    '---',
    'Detected by CodeSentinel (static pattern analysis; may be a false positive).',
    `${FINGERPRINT_MARKER}${finding.fingerprint}`
  ].join('\n');

  return {
    summary: summary.length > SUMMARY_LIMIT ? `${summary.slice(0, SUMMARY_LIMIT - 1)}…` : summary,
    description,
    labels: ['codesentinel', `sec-${finding.ruleId}`, `sev-${finding.severity}`]
  };
}

export function extractFingerprint(text) {
  const match = new RegExp(`${FINGERPRINT_MARKER}([0-9a-f]{16})`).exec(text ?? '');
  return match ? match[1] : null;
}

export function summarizeDelta(previousReport, report) {
  const currentCounts = report?.summary?.severityCounts ?? {};
  if (!previousReport) {
    return {
      hasPrevious: false,
      previousScannedAt: null,
      scoreDelta: 0,
      totalDelta: 0,
      severityDeltas: Object.fromEntries(SEVERITIES.map((severity) => [severity, 0])),
      newFindings: report?.findings?.length ?? 0,
      fixedFindings: 0
    };
  }

  const previousCounts = previousReport.summary?.severityCounts ?? {};
  const previousSet = new Set((previousReport.findings ?? []).map((finding) => finding.fingerprint));
  const currentSet = new Set((report?.findings ?? []).map((finding) => finding.fingerprint));

  return {
    hasPrevious: true,
    previousScannedAt: previousReport.meta?.scannedAt ?? null,
    scoreDelta: (report?.summary?.score ?? 0) - (previousReport.summary?.score ?? 0),
    totalDelta: (report?.summary?.totalFindings ?? 0) - (previousReport.summary?.totalFindings ?? 0),
    severityDeltas: Object.fromEntries(SEVERITIES.map((severity) => [
      severity,
      (currentCounts[severity] ?? 0) - (previousCounts[severity] ?? 0)
    ])),
    newFindings: [...currentSet].filter((fingerprint) => !previousSet.has(fingerprint)).length,
    fixedFindings: [...previousSet].filter((fingerprint) => !currentSet.has(fingerprint)).length
  };
}

export function validateReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return 'Report must be a JSON object.';
  if (!report.summary || typeof report.summary !== 'object') return 'Report is missing summary.';
  if (typeof report.summary.score !== 'number') return 'Report summary.score must be a number.';
  if (!Array.isArray(report.findings)) return 'Report findings must be an array.';
  for (const finding of report.findings) {
    if (!finding || typeof finding.fingerprint !== 'string' || !/^[0-9a-f]{16}$/.test(finding.fingerprint)) {
      return 'Every finding needs a 16-character hex fingerprint.';
    }
    if (!SEVERITIES.includes(finding.severity)) return 'Every finding needs a known severity.';
    for (const field of ['ruleId', 'title', 'file']) {
      if (typeof finding[field] !== 'string') return `Every finding needs a string ${field}.`;
    }
    if (!Number.isInteger(finding.line) || finding.line < 1) return 'Every finding needs a positive line.';
  }
  return null;
}
