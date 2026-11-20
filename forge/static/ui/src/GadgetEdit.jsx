import React, { useState } from 'react';
import { view } from '@forge/bridge';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';
import Spinner from '@atlaskit/spinner';
import { useResolver } from './useResolver.js';

export default function GadgetEdit({ context }) {
  const current = context.extension?.gadgetConfiguration?.projectKey ?? '';
  const [projectKey, setProjectKey] = useState(current);
  const { loading, error, data } = useResolver('listLinkedProjects', {}, []);

  if (loading) return <Spinner size="medium" />;
  if (error) return <SectionMessage appearance="error"><p>{error}</p></SectionMessage>;
  if (!data.length) return <SectionMessage title="No linked projects">Link a repository from a project's CodeSentinel page first.</SectionMessage>;

  return (
    <form style={{ padding: 8 }} onSubmit={(e) => { e.preventDefault(); view.submit({ projectKey }); }}>
      <label htmlFor="project" style={{ fontWeight: 600 }}>Project</label>
      <select id="project" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} style={{ display: 'block', width: '100%', margin: '4px 0 12px', padding: 6 }}>
        <option value="" disabled>Select a project</option>
        {data.map((p) => <option key={p.projectKey} value={p.projectKey}>{p.projectKey} · {p.repoUrl.replace('https://github.com/', '')}</option>)}
      </select>
      <Button appearance="primary" type="submit" isDisabled={!projectKey}>Save</Button>{' '}
      <Button appearance="subtle" onClick={() => view.close()}>Cancel</Button>
    </form>
  );
}
