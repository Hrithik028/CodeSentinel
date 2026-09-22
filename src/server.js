import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDirectory } from './scanner.js';

const fileName = fileURLToPath(import.meta.url);
const sourceDirectory = path.dirname(fileName);
const projectRoot = path.resolve(sourceDirectory, '..');
const publicDirectory = path.join(projectRoot, 'public');
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || '127.0.0.1';

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function resolveScanTarget(value) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : 'samples/vulnerable-app';
  const target = path.resolve(projectRoot, requested);
  const relative = path.relative(projectRoot, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('For safety, the dashboard only scans folders inside the CodeSentinel project.');
  }
  return target;
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(publicDirectory, `.${requestedPath}`);
  const relative = path.relative(publicDirectory, filePath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': content.length,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      'Referrer-Policy': 'no-referrer'
    });
    response.end(content);
  } catch (error) {
    sendJson(response, error.code === 'ENOENT' ? 404 : 500, { error: 'Resource not found.' });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', service: 'CodeSentinel', version: '1.0.0' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/scan') {
      const body = await readJson(request);
      const target = resolveScanTarget(body.path);
      const report = await scanDirectory(target);
      sendJson(response, 200, report);
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    const isUserError = error instanceof SyntaxError || /safety|directory|large/i.test(error.message);
    sendJson(response, isUserError ? 400 : 500, {
      error: isUserError ? error.message : 'The scan could not be completed.'
    });
  }
});

server.listen(port, host, () => {
  console.log(`CodeSentinel is running at http://${host}:${port}`);
  console.log('Press Ctrl+C to stop the server.');
});
