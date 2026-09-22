#!/usr/bin/env node
import path from 'node:path';
import { scanDirectory } from './scanner.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const targetArg = args.find((arg) => !arg.startsWith('--')) || '.';
const target = path.resolve(process.cwd(), targetArg);

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

try {
  const report = await scanDirectory(target);

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const { summary, meta } = report;
    console.log('\n  CodeSentinel security report');
    console.log('  ----------------------------------------');
    console.log(`  Target:    ${target}`);
    console.log(`  Score:     ${summary.score}/100 (${summary.grade})`);
    console.log(`  Scanned:   ${plural(meta.scannedFiles, 'file')} in ${meta.durationMs} ms`);
    console.log(`  Findings:  ${summary.totalFindings} total | ${summary.severityCounts.critical} critical | ${summary.severityCounts.high} high | ${summary.severityCounts.medium} medium`);

    if (!report.findings.length) {
      console.log('\n  No pattern-based issues were detected.');
    } else {
      console.log('');
      for (const finding of report.findings) {
        console.log(`  [${finding.severity.toUpperCase()}] ${finding.ruleId} ${finding.title}`);
        console.log(`  ${finding.file}:${finding.line}:${finding.column}`);
        console.log(`  Fix: ${finding.remediation}\n`);
      }
    }

    console.log('  Note: static analysis can produce false positives and does not replace a security review.\n');
  }

  process.exitCode = report.summary.severityCounts.critical > 0 ? 2
    : report.summary.severityCounts.high > 0 ? 1
      : 0;
} catch (error) {
  console.error(`CodeSentinel could not scan the target: ${error.message}`);
  process.exitCode = 3;
}
