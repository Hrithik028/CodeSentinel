import assert from 'node:assert/strict';
import test from 'node:test';
import { createMcpHandler, PROTOCOL_VERSION } from '../src/mcpHandler.js';
import { getSecurityPosture, listOpenFindings } from '../src/posture.js';
import { createSuggestFix, parseIssue, redactForLlm, SUGGESTION_PREFIX } from '../src/suggestFix.js';
import { processReport } from '../src/processReport.js';
import { textToAdf, adfToText } from '../src/adf.js';
import { buildIssuePayload } from '../src/shared/ingest.js';
import { generateToken, hashToken } from '../src/repos.js';
import { fakeJira, fixture, REPO, tempStore } from './helpers.js';

async function seeded({ llmOptIn = false } = {}) {
  const store = await tempStore();
  await store.setConfig('repos', [{ ...REPO, llmOptIn }]);
  const jira = fakeJira();
  await processReport(fixture('scan-a.json'), REPO, { source: 'ci', store, jira });
  return { store, jira };
}

async function mcpSetup() {
  const { store } = await seeded();
  const token = generateToken();
  await store.setConfig('mcp', { tokenHash: hashToken(token) });
  const handler = createMcpHandler({ store });
  const call = (message, headers = { Authorization: `Bearer ${token}` }) =>
    handler({ method: 'POST', headers, body: typeof message === 'string' ? message : JSON.stringify(message) });
  return { call, store };
}

test('posture and findings come from the latest stored scan', async () => {
  const { store } = await seeded();
  const { projects } = await getSecurityPosture(store, {});
  const report = fixture('scan-a.json');
  assert.equal(projects.length, 1);
  assert.equal(projects[0].score, report.summary.score);
  assert.equal(projects[0].openIssues, report.findings.filter((f) => ['critical', 'high'].includes(f.severity)).length);

  const critical = await listOpenFindings(store, { severity: 'critical' });
  assert.ok(critical.findings.length > 0 && critical.findings.every((f) => f.severity === 'critical' && f.issueKey));
  const all = await listOpenFindings(store, { limit: 2 });
  assert.equal(all.findings.length, 2);
  assert.equal(all.total, report.findings.length);
  assert.equal(all.findings[0].severity, 'critical');
  await assert.rejects(listOpenFindings(store, { severity: 'bad' }), RangeError);
  assert.deepEqual((await getSecurityPosture(store, { canBrowse: async () => false })).projects, []);
  assert.deepEqual((await getSecurityPosture(store, { projectKey: 'NOPE' })).projects, []);
});

test('MCP rejects bad methods and tokens', async () => {
  const { call } = await mcpSetup();
  const handler = createMcpHandler({ store: await tempStore() });
  assert.equal((await handler({ method: 'GET', headers: {} })).statusCode, 405);
  assert.equal((await call({ jsonrpc: '2.0', id: 1, method: 'ping' }, {})).statusCode, 401);
  assert.equal((await call({ jsonrpc: '2.0', id: 1, method: 'ping' }, { authorization: ['Bearer wrong'] })).statusCode, 401);
  assert.equal((await handler({ method: 'POST', headers: { Authorization: 'Bearer x' }, body: '{}' })).statusCode, 401);
});

test('MCP initialize, tools/list and tools/call', async () => {
  const { call } = await mcpSetup();
  const init = JSON.parse((await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {} } })).body);
  assert.equal(init.result.protocolVersion, PROTOCOL_VERSION);
  assert.deepEqual(init.result.capabilities, { tools: {} });
  assert.equal((await call({ jsonrpc: '2.0', method: 'notifications/initialized' })).statusCode, 202);

  const list = JSON.parse((await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).body);
  assert.deepEqual(list.result.tools.map((t) => t.name), ['get_security_posture', 'list_open_findings']);

  const posture = JSON.parse((await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_security_posture', arguments: { projectKey: 'sec' } } })).body);
  assert.equal(posture.result.structuredContent.projects[0].projectKey, 'SEC');
  assert.deepEqual(JSON.parse(posture.result.content[0].text), posture.result.structuredContent);

  const findings = JSON.parse((await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_open_findings', arguments: { severity: 'high', limit: 1 } } })).body);
  assert.equal(findings.result.structuredContent.findings.length, 1);

  const bad = JSON.parse((await call({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'list_open_findings', arguments: { severity: 'nope' } } })).body);
  assert.equal(bad.result.isError, true);
});

test('MCP JSON-RPC errors', async () => {
  const { call } = await mcpSetup();
  const err = async (message) => JSON.parse((await call(message)).body).error.code;
  assert.equal(await err('{not json'), -32700);
  assert.equal(await err({ id: 1, method: 'ping' }), -32600);
  assert.equal(await err([{ jsonrpc: '2.0', id: 1, method: 'ping' }]), -32600);
  assert.equal(await err({ jsonrpc: '2.0', id: 1, method: 'resources/list' }), -32601);
  assert.equal(await err({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'drop_tables' } }), -32602);
});

function issueFrom(finding, projectKey = 'SEC') {
  const payload = buildIssuePayload(finding);
  return { key: `${projectKey}-1`, projectKey, labels: payload.labels, description: adfToText(textToAdf(payload.description)) };
}

test('parseIssue survives the ADF round trip', () => {
  const finding = fixture('scan-a.json').findings.find((f) => f.severity === 'high');
  const parsed = parseIssue(issueFrom(finding));
  assert.equal(parsed.ruleId, finding.ruleId);
  assert.equal(parsed.fingerprint, finding.fingerprint);
  assert.equal(parsed.excerpt.trim(), finding.excerpt.trim());
  assert.equal(parsed.file, finding.file);
});

test('redactForLlm masks credentials and long tokens', () => {
  assert.equal(redactForLlm('const apiKey = "abc12345xyz";'), 'const apiKey = "[REDACTED]";');
  assert.equal(redactForLlm('fetch(url, ghp_abcdefghijklmnopqrstuvwxyz0123)'), 'fetch(url, [REDACTED])');
  assert.equal(redactForLlm('eval(userInput)'), 'eval(userInput)');
});

test('suggest fix is gated on llmOptIn and comments with the advisory prefix', async () => {
  const finding = fixture('scan-a.json').findings.find((f) => f.severity === 'high');
  const prompts = [];
  const comments = [];
  const llm = async (messages) => { prompts.push(messages); return 'Use parameterised queries.'; };
  const addComment = async (key, text) => comments.push({ key, text });

  const off = await seeded({ llmOptIn: false });
  const blocked = createSuggestFix({ store: off.store, readIssue: async () => issueFrom(finding), addComment, llm });
  await assert.rejects(blocked('SEC-1'), /turned off/);
  assert.equal(prompts.length, 0);

  const on = await seeded({ llmOptIn: true });
  const suggest = createSuggestFix({ store: on.store, readIssue: async () => issueFrom(finding), addComment, llm });
  await suggest('SEC-1');
  assert.equal(comments.length, 1);
  assert.ok(comments[0].text.startsWith(SUGGESTION_PREFIX));
  assert.ok(prompts[0][1].content.includes(finding.ruleId));

  await assert.rejects(createSuggestFix({ store: on.store, readIssue: async () => ({ ...issueFrom(finding), labels: [] }), addComment, llm })('SEC-1'), /not created by CodeSentinel/);
  await assert.rejects(createSuggestFix({ store: on.store, readIssue: async () => issueFrom(finding), addComment, llm: null })('SEC-1'), /No LLM/);
  await assert.rejects(suggest('not a key'), /Jira issue/);
});

test('the LLM prompt never contains the raw secret', async () => {
  const secret = fixture('scan-a.json').findings.find((f) => f.ruleId === 'SEC001');
  const leaky = { ...secret, excerpt: 'const password = "hunter2hunter2";' };
  const { store } = await seeded({ llmOptIn: true });
  let prompt = '';
  await createSuggestFix({ store, readIssue: async () => issueFrom(leaky), addComment: async () => {}, llm: async (m) => { prompt = JSON.stringify(m); return 'ok'; } })('SEC-1');
  assert.ok(!prompt.includes('hunter2'));
});
