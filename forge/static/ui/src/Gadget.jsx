import React from 'react';
import { router } from '@forge/bridge';
import DynamicTable from '@atlaskit/dynamic-table';
import Lozenge from '@atlaskit/lozenge';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import Button from '@atlaskit/button/new';
import { timeAgo, useResolver } from './useResolver.js';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const SEVERITY_APPEARANCE = { critical: 'removed', high: 'moved', medium: 'default', low: 'default' };
const GRADE_COLOR = { A: '#1f845a', B: '#5b7f24', C: '#b38600', D: '#c25100', F: '#c9372c' };

function Delta({ delta }) {
  if (!delta) return null;
  const parts = [];
  if (delta.newFindings) parts.push(`+${delta.newFindings} new`);
  if (delta.fixedFindings) parts.push(`${delta.fixedFindings} fixed`);
  if (delta.scoreDelta) parts.push(`score ${delta.scoreDelta > 0 ? '+' : ''}${delta.scoreDelta}`);
  return <span style={{ color: 'var(--ds-text-subtle, #626f86)' }}>{parts.length ? parts.join(' · ') : 'No change since last scan'}</span>;
}

function IssueLink({ issueKey }) {
  if (!issueKey) return <span style={{ color: 'var(--ds-text-subtlest, #8590a2)' }}>n/a</span>;
  return <a href={`/browse/${issueKey}`} onClick={(e) => { e.preventDefault(); router.open(`/browse/${issueKey}`); }}>{issueKey}</a>;
}

export default function Gadget({ context }) {
  const projectKey = context.extension?.gadgetConfiguration?.projectKey ?? context.extension?.project?.key;
  const { loading, error, data, reload } = useResolver('getPosture', { projectKey }, [projectKey]);

  if (loading && !data) return <div style={{ padding: 16, textAlign: 'center' }}><Spinner size="large" /></div>;
  if (error) return <SectionMessage appearance="error" title="Couldn't load security posture" actions={[{ key: 'retry', text: 'Retry', onClick: reload }]}><p>{error}</p></SectionMessage>;
  if (!data?.configured) return <SectionMessage title="Choose a project">Edit this gadget and pick a project linked to CodeSentinel.</SectionMessage>;

  const { scan, lastScan, running, repoUrl } = data;
  if (!scan) {
    return (
      <SectionMessage title={`No scans for ${data.projectKey} yet`}>
        <p>{repoUrl ? `Waiting for the first report from ${repoUrl.replace('https://github.com/', '')}.` : 'Link a repository on the project’s CodeSentinel page.'}</p>
        {running && <p><Lozenge appearance="inprogress">Scanning</Lozenge></p>}
      </SectionMessage>
    );
  }

  const summary = scan.summary ?? {};
  const counts = summary.severityCounts ?? {};
  const findings = scan.findings ?? [];
  const rows = findings.map((f) => ({
    key: f.fingerprint,
    cells: [
      { key: SEVERITIES.indexOf(f.severity), content: <Lozenge appearance={SEVERITY_APPEARANCE[f.severity]}>{f.severity}</Lozenge> },
      { key: f.ruleId, content: <span title={f.message}>{f.ruleId}: {f.title}</span> },
      { key: `${f.file}:${f.line}`, content: <code>{f.file}:{f.line}</code> },
      { key: f.issueKey ?? '', content: <IssueLink issueKey={f.issueKey} /> }
    ]
  }));

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div aria-label={`Grade ${summary.grade}`} style={{ width: 56, height: 56, borderRadius: 8, background: GRADE_COLOR[summary.grade] ?? '#626f86', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <strong style={{ fontSize: 22, lineHeight: 1 }}>{summary.grade ?? '?'}</strong>
          <span style={{ fontSize: 11 }}>{summary.score ?? '–'}/100</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SEVERITIES.map((s) => <Lozenge key={s} appearance={counts[s] ? SEVERITY_APPEARANCE[s] : 'default'} isBold={s === 'critical' && counts[s] > 0}>{counts[s] ?? 0} {s}</Lozenge>)}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12 }}>
          <Lozenge appearance={scan.source === 'app' ? 'new' : 'inprogress'}>{scan.source === 'app' ? 'App scan' : 'CI'}</Lozenge>{' '}
          {running && <Lozenge appearance="inprogress">Scanning…</Lozenge>}
          <div>{timeAgo(lastScan?.at ?? scan.receivedAt)}{scan.commit ? ` · ${scan.commit.slice(0, 7)}` : ''}</div>
          <Delta delta={scan.delta} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <DynamicTable
          head={{ cells: [{ key: 'sev', content: 'Severity', isSortable: true }, { key: 'rule', content: 'Finding', isSortable: true }, { key: 'loc', content: 'Location' }, { key: 'issue', content: 'Issue' }] }}
          rows={rows}
          rowsPerPage={10}
          defaultSortKey="sev"
          defaultSortOrder="ASC"
          emptyView={<p>No findings. Nice.</p>}
        />
        {findings.length < (summary.totalFindings ?? 0) && <p style={{ fontSize: 12 }}>Showing {findings.length} of {summary.totalFindings} findings.</p>}
      </div>
      <Button appearance="subtle" onClick={reload}>Refresh</Button>
    </div>
  );
}
