// Prefer the configured type; if the project doesn't have it (e.g. no "Bug"), fall back to Task or any standard type.
export function pickIssueType(types, wanted) {
  const standard = (types ?? []).filter((type) => !type.subtask);
  const name = String(wanted ?? '').toLowerCase();
  return standard.find((type) => type.id === String(wanted) || type.name?.toLowerCase() === name)
    ?? standard.find((type) => type.name?.toLowerCase() === 'task')
    ?? standard.find((type) => (type.hierarchyLevel ?? 0) === 0)
    ?? null;
}
