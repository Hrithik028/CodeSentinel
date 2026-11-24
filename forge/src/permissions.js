import api, { route } from '@forge/api';

async function hasPermission(projectKey, permission, alternatives = []) {
  const path = projectKey
    ? route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${[permission, ...alternatives].join(',')}`
    : route`/rest/api/3/mypermissions?permissions=${permission}`;
  const response = await api.asUser().requestJira(path, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) {
    console.warn(`Permission check ${permission} failed with HTTP ${response.status}`);
    return false;
  }
  const body = await response.json();
  return [permission, ...alternatives].some((key) => Boolean(body.permissions?.[key]?.havePermission));
}

// Jira admins aren't always in a project's Administrators role, so they count as project admins too.
export const canAdminister = (projectKey) => hasPermission(projectKey, 'ADMINISTER_PROJECTS', ['ADMINISTER']);
export const canBrowse = (projectKey) => hasPermission(projectKey, 'BROWSE_PROJECTS');
export const canAdministerJira = () => hasPermission(null, 'ADMINISTER');

export async function canCommentOnIssue(issueKey) {
  const response = await api.asUser().requestJira(route`/rest/api/3/mypermissions?issueKey=${issueKey}&permissions=ADD_COMMENTS`, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return false;
  const body = await response.json();
  return Boolean(body.permissions?.ADD_COMMENTS?.havePermission);
}
