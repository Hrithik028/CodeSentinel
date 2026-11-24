import api, { route } from '@forge/api';
import { adfToText } from './adf.js';

export async function readIssueAsUser(issueKey) {
  const response = await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=labels,description,project`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw Object.assign(new Error(`Could not read ${issueKey} (HTTP ${response.status})`), { status: response.status });
  const { fields } = await response.json();
  return { key: issueKey, projectKey: fields.project?.key, labels: fields.labels ?? [], description: adfToText(fields.description) };
}
