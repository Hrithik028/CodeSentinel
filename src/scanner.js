import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RULES, SEVERITY_WEIGHT } from './rules.js';

const IGNORED_DIRECTORIES = new Set([
  '.git', '.idea', '.next', '.nuxt', '.vscode', 'build', 'coverage', 'dist',
  'node_modules', 'target', 'vendor', 'venv', '.venv', '__pycache__'
]);

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 5000;

function lineDetails(content, index) {
  const before = content.slice(0, index);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  const column = index - lastBreak;
  const rawLine = content.split('\n')[line - 1] ?? '';
  return {
    line,
    column,
    excerpt: rawLine.trim().slice(0, 240)
  };
}

function redactExcerpt(excerpt, ruleId) {
  if (ruleId !== 'SEC001') return excerpt;
  return excerpt.replace(/([:=]\s*["'])[^"']+(["'])/, '$1[REDACTED]$2');
}

async function collectFiles(rootPath) {
  const files = [];
  const skipped = [];

  async function walk(currentPath) {
    if (files.length >= MAX_FILES) return;

    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error) {
      skipped.push({ path: currentPath, reason: error.code || 'unreadable' });
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootPath);
  return { files, skipped, hitFileLimit: files.length >= MAX_FILES };
}

function scanContent(content, relativePath, extension) {
  const findings = [];

  for (const rule of RULES) {
    if (!rule.extensions.includes(extension)) continue;
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const location = lineDetails(content, match.index);
      const fingerprint = createHash('sha256')
        .update(`${rule.id}:${relativePath}:${location.line}:${match[0]}`)
        .digest('hex')
        .slice(0, 16);

      findings.push({
        fingerprint,
        ruleId: rule.id,
        title: rule.title,
        severity: rule.severity,
        category: rule.category,
        file: relativePath,
        line: location.line,
        column: location.column,
        excerpt: redactExcerpt(location.excerpt, rule.id),
        message: rule.message,
        remediation: rule.remediation
      });

      if (match.index === regex.lastIndex) regex.lastIndex += 1;
    }
  }

  return findings;
}

export async function scanDirectory(inputPath) {
  const startedAt = new Date();
  const absolutePath = path.resolve(inputPath);
  const stat = await fs.stat(absolutePath);
  if (!stat.isDirectory()) throw new Error('The scan target must be a directory.');

  const { files, skipped, hitFileLimit } = await collectFiles(absolutePath);
  const findings = [];
  let scannedFiles = 0;
  let scannedBytes = 0;

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (!RULES.some((rule) => rule.extensions.includes(extension))) continue;

    const fileStat = await fs.stat(filePath);
    if (fileStat.size > MAX_FILE_BYTES) {
      skipped.push({ path: path.relative(absolutePath, filePath), reason: 'file-too-large' });
      continue;
    }

    let content;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      skipped.push({ path: path.relative(absolutePath, filePath), reason: error.code || 'unreadable' });
      continue;
    }

    if (content.includes('\u0000')) {
      skipped.push({ path: path.relative(absolutePath, filePath), reason: 'binary-file' });
      continue;
    }

    scannedFiles += 1;
    scannedBytes += fileStat.size;
    const relativePath = path.relative(absolutePath, filePath).split(path.sep).join('/');
    findings.push(...scanContent(content, relativePath, extension));
  }

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) severityCounts[finding.severity] += 1;

  findings.sort((a, b) => {
    const priority = { critical: 0, high: 1, medium: 2, low: 3 };
    return priority[a.severity] - priority[b.severity]
      || a.file.localeCompare(b.file)
      || a.line - b.line;
  });

  const deductions = Object.entries(severityCounts)
    .reduce((total, [severity, count]) => total + SEVERITY_WEIGHT[severity] * count, 0);
  const score = Math.max(0, 100 - deductions);
  const finishedAt = new Date();

  return {
    meta: {
      target: path.basename(absolutePath),
      scannedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      scannedFiles,
      scannedBytes,
      skippedFiles: skipped.length,
      hitFileLimit,
      ruleCount: RULES.length
    },
    summary: {
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F',
      totalFindings: findings.length,
      severityCounts
    },
    findings,
    skipped
  };
}
