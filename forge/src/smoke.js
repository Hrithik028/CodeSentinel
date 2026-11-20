import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { scanContent } from './shared/scanner.js';

// Deploy smoke test: proves node:crypto and the shared scanner run in the Forge runtime.
export function smokeTest() {
  const digest = createHash('sha256').update('codesentinel').digest('hex');
  const token = randomBytes(8);
  const findings = scanContent('const apiKey = "sk_live_1234567890abcdef";\n', 'smoke.js', '.js');
  return {
    sha256: digest === 'a37ed886823fc5a163f1578f768a0b5c912961e600b268fb522a77c87cf80ff2',
    timingSafeEqual: timingSafeEqual(token, Buffer.from(token)),
    scannerFindings: findings.length,
    fingerprintLength: findings[0]?.fingerprint.length ?? 0
  };
}
