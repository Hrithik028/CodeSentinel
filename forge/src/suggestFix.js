import { RULES } from './shared/rules.js';
import { extractFingerprint } from './shared/ingest.js';

export const SUGGESTION_PREFIX = 'AI-generated suggestion (advisory only)';
const MAX_EXCERPT_CHARS = 400;
const MAX_SUGGESTION_CHARS = 4000;

// Defence in depth on top of the scanner's SEC001 redaction: mask quoted values after
// credential-like keys and any long token-like run before it leaves the site.
export function redactForLlm(text) {
  return String(text ?? '')
    .slice(0, MAX_EXCERPT_CHARS)
    .replace(/(["'`]?(?:api[_-]?key|secret|password|passwd|pwd|token|private[_-]?key|auth\w*|credential\w*)["'`]?\]?\s*[:=]\s*["'`])[^"'`\n]*(["'`])/gi, '$1[REDACTED]$2')
    .replace(/\b(?:[A-Za-z0-9+/_-]{24,}|[A-Fa-f0-9]{32,})\b/g, '[REDACTED]');
}

// Parses the description written by buildIssuePayload (the scanner excerpt is a single line).
export function parseIssue({ labels = [], description = '' }) {
  const ruleId = labels.find((label) => /^sec-SEC\d{3}$/.test(label))?.slice(4) ?? null;
  const fingerprint = extractFingerprint(description);
  const excerpt = /\nExcerpt:\n([^\n]*)/.exec(`\n${description}`)?.[1] ?? null;
  const file = /^Location: (.+):\d+:\d+$/m.exec(description)?.[1] ?? null;
  return { ruleId, fingerprint, excerpt, file };
}

export function buildPrompt({ rule, file, excerpt }) {
  const language = file?.includes('.') ? file.slice(file.lastIndexOf('.') + 1) : 'unknown';
  return [
    {
      role: 'system',
      content:
        'You are a secure-coding assistant. Given a static-analysis finding and a short redacted code excerpt, ' +
        'propose a minimal, safe fix. Reply in under 200 words: one sentence on the risk, then a corrected code snippet, ' +
        'then one sentence on how to verify it. Never ask for or reproduce secrets.'
    },
    {
      role: 'user',
      content: [
        `Rule: ${rule.id} — ${rule.title} (${rule.severity}, ${rule.category})`,
        `Why: ${rule.message}`,
        `Guidance: ${rule.remediation}`,
        `Language: ${language}`,
        'Excerpt (redacted):',
        excerpt
      ].join('\n')
    }
  ];
}

export function createLlmClient({ fetch, apiKey, baseUrl = 'https://api.openai.com/v1', model = 'gpt-4o-mini' }) {
  return async function complete(messages) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 500 })
    });
    if (!response.ok) throw Object.assign(new Error(`LLM request failed with HTTP ${response.status}`), { status: response.status });
    const body = await response.json();
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('LLM returned an empty suggestion');
    return text;
  };
}

// readIssue runs as the user (enforces issue permissions); addComment runs as the app.
export function createSuggestFix({ store, readIssue, addComment, llm }) {
  return async function suggestFix(issueKey) {
    if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(issueKey ?? '')) throw new Error('Open this action from a Jira issue.');
    const issue = await readIssue(issueKey);
    if (!issue.labels?.includes('codesentinel')) throw new Error('This issue was not created by CodeSentinel.');

    const repo = ((await store.getConfig('repos')) ?? []).find((item) => item.projectKey === issue.projectKey);
    if (!repo?.llmOptIn) throw new Error('Suggest fix is turned off for this project. A project admin can enable it on the CodeSentinel page.');
    if (!llm) throw new Error('No LLM is configured for this app installation.');

    const { ruleId, excerpt, file } = parseIssue(issue);
    const rule = RULES.find((item) => item.id === ruleId);
    if (!rule || excerpt === null) throw new Error('Could not read the CodeSentinel finding from this issue.');

    const suggestion = (await llm(buildPrompt({ rule, file, excerpt: redactForLlm(excerpt) }))).slice(0, MAX_SUGGESTION_CHARS);
    const comment = `${SUGGESTION_PREFIX}\n\n${suggestion}\n\n---\nGenerated from rule ${rule.id} and a redacted excerpt. Review before applying; CodeSentinel never changes code or issue status.`;
    await addComment(issueKey, comment);
    return { ok: true, suggestion };
  };
}
