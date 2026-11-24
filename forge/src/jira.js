import api, { route } from '@forge/api';
import { textToAdf, adfToText } from './adf.js';
import { FINGERPRINT_MARKER, extractFingerprint } from './shared/ingest.js';
import { pickIssueType } from './issueTypes.js';

export class JiraError extends Error {
  constructor(operation, status) {
    super(`Jira ${operation} failed with HTTP ${status}`);
    this.status = status;
  }
}

async function requestJson(operation, path, options = {}) {
  const response = await api.asApp().requestJira(path, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  });
  if (!response.ok) throw new JiraError(operation, response.status);
  return response.status === 204 ? null : response.json();
}

async function issueTypeField(projectKey, issueType) {
  const meta = await requestJson('getIssueTypes', route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`);
  const type = pickIssueType(meta.issueTypes ?? meta.values, issueType);
  if (type) return { id: type.id };
  return /^\d+$/.test(String(issueType)) ? { id: String(issueType) } : { name: issueType };
}

export async function createIssue(projectKey, payload, issueType = 'Bug') {
  const issuetype = await issueTypeField(projectKey, issueType);
  const created = await requestJson('createIssue', route`/rest/api/3/issue`, {
    method: 'POST',
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        issuetype,
        summary: payload.summary,
        description: textToAdf(payload.description),
        labels: payload.labels
      }
    })
  });
  return { issueId: created.id, issueKey: created.key };
}

export async function findIssueByFingerprint(projectKey, fingerprint) {
  const jql = `project = "${projectKey}" AND labels = codesentinel AND text ~ "\\"${FINGERPRINT_MARKER}${fingerprint}\\"" AND statusCategory != Done`;
  const result = await requestJson('findIssueByFingerprint', route`/rest/api/3/search/jql`, {
    method: 'POST',
    body: JSON.stringify({ jql, fields: ['description'], maxResults: 10 })
  });
  const match = (result.issues ?? []).find((issue) => extractFingerprint(adfToText(issue.fields?.description)) === fingerprint);
  return match ? { issueId: match.id, issueKey: match.key } : null;
}

export async function addComment(issueKey, text) {
  await requestJson('addComment', route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({ body: textToAdf(text) })
  });
}

// Returns true when transitioned, 'already-done' when the issue is already in a Done category, false otherwise.
export async function transitionToDone(issueKey) {
  const issue = await requestJson('getIssueStatus', route`/rest/api/3/issue/${issueKey}?fields=status`);
  if (issue.fields?.status?.statusCategory?.key === 'done') return 'already-done';
  const { transitions = [] } = await requestJson('getTransitions', route`/rest/api/3/issue/${issueKey}/transitions`);
  const done = transitions.find((transition) => transition.to?.statusCategory?.key === 'done');
  if (!done) return false;
  await requestJson('transitionToDone', route`/rest/api/3/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: done.id } })
  });
  return true;
}

export const jiraClient = { createIssue, findIssueByFingerprint, addComment, transitionToDone };
