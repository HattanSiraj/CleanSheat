export const ALL_ISSUE_COLUMNS = "__all_issue_columns__";

export const FILL_METHODS = [
  { id: "custom", label: "Custom value", description: "Replace every target with text you enter." },
  { id: "mode", label: "Most common value", description: "Use the valid value that appears most often.", types: ["Text", "Category", "Boolean"] },
  { id: "median", label: "Median", description: "Use the middle valid numeric value.", types: ["Number", "Integer"] },
  { id: "average", label: "Average", description: "Use the average of all valid numeric values.", types: ["Number", "Integer"] },
  { id: "previous", label: "Previous valid value", description: "Copy the nearest valid value above it." },
  { id: "next", label: "Next valid value", description: "Copy the nearest valid value below it." },
  { id: "distribution", label: "Current distribution", description: "Preserve the proportions of valid category values.", types: ["Category"] },
];

export function getFillMethodsForType(type) {
  return FILL_METHODS.filter((method) => !method.types || method.types.includes(type));
}

export function calculateColumnFill(rows, options, collectChanges = false) {
  const { column, customValue = "", isValid, method, scope = "both", type } = options;
  const methodDefinition = FILL_METHODS.find((item) => item.id === method);
  if (!methodDefinition || (methodDefinition.types && !methodDefinition.types.includes(type))) {
    return emptyResult("This filling method is not available for the selected column type.");
  }

  const stateAt = (index) => createCellState(rows[index], index, column, isValid);
  let targetCount = 0;
  for (let index = 0; index < rows.length; index += 1) {
    if (isTarget(stateAt(index), scope)) targetCount += 1;
  }
  if (!targetCount) return emptyResult("No cells match the selected target.");

  const result = createResult(targetCount, collectChanges);
  if (method === "previous") {
    let previousValue;
    for (let index = 0; index < rows.length; index += 1) {
      const state = stateAt(index);
      if (state.valid) previousValue = state.value;
      if (isTarget(state, scope)) recordReplacement(result, state, previousValue);
    }
    return finishResult(result, "No previous valid value was available for these cells.");
  }

  if (method === "next") {
    let nextValue;
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const state = stateAt(index);
      if (state.valid) nextValue = state.value;
      if (isTarget(state, scope)) recordReplacement(result, state, nextValue);
    }
    result.examples.sort((a, b) => a.row - b.row);
    return finishResult(result, "No next valid value was available for these cells.");
  }

  const validValues = [];
  if (method !== "custom") {
    for (let index = 0; index < rows.length; index += 1) {
      const state = stateAt(index);
      if (state.valid) validValues.push(state.value);
    }
  }
  if (method !== "custom" && !validValues.length) {
    return emptyResult("This column needs at least one valid source value.", targetCount);
  }

  if (method === "distribution") {
    const allocations = createDistributionAllocations(validValues, targetCount);
    let targetOrdinal = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const state = stateAt(index);
      if (!isTarget(state, scope)) continue;
      recordReplacement(result, state, distributionValueAt(allocations, targetOrdinal));
      targetOrdinal += 1;
    }
    result.allocations = allocations.map(({ value, count, percent }) => ({ value, count, percent }));
    return finishResult(result);
  }

  let replacement = customValue;
  if (method === "mode") replacement = mostCommonValue(validValues);
  if (method === "median" || method === "average") {
    const numericValues = validValues.map(parseNumericValue).filter((value) => value !== null);
    if (!numericValues.length) return emptyResult("This column needs at least one valid numeric source value.", targetCount);
    const statistic = method === "median" ? median(numericValues) : numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
    replacement = formatStatistic(statistic, type);
  }

  for (let index = 0; index < rows.length; index += 1) {
    const state = stateAt(index);
    if (isTarget(state, scope)) recordReplacement(result, state, replacement);
  }
  return finishResult(result, "The replacement is identical to the target values.");
}

export function calculateMultiColumnCustomFill(rows, columnOptions, options, collectChanges = false) {
  const { customValue = "", scope = "both" } = options;
  const result = createResult(0, collectChanges);

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    for (const columnOption of columnOptions) {
      const state = createCellState(row, rowIndex, columnOption.column, columnOption.isValid);
      if (!isTarget(state, scope)) continue;
      result.targetCount += 1;
      recordReplacement(result, state, customValue);
    }
  }

  return finishResult(result, result.targetCount ? "The replacement is identical to the target values." : "No cells match the selected target.");
}

function createCellState(row, index, column, validate) {
  const value = row[column];
  const empty = String(value ?? "").trim() === "";
  return {
    rowId: row.__rowId ?? index,
    row: index + 1,
    column,
    value: value ?? "",
    empty,
    valid: !empty && Boolean(validate(value)),
  };
}

function isTarget(state, scope) {
  if (scope === "empty") return state.empty;
  if (scope === "invalid") return !state.empty && !state.valid;
  return state.empty || !state.valid;
}

function createResult(targetCount, collectChanges) {
  return { valid: false, error: "", targetCount, changeCount: 0, skippedCount: 0, examples: [], allocations: [], changes: collectChanges ? [] : null };
}

function emptyResult(error, targetCount = 0) {
  return { valid: false, error, targetCount, changeCount: 0, skippedCount: targetCount, examples: [], allocations: [], changes: null };
}

function recordReplacement(result, state, replacement) {
  if (replacement === undefined || String(state.value) === String(replacement)) {
    result.skippedCount += 1;
    return;
  }
  result.changeCount += 1;
  const example = { row: state.row, column: state.column, before: state.value, after: replacement };
  if (result.examples.length < 5) {
    result.examples.push(example);
  } else {
    const latestIndex = result.examples.reduce((latest, item, index, values) => item.row > values[latest].row ? index : latest, 0);
    if (state.row < result.examples[latestIndex].row) result.examples[latestIndex] = example;
  }
  if (result.changes) result.changes.push({ rowId: state.rowId, column: state.column, before: state.value, after: replacement });
}

function finishResult(result, noChangesError = "No cells can be filled with this method.") {
  result.valid = result.changeCount > 0;
  result.error = result.valid ? "" : noChangesError;
  result.examples.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column));
  return result;
}

function mostCommonValue(values) {
  const counts = new Map();
  let winner = values[0];
  let winnerCount = 0;
  for (const value of values) {
    const key = String(value).trim();
    const nextCount = (counts.get(key)?.count ?? 0) + 1;
    if (!counts.has(key)) counts.set(key, { count: nextCount, value });
    else counts.get(key).count = nextCount;
    if (nextCount > winnerCount) {
      winner = counts.get(key).value;
      winnerCount = nextCount;
    }
  }
  return winner;
}

function parseNumericValue(value) {
  const numeric = Number(String(value).trim().replaceAll(",", ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatStatistic(value, type) {
  return type === "Integer" ? String(Math.round(value)) : value.toFixed(2);
}

function createDistributionAllocations(values, targetCount) {
  const counts = new Map();
  values.forEach((value, index) => {
    const key = String(value).trim();
    if (!counts.has(key)) counts.set(key, { value, sourceCount: 0, order: index });
    counts.get(key).sourceCount += 1;
  });
  const allocations = [...counts.values()].map((item) => {
    const raw = targetCount * item.sourceCount / values.length;
    return { ...item, raw, count: Math.floor(raw), percent: item.sourceCount * 100 / values.length };
  });
  let remainder = targetCount - allocations.reduce((sum, item) => sum + item.count, 0);
  for (const item of [...allocations].sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)) || b.sourceCount - a.sourceCount || a.order - b.order)) {
    if (!remainder) break;
    item.count += 1;
    remainder -= 1;
  }
  return allocations;
}

function distributionValueAt(allocations, targetOrdinal) {
  let boundary = 0;
  for (const allocation of allocations) {
    boundary += allocation.count;
    if (targetOrdinal < boundary) return allocation.value;
  }
  return allocations.at(-1)?.value;
}
