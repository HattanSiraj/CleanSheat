const MAX_VISIBLE_ROWS = 4;

export function groupValidationIssues(issues) {
  const groups = new Map();

  for (const issue of issues ?? []) {
    const value = String(issue.value ?? "");
    const key = JSON.stringify([
      issue.column ?? "",
      issue.expected ?? "",
      value,
      issue.reason ?? "",
    ]);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.rows.length < MAX_VISIBLE_ROWS && !existing.rows.includes(issue.row)) {
        existing.rows.push(issue.row);
      }
      continue;
    }

    groups.set(key, {
      ...issue,
      key,
      value,
      count: 1,
      rows: issue.row == null ? [] : [issue.row],
    });
  }

  return [...groups.values()];
}

export function formatIssueRows(group) {
  if (!group?.rows?.length) return "Unknown";
  const remaining = Math.max(0, group.count - group.rows.length);
  return remaining
    ? `${group.rows.join(", ")} +${remaining.toLocaleString()} more`
    : group.rows.join(", ");
}
