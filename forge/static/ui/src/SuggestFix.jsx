import React, { useState } from 'react';
import { invoke, view } from '@forge/bridge';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';

export default function SuggestFix() {
  const [state, setState] = useState({ status: 'idle' });

  async function run() {
    setState({ status: 'loading' });
    try {
      const { suggestion } = await invoke('suggestFix');
      setState({ status: 'done', suggestion });
    } catch (error) {
      setState({ status: 'error', error: error.message ?? String(error) });
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 560 }}>
      <SectionMessage title="AI-generated suggestion (advisory only)">
        <p>Sends this finding's rule ID and a redacted one-line excerpt to the configured LLM, then adds the suggestion as a comment. Code and issue status are never changed.</p>
      </SectionMessage>
      {state.status === 'error' && <div style={{ marginTop: 12 }}><SectionMessage appearance="error"><p>{state.error}</p></SectionMessage></div>}
      {state.status === 'done' && (
        <div style={{ marginTop: 12 }}>
          <SectionMessage appearance="success" title="Comment added"><pre style={{ whiteSpace: 'pre-wrap' }}>{state.suggestion}</pre></SectionMessage>
        </div>
      )}
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        {state.status !== 'done' && <Button appearance="primary" isLoading={state.status === 'loading'} onClick={run}>Suggest fix</Button>}
        <Button appearance="subtle" onClick={() => view.close()}>Close</Button>
      </div>
    </div>
  );
}
