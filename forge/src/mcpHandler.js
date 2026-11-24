import { tokenMatches } from './repos.js';
import { getSecurityPosture, listOpenFindings } from './posture.js';

export const PROTOCOL_VERSION = '2025-06-18';
const MAX_BODY_BYTES = 64 * 1024;

export const TOOLS = [
  {
    name: 'get_security_posture',
    title: 'Get security posture',
    description: 'Latest CodeSentinel score, grade, severity counts and delta for Jira projects linked to GitHub repositories.',
    inputSchema: {
      type: 'object',
      properties: { projectKey: { type: 'string', description: 'Jira project key, e.g. SEC. Omit for every linked project.' } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'list_open_findings',
    title: 'List open findings',
    description: 'Open CodeSentinel findings (rule, severity, file, line, redacted excerpt, Jira issue key), most severe first.',
    inputSchema: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Jira project key. Omit for every linked project.' },
        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  }
];

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': ['application/json'] },
  body: body === undefined ? '' : JSON.stringify(body)
});
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const header = (request, name) => {
  const entry = Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return Array.isArray(entry?.[1]) ? entry[1][0] : entry?.[1];
};

export function createMcpHandler({ store, version = '2.0.0' }) {
  async function callTool(name, args) {
    if (name === 'get_security_posture') return getSecurityPosture(store, { projectKey: args.projectKey });
    if (name === 'list_open_findings') return listOpenFindings(store, args);
    return null;
  }

  async function dispatch(message) {
    if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') return rpcError(message?.id, -32600, 'Invalid Request');
    const { id, method, params = {} } = message;
    const isNotification = id === undefined;
    let result;
    switch (method) {
      case 'initialize':
        result = { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'codesentinel', title: 'CodeSentinel', version } };
        break;
      case 'ping':
        result = {};
        break;
      case 'tools/list':
        result = { tools: TOOLS };
        break;
      case 'tools/call': {
        const args = params.arguments ?? {};
        if (typeof args !== 'object' || Array.isArray(args)) return rpcError(id, -32602, 'arguments must be an object');
        if (!TOOLS.some((tool) => tool.name === params.name)) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
        try {
          const structuredContent = await callTool(params.name, args);
          result = { content: [{ type: 'text', text: JSON.stringify(structuredContent) }], structuredContent };
        } catch (error) {
          if (!(error instanceof RangeError)) throw error;
          result = { content: [{ type: 'text', text: error.message }], isError: true };
        }
        break;
      }
      default:
        if (method.startsWith('notifications/')) return null;
        return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
    }
    return isNotification ? null : { jsonrpc: '2.0', id, result };
  }

  return async function mcp(request) {
    if ((request.method ?? '').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed' });
    const config = await store.getConfig('mcp');
    const auth = header(request, 'authorization') ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
    if (!config?.tokenHash || !token || !tokenMatches(token, config.tokenHash)) return json(401, { error: 'Unauthorized' });

    const body = request.body ?? '';
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return json(413, { error: 'Payload too large' });
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return json(200, rpcError(null, -32700, 'Parse error'));
    }
    if (Array.isArray(message)) return json(200, rpcError(null, -32600, 'Batch requests are not supported'));

    try {
      const response = await dispatch(message);
      return response ? json(200, response) : json(202);
    } catch (error) {
      console.warn(`mcp ${message.method} failed: ${error.status ? `HTTP ${error.status}` : error.name}`);
      return json(200, rpcError(message.id, -32603, 'Internal error'));
    }
  };
}
