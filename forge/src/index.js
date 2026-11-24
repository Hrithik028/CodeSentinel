import Resolver from '@forge/resolver';
import { smokeTest } from './smoke.js';
import { createIngestHandler } from './ingestHandler.js';
import { createForgeStore } from './store/forgeStore.js';
import { jiraClient } from './jira.js';

const store = createForgeStore();

const notImplemented = (name) => async () => {
  throw new Error(`${name} is not implemented yet`);
};

const resolver = new Resolver();
resolver.define('smokeTest', () => smokeTest());

export const resolverHandler = resolver.getDefinitions();
export { resolverHandler as resolver };

export const ingest = createIngestHandler({ store, jira: jiraClient });
export const mcp = async () => ({ statusCode: 501, headers: { 'Content-Type': ['application/json'] }, body: '{"error":"Not implemented"}' });
export const rescan = notImplemented('rescan');
export const scanWorker = notImplemented('scanWorker');
export const suggestFix = new Resolver().getDefinitions();
export const rovoPosture = notImplemented('rovoPosture');
export const rovoFindings = notImplemented('rovoFindings');
