import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';
import Button from '@atlaskit/button/new';
import Textfield from '@atlaskit/textfield';
import { Checkbox } from '@atlaskit/checkbox';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import Lozenge from '@atlaskit/lozenge';
import { REPO_URL, timeAgo, useResolver } from './useResolver.js';

const field = { display: 'block', fontWeight: 600, margin: '16px 0 4px' };
const help = { color: 'var(--ds-text-subtle, #626f86)', fontSize: 12, marginTop: 4 };

function TokenOnce({ token, ingestUrl, onDismiss }) {
  return (
    <SectionMessage appearance="warning" title="Copy your scan token now. It won't be shown again.">
      <p>Add these as GitHub Actions secrets in the repository:</p>
      <p><code>SCAN_ENDPOINT</code> = <code style={{ wordBreak: 'break-all' }}>{ingestUrl}</code></p>
      <p><code>SCAN_TOKEN</code> = <code style={{ wordBreak: 'break-all' }}>{token}</code></p>
      <Button onClick={() => navigator.clipboard?.writeText(token)}>Copy token</Button>{' '}
      <Button appearance="subtle" onClick={onDismiss}>I've saved it</Button>
    </SectionMessage>
  );
}

function LastScan({ repo, scan }) {
  if (scan?.status === 'running') return <p><Lozenge appearance="inprogress">Scanning</Lozenge> started {timeAgo(scan.startedAt)}</p>;
  const last = repo?.lastScan;
  if (!last) return <p><Lozenge>No scans yet</Lozenge></p>;
  if (last.status === 'error') return <p><Lozenge appearance="removed">Failed</Lozenge> {timeAgo(last.at)}: {last.error}</p>;
  return (
    <p>
      <Lozenge appearance="success">{last.source === 'app' ? 'App scan' : 'CI scan'}</Lozenge> {timeAgo(last.at)}: score {last.score} ({last.grade}),{' '}
      {last.created ?? 0} created, {last.resolved ?? 0} resolved
    </p>
  );
}

export default function ConfigPage({ context }) {
  const projectKey = context.extension?.project?.key;
  const { loading, error, data, reload } = useResolver('getConfig', { projectKey }, [projectKey]);
  const [repoUrl, setRepoUrl] = useState('');
  const [pat, setPat] = useState('');
  const [llmOptIn, setLlmOptIn] = useState(false);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);
  const [token, setToken] = useState(null);
  const [mcpToken, setMcpToken] = useState(null);

  useEffect(() => {
    if (data?.repo) {
      setRepoUrl(data.repo.repoUrl);
      setLlmOptIn(Boolean(data.repo.llmOptIn));
    }
  }, [data]);

  async function run(name, payload, success) {
    setBusy(name);
    setMessage(null);
    try {
      const result = await invoke(name, { projectKey, ...payload });
      if (result?.scanToken) setToken(result.scanToken);
      if (result?.mcpToken) setMcpToken(result.mcpToken);
      setMessage({ appearance: 'success', text: success });
      setPat('');
      await reload();
    } catch (err) {
      setMessage({ appearance: 'error', text: err.message ?? String(err) });
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <Spinner size="large" />;
  if (error) return <SectionMessage appearance="error" title="Couldn't load CodeSentinel settings"><p>{error}</p></SectionMessage>;

  const repo = data.repo;
  const repoValid = REPO_URL.test(repoUrl.trim());

  return (
    <div style={{ maxWidth: 640, padding: 16 }}>
      <h2>CodeSentinel for {projectKey}</h2>
      <p style={help}>Critical and high findings become Jira issues in this project. Fixed findings are transitioned to Done.</p>

      {token && <TokenOnce token={token} ingestUrl={data.ingestUrl} onDismiss={() => setToken(null)} />}
      {message && <div style={{ marginTop: 12 }}><SectionMessage appearance={message.appearance}><p>{message.text}</p></SectionMessage></div>}

      <form onSubmit={(e) => { e.preventDefault(); run('saveRepo', { repoUrl: repoUrl.trim(), pat, llmOptIn }, 'Settings saved.'); }}>
        <label style={field} htmlFor="repo">GitHub repository</label>
        <Textfield id="repo" value={repoUrl} placeholder="https://github.com/owner/repo" isInvalid={Boolean(repoUrl) && !repoValid}
          onChange={(e) => setRepoUrl(e.target.value)} />
        {repoUrl && !repoValid && <div style={{ ...help, color: 'var(--ds-text-danger, #ae2e24)' }}>Use https://github.com/owner/repo or owner/repo.</div>}

        <label style={field} htmlFor="pat">GitHub token (optional, for app-side scans)</label>
        <Textfield id="pat" type="password" autoComplete="new-password" value={pat}
          placeholder={repo?.hasPat ? 'A token is saved. Enter a new one to replace it.' : 'Fine-grained token with Contents: read'}
          onChange={(e) => setPat(e.target.value)} />
        <div style={help}>Write-only: the token is kept in Forge secret storage and is never shown again. Without one, only CI reports are used.</div>

        <div style={{ marginTop: 16 }}>
          <Checkbox isChecked={llmOptIn} onChange={(e) => setLlmOptIn(e.target.checked)}
            label="Enable “Suggest fix”: send the rule ID and a redacted excerpt to the configured LLM" />
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Button appearance="primary" type="submit" isDisabled={!repoValid} isLoading={busy === 'saveRepo'}>Save</Button>
          {repo?.hasPat && <Button onClick={() => run('clearPat', {}, 'GitHub token removed.')} isLoading={busy === 'clearPat'}>Remove token</Button>}
        </div>
      </form>

      {repo && (
        <>
          <h3 style={{ marginTop: 24 }}>Scanning</h3>
          <LastScan repo={repo} scan={data.scan} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button appearance="primary" isDisabled={!repo.hasPat || data.scan?.status === 'running'} isLoading={busy === 'scanNow'}
              onClick={() => run('scanNow', {}, 'Scan queued. Refresh in a minute to see results.')}>Scan now</Button>
            <Button onClick={reload}>Refresh</Button>
          </div>
          {!repo.hasPat && <div style={help}>Add a GitHub token to scan from the app. CI reports work without one.</div>}

          <h3 style={{ marginTop: 24 }}>CI integration</h3>
          <p style={help}>POST <code>node src/cli.js --json</code> output to <code style={{ wordBreak: 'break-all' }}>{data.ingestUrl}</code> with the <code>X-Scan-Token</code> and <code>X-Repo</code> headers.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => run('rotateScanToken', {}, 'New scan token generated. Update the SCAN_TOKEN secret.')} isLoading={busy === 'rotateScanToken'}>Regenerate scan token</Button>
            <Button appearance="danger" onClick={() => run('unlinkRepo', {}, 'Repository unlinked.')} isLoading={busy === 'unlinkRepo'}>Unlink repository</Button>
          </div>
        </>
      )}

      {data.mcp?.canManage && (
        <>
          <h3 style={{ marginTop: 24 }}>MCP access (site-wide)</h3>
          <p style={help}>Lets MCP clients such as Claude or Cursor read posture and open findings for every linked project. Endpoint: <code style={{ wordBreak: 'break-all' }}>{data.mcp.url}</code></p>
          {mcpToken && (
            <SectionMessage appearance="warning" title="Copy your MCP token now. It won't be shown again.">
              <p>Send it as <code>Authorization: Bearer {mcpToken}</code></p>
              <Button onClick={() => navigator.clipboard?.writeText(mcpToken)}>Copy token</Button>{' '}
              <Button appearance="subtle" onClick={() => setMcpToken(null)}>I've saved it</Button>
            </SectionMessage>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button onClick={() => run('rotateMcpToken', {}, 'New MCP token generated. Clients using the old one will stop working.')} isLoading={busy === 'rotateMcpToken'}>
              {data.mcp.enabled ? 'Regenerate MCP token' : 'Enable MCP access'}
            </Button>
            {data.mcp.enabled && <Button appearance="danger" onClick={() => run('revokeMcpToken', {}, 'MCP access disabled.')} isLoading={busy === 'revokeMcpToken'}>Disable</Button>}
          </div>
        </>
      )}
    </div>
  );
}
