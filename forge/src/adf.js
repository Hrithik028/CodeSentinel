// Converts the plain-text description from buildIssuePayload into Atlassian Document Format.
// The line after "Excerpt:" becomes a code block so the snippet is not re-interpreted as markup.
export function textToAdf(text) {
  const content = [];
  const lines = String(text ?? '').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === 'Excerpt:' && index + 1 < lines.length) {
      content.push(paragraph('Excerpt:'));
      content.push({ type: 'codeBlock', content: textNode(lines[index + 1]) });
      index += 1;
    } else if (line === '---') {
      content.push({ type: 'rule' });
    } else if (line !== '') {
      content.push(paragraph(line));
    }
  }
  return { type: 'doc', version: 1, content };
}

export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text ?? '';
  const children = (node.content ?? []).map(adfToText);
  return ['paragraph', 'codeBlock', 'heading'].includes(node.type) ? `${children.join('')}\n` : children.join('');
}

function textNode(text) {
  return text ? [{ type: 'text', text }] : [];
}

function paragraph(text) {
  return { type: 'paragraph', content: textNode(text) };
}
