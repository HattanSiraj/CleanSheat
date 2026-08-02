const HISTORY_LIMIT = 25;
const HISTORY_SNAPSHOT_BUDGET = 500000;

export function getHistorySnapshotSize(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((total, child) => total + getHistorySnapshotSize(child), 0);
  }
  if (action.kind === "cells") return action.changes?.length ?? 0;
  if (["deleteRows", "moveRowsToBin", "restoreRowsFromBin"].includes(action.kind)) {
    const entries = action.entries ?? action.rows ?? [];
    return entries.reduce((total, item) => total + Object.keys(item.row ?? item ?? {}).length, 0);
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

export function normalizeHistorySnapshot(history, {
  limit = HISTORY_LIMIT,
  snapshotBudget = HISTORY_SNAPSHOT_BUDGET,
} = {}) {
  const past = keepNewestHistoryActions(history?.past, limit, snapshotBudget);
  const future = keepNewestHistoryActions(history?.future, limit, snapshotBudget - past.size);
  return { past: past.actions, future: future.actions };
}

function keepNewestHistoryActions(actions, limit, snapshotBudget) {
  if (!Array.isArray(actions) || snapshotBudget <= 0) return { actions: [], size: 0 };
  const kept = [];
  let total = 0;
  for (let index = actions.length - 1; index >= 0 && kept.length < limit; index -= 1) {
    const action = actions[index];
    if (!action || typeof action !== "object" || typeof action.kind !== "string") continue;
    const size = getHistorySnapshotSize(action);
    if (size > snapshotBudget) continue;
    if (total + size > snapshotBudget) break;
    kept.unshift(action);
    total += size;
  }
  return { actions: kept, size: total };
}
