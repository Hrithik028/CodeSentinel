import Resolver from '@forge/resolver';
import { smokeTest } from './smoke.js';

const notImplemented = (name) => async () => {
  throw new Error(`${name} is not implemented yet`);
};

const resolver = new Resolver();
resolver.define('smokeTest', () => smokeTest());

export const resolverHandler = resolver.getDefinitions();
export { resolverHandler as resolver };

export const ingest = async () => ({ statusCode: 501, headers: { 'Content-Type': ['application/json'] }, body: '{"error":"Not implemented"}' });
export const mcp = async () => ({ statusCode: 501, headers: { 'Content-Type': ['application/json'] }, body: '{"error":"Not implemented"}' });
export const rescan = notImplemented('rescan');
export const scanWorker = notImplemented('scanWorker');
export const suggestFix = new Resolver().getDefinitions();
export const rovoPosture = notImplemented('rovoPosture');
export const rovoFindings = notImplemented('rovoFindings');
