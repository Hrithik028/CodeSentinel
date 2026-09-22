const form = document.querySelector('#scan-form');
const pathInput = document.querySelector('#scan-path');
const scanButton = document.querySelector('#scan-button');
const resultsSection = document.querySelector('#results');
const findingsList = document.querySelector('#findings-list');
const template = document.querySelector('#finding-template');
const filters = document.querySelectorAll('.filter');

let currentFindings = [];

function setText(selector, value) {
  document.querySelector(selector).textContent = String(value);
}

function scoreMessage(score) {
  if (score >= 90) return ['Strong posture', 'No urgent pattern-based risks found.'];
  if (score >= 70) return ['Review recommended', 'Address higher-severity findings first.'];
  if (score >= 50) return ['Needs attention', 'Several risks should be fixed before release.'];
  return ['High risk', 'Pause deployment and resolve critical issues.'];
}

function renderFindings(findings) {
  findingsList.replaceChildren();

  if (!findings.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const title = document.createElement('strong');
    title.textContent = 'No findings detected';
    const copy = document.createElement('span');
    copy.textContent = 'The enabled rules did not match any supported source files.';
    empty.append(title, copy);
    findingsList.append(empty);
    return;
  }

  for (const finding of findings) {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector('.finding-card');
    card.dataset.severity = finding.severity;
    const badge = fragment.querySelector('.severity-badge');
    badge.textContent = finding.severity;
    badge.classList.add(finding.severity);
    fragment.querySelector('.finding-main strong').textContent = finding.title;
    fragment.querySelector('.finding-main small').textContent = `${finding.ruleId} · ${finding.category}`;
    fragment.querySelector('.finding-location').textContent = `${finding.file}:${finding.line}`;
    fragment.querySelector('.finding-message').textContent = finding.message;
    fragment.querySelector('.finding-fix').textContent = finding.remediation;
    fragment.querySelector('code').textContent = finding.excerpt || '(source line unavailable)';
    const summary = fragment.querySelector('.finding-summary');
    summary.addEventListener('click', () => {
      summary.setAttribute('aria-expanded', summary.getAttribute('aria-expanded') !== 'true');
    });
    findingsList.append(fragment);
  }
}

function renderReport(report) {
  const { summary, meta, findings } = report;
  const [label, copy] = scoreMessage(summary.score);
  currentFindings = findings;

  setText('#report-title', `${meta.target} security posture`);
  setText('#report-meta', `${meta.scannedFiles} files · ${meta.durationMs} ms · ${meta.ruleCount} rules`);
  setText('#score-value', summary.score);
  setText('#score-label', `${label} · Grade ${summary.grade}`);
  setText('#score-copy', copy);
  setText('#critical-count', summary.severityCounts.critical);
  setText('#high-count', summary.severityCounts.high);
  setText('#medium-count', summary.severityCounts.medium);
  setText('#finding-count', summary.totalFindings);

  const ring = document.querySelector('#score-ring');
  ring.style.setProperty('--score', `${summary.score * 3.6}deg`);
  ring.style.setProperty('--ring', summary.score >= 70 ? 'var(--accent)' : summary.score >= 50 ? 'var(--medium)' : 'var(--critical)');
  filters.forEach((filter) => filter.classList.toggle('active', filter.dataset.filter === 'all'));
  renderFindings(findings);
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderError(message) {
  findingsList.replaceChildren();
  const error = document.createElement('div');
  error.className = 'empty-state';
  const title = document.createElement('strong');
  title.textContent = 'Scan could not finish';
  const copy = document.createElement('span');
  copy.textContent = message;
  error.append(title, copy);
  findingsList.append(error);
  setText('#report-title', 'Something went wrong');
  setText('#report-meta', 'Check the folder and try again');
  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  scanButton.disabled = true;
  document.querySelector('.button-label').textContent = 'Scanning…';

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathInput.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'The server rejected the scan.');
    renderReport(data);
  } catch (error) {
    renderError(error.message);
  } finally {
    scanButton.disabled = false;
    document.querySelector('.button-label').textContent = 'Run security scan';
  }
});

filters.forEach((filter) => {
  filter.addEventListener('click', () => {
    filters.forEach((button) => button.classList.remove('active'));
    filter.classList.add('active');
    const value = filter.dataset.filter;
    renderFindings(value === 'all' ? currentFindings : currentFindings.filter((item) => item.severity === value));
  });
});
