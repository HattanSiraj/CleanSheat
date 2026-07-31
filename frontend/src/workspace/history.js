const HISTORY_LIMIT = 25;
const HISTORY_SNAPSHOT_BUDGET = 500000;

export function getHistorySnapshotSize(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((total, child) => total + getHistorySnapshotSize(child), 0);
  }
  if (action.kind === "cells") return action.changes?.length ?? 0;
  if (action.kind === "deleteRows") {
    return (action.rows ?? []).reduce((total, item) => total + Object.keys(item.row ?? item ?? {}).length, 0);
  }
  if (action.kind === "schema") {
    return (action.removedValues ?? []).reduce(
      (total, item) => total + Object.keys(item.values ?? {}).length,
      0,
    );
  }
  return 1;
}

export function appendHistoryAction(actions, action, {
  limit = HISTORY_LIMIT,
  snapshotBudget = HISTORY_SNAPSHOT_BUDGET,
} = {}) {
  const actionSize = getHistorySnapshotSize(action);
  if (actionSize > snapshotBudget) return { actions: [], stored: false };

  const candidates = [...actions, action];
  const kept = [];
  let total = 0;
  for (let index = candidates.length - 1; index >= 0 && kept.length < limit; index -= 1) {
    const candidate = candidates[index];
    const size = getHistorySnapshotSize(candidate);
    if (total + size > snapshotBudget) break;
    kept.push(candidate);
    total += size;
  }
  kept.reverse();
  return { actions: kept, stored: true };
}

export function canStoreHistoryAction(action, snapshotBudget = HISTORY_SNAPSHOT_BUDGET) {
  return getHistorySnapshotSize(action) <= snapshotBudget;
}
