import api, { route } from '@forge/api';

async function hasPermission(projectKey, permission) {
  const path = projectKey
    ? route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${permission}`
    : route`/rest/api/3/mypermissions?permissions=${permission}`;
  const response = await api.asUser().requestJira(path, {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) return false;
  const body = await response.json();
  return Boolean(body.permissions?.[permission]?.havePermission);
}

export const canAdminister = (projectKey) => hasPermission(projectKey, 'ADMINISTER_PROJECTS');
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
