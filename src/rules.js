export const RULES = [
  {
    id: 'SEC001',
    title: 'Possible hard-coded secret',
    severity: 'critical',
    category: 'Secrets',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php', '.env', '.yml', '.yaml', '.json'],
    pattern: /(?:api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*["'][^"'\n]{8,}["']/gi,
    message: 'A credential-like value appears to be stored directly in source code.',
    remediation: 'Move the value to an environment variable or secret manager, revoke the exposed value, and rotate it.'
  },
  {
    id: 'SEC002',
    title: 'Dynamic code execution',
    severity: 'critical',
    category: 'Injection',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    pattern: /\b(?:eval|Function)\s*\(/g,
    message: 'Dynamic code execution can allow an attacker to run arbitrary code.',
    remediation: 'Replace dynamic evaluation with explicit parsing, a lookup table, or a constrained interpreter.'
  },
  {
    id: 'SEC003',
    title: 'Shell command execution',
    severity: 'high',
    category: 'Injection',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    pattern: /\b(?:exec|execSync)\s*\(/g,
    message: 'Shell execution becomes dangerous when any argument can contain user-controlled data.',
    remediation: 'Prefer execFile/spawn with a fixed executable and validated argument array; never concatenate untrusted input.'
  },
  {
    id: 'SEC004',
    title: 'SQL query built with string interpolation',
    severity: 'high',
    category: 'Injection',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php'],
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)[^\n]*(?:\$\{|\+\s*[a-z_$]|%s|\.format\s*\()/gi,
    message: 'Building SQL with values embedded in a string can create a SQL injection vulnerability.',
    remediation: 'Use parameterised queries or prepared statements and pass data separately from SQL text.'
  },
  {
    id: 'SEC005',
    title: 'Weak password hashing algorithm',
    severity: 'high',
    category: 'Cryptography',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php'],
    pattern: /(?:createHash\s*\(\s*["'](?:md5|sha1)["']|hashlib\.(?:md5|sha1)\s*\()/gi,
    message: 'MD5 and SHA-1 are too fast and collision-prone for password storage.',
    remediation: 'Use Argon2id, scrypt, or bcrypt with an appropriate work factor and a unique salt.'
  },
  {
    id: 'SEC006',
    title: 'Unsafe HTML assignment',
    severity: 'high',
    category: 'Cross-site scripting',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.html', '.htm'],
    pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML\s*=/g,
    message: 'Writing arbitrary HTML can execute attacker-controlled scripts in the browser.',
    remediation: 'Use textContent for plain text or sanitize trusted markup with a maintained allow-list sanitizer.'
  },
  {
    id: 'SEC007',
    title: 'Permissive CORS policy',
    severity: 'medium',
    category: 'Configuration',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php'],
    pattern: /(?:Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*|cors\s*\(\s*\))/gi,
    message: 'A wildcard cross-origin policy may expose sensitive endpoints to any website.',
    remediation: 'Allow only the exact origins, methods, and headers required by trusted clients.'
  },
  {
    id: 'SEC008',
    title: 'Insecure HTTP endpoint',
    severity: 'medium',
    category: 'Transport security',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.go', '.rb', '.php', '.json', '.yml', '.yaml', '.html'],
    pattern: /http:\/\/(?!localhost\b|127\.0\.0\.1\b|0\.0\.0\.0\b)[^\s"'<>]+/gi,
    message: 'Plain HTTP can expose data to interception or modification in transit.',
    remediation: 'Use HTTPS and validate the remote certificate. Redirect public HTTP traffic to HTTPS.'
  },
  {
    id: 'SEC009',
    title: 'Debug mode enabled',
    severity: 'medium',
    category: 'Configuration',
    extensions: ['.js', '.ts', '.py', '.json', '.yml', '.yaml', '.env'],
    pattern: /\bdebug\s*[:=]\s*(?:true|1|on)\b/gi,
    message: 'Debug mode may reveal stack traces, environment details, or privileged developer endpoints.',
    remediation: 'Disable debug mode in deployed environments and keep detailed errors in protected logs.'
  },
  {
    id: 'SEC010',
    title: 'TLS certificate verification disabled',
    severity: 'critical',
    category: 'Transport security',
    extensions: ['.js', '.ts', '.py', '.java', '.cs', '.go', '.rb', '.php'],
    pattern: /(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/gi,
    message: 'Disabling certificate verification makes encrypted traffic vulnerable to interception.',
    remediation: 'Enable certificate verification and configure a trusted CA bundle when using private certificates.'
  },
  {
    id: 'SEC011',
    title: 'Potential path traversal',
    severity: 'high',
    category: 'Access control',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    pattern: /(?:readFile|readFileSync|createReadStream|sendFile)\s*\([^\n]*(?:req\.(?:query|params|body)|request\.)/g,
    message: 'A file path appears to include request data without an obvious containment check.',
    remediation: 'Resolve paths against a fixed base directory and reject any resolved path outside that directory.'
  },
  {
    id: 'SEC012',
    title: 'Sensitive data written to logs',
    severity: 'medium',
    category: 'Data exposure',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    pattern: /console\.(?:log|info|debug)\s*\([^\n]*(?:password|token|secret|authorization)/gi,
    message: 'Logs may retain sensitive values longer than the application and expose them to more people.',
    remediation: 'Remove the sensitive field or log only a redacted identifier with structured access controls.'
  }
];

export const SEVERITY_WEIGHT = Object.freeze({
  critical: 20,
  high: 10,
  medium: 5,
  low: 2
});
