const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
export const SEVERITIES = new Set(SEVERITY_ORDER);

// Read-only views of stored scans, shared by the Rovo actions and the MCP tools.
// `canBrowse(projectKey)` filters projects the caller may not see; pass () => true for app-level callers.
async function linkedProjects(store, { projectKey, canBrowse }) {
  const repos = (await store.getConfig('repos')) ?? [];
  const selected = projectKey ? repos.filter((repo) => repo.projectKey === String(projectKey).toUpperCase()) : repos;
  const visible = [];
  for (const repo of selected) if (await canBrowse(repo.projectKey)) visible.push(repo);
  return visible;
}

export async function getSecurityPosture(store, { projectKey, canBrowse = async () => true } = {}) {
  const projects = [];
  // Count tracking records, not latest-scan findings: issues whose Done transition failed stay open.
  const records = await store.allFingerprintRecords();
  for (const repo of await linkedProjects(store, { projectKey, canBrowse })) {
    const scan = await store.getLatestScan(repo.projectKey);
    projects.push({
      projectKey: repo.projectKey,
      repoUrl: repo.repoUrl,
      score: scan?.summary?.score ?? null,
      grade: scan?.summary?.grade ?? null,
      severityCounts: scan?.summary?.severityCounts ?? null,
      openIssues: records.filter((record) => record.status === 'open' && record.issueKey && record.projectKey === repo.projectKey && record.repoUrl === repo.repoUrl).length,
      source: scan?.source ?? null,
      scannedAt: scan?.receivedAt ?? null,
      commit: scan?.commit ?? null,
      delta: scan?.delta ? { scoreDelta: scan.delta.scoreDelta, newFindings: scan.delta.newFindings, fixedFindings: scan.delta.fixedFindings } : null
    });
  }
  return { projects };
}

export async function listOpenFindings(store, { projectKey, severity, limit = 20, canBrowse = async () => true } = {}) {
  if (severity && !SEVERITIES.has(String(severity).toLowerCase())) throw new RangeError('severity must be critical, high, medium or low');
  const cap = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  const wanted = severity ? String(severity).toLowerCase() : null;
  const findings = [];
  for (const repo of await linkedProjects(store, { projectKey, canBrowse })) {
    const scan = await store.getLatestScan(repo.projectKey);
    for (const finding of scan?.findings ?? []) {
      if (wanted && finding.severity !== wanted) continue;
      findings.push({
        projectKey: repo.projectKey,
        ruleId: finding.ruleId,
        title: finding.title,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        excerpt: finding.excerpt,
        issueKey: finding.issueKey ?? null
      });
    }
  }
  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || a.projectKey.localeCompare(b.projectKey));
  return { findings: findings.slice(0, cap), total: findings.length };
}
