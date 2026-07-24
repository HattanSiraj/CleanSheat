const SPLIT_SEPARATORS = {
  comma: ",",
  hyphen: "-",
  slash: "/",
};

const COMBINE_SEPARATORS = {
  space: " ",
  comma: ", ",
  hyphen: "-",
  slash: "/",
  none: "",
};

export function buildDuplicatePlan(rows, options, collectDeletedRows = true) {
  const columns = uniqueStrings(options?.columns);
  if (!columns.length) return invalidPlan("Choose at least one column.");
  const keep = options?.keep ?? "first";
  if (!["first", "last", "all"].includes(keep)) return invalidPlan("Choose how duplicate rows should be removed.");

  const groups = new Map();
  rows.forEach((row, index) => {
    const values = columns.map((column) => normalizeDuplicateValue(row[column], options));
    const key = JSON.stringify(values);
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      group.lastIndex = index;
    } else {
      groups.set(key, { count: 1, firstIndex: index, lastIndex: index, values });
    }
  });

  let groupCount = 0;
  let duplicateRowCount = 0;
  let deleteCount = 0;
  const examples = [];
  for (const group of groups.values()) {
    if (group.count < 2) continue;
    groupCount += 1;
    duplicateRowCount += group.count;
    deleteCount += keep === "all" ? group.count : group.count - 1;
    if (examples.length < 5) examples.push({ values: group.values, count: group.count });
  }

  const deletedRows = [];
  if (collectDeletedRows && deleteCount) {
    rows.forEach((row, index) => {
      const values = columns.map((column) => normalizeDuplicateValue(row[column], options));
      const group = groups.get(JSON.stringify(values));
      if (!group || group.count < 2) return;
      const shouldDelete = keep === "all"
        || (keep === "first" && index !== group.firstIndex)
        || (keep === "last" && index !== group.lastIndex);
      if (shouldDelete) deletedRows.push({ row, index });
    });
  }

  return {
    valid: true,
    groupCount,
    duplicateRowCount,
    deleteCount,
    deletedRows,
    examples,
  };
}

export function buildTextCleanupPlan(rows, options, collectChanges = true) {
  const columns = uniqueStrings(options?.columns);
  if (!columns.length) return invalidPlan("Choose at least one column.");
  const hasTransformation = options?.trimEdges || options?.collapseWhitespace || (options?.caseMode && options.caseMode !== "keep");
  if (!hasTransformation) return invalidPlan("Choose at least one cleanup option.");

  let changeCount = 0;
  const changes = [];
  const examples = [];
  for (const row of rows) {
    for (const column of columns) {
      const before = row[column] ?? "";
      const after = cleanTextValue(before, options);
      if (String(before) === after) continue;
      changeCount += 1;
      if (collectChanges) changes.push({ rowId: row.__rowId, column, before, after });
      if (examples.length < 5) examples.push({ column, before: String(before), after });
    }
  }
  return { valid: true, changeCount, changes, examples };
}

export function cleanTextValue(value, options) {
  let result = String(value ?? "");
  if (options?.trimEdges) result = result.trim();
  if (options?.collapseWhitespace) result = result.replace(/\s+/g, " ");
  if (options?.caseMode === "lower") result = result.toLowerCase();
  if (options?.caseMode === "upper") result = result.toUpperCase();
  if (options?.caseMode === "title") result = result.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return result;
}

export function getSplitPreview(rows, options) {
  const validation = validateSplitOptions(options);
  if (!validation.valid) return validation;
  const examples = [];
  let changedRowCount = 0;
  for (const row of rows) {
    const outputs = splitValue(row[options.sourceColumn], options);
    changedRowCount += 1;
    if (examples.length < 5) {
      examples.push({ before: String(row[options.sourceColumn] ?? ""), outputs });
    }
  }
  return { valid: true, changedRowCount, examples };
}

export function getCombinePreview(rows, options) {
  const validation = validateCombineOptions(options);
  if (!validation.valid) return validation;
  const examples = [];
  let changedRowCount = 0;
  for (const row of rows) {
    const after = combineValue(row, options);
    changedRowCount += 1;
    if (examples.length < 5) {
      examples.push({ values: options.sourceColumns.map((column) => String(row[column] ?? "")), after });
    }
  }
  return { valid: true, changedRowCount, examples };
}

export function applySchemaTransformToRows(rows, operation) {
  if (operation.type === "createColumn") {
    const initialValue = operation.initialMode === "fixed" ? String(operation.initialValue ?? "") : "";
    return rows.map((row) => ({ ...row, [operation.column]: initialValue }));
  }
  if (operation.type === "deleteColumns") {
    return rows.map((row) => {
      const nextRow = { ...row };
      for (const column of operation.columns) delete nextRow[column];
      return nextRow;
    });
  }
  if (operation.type === "splitColumn") {
    return rows.map((row) => {
      const nextRow = { ...row };
      const outputs = splitValue(row[operation.sourceColumn], operation);
      operation.outputColumns.forEach((column, index) => { nextRow[column] = outputs[index] ?? ""; });
      if (operation.removeSources) delete nextRow[operation.sourceColumn];
      return nextRow;
    });
  }
  if (operation.type === "combineColumns") {
    return rows.map((row) => {
      const nextRow = { ...row, [operation.outputColumn]: combineValue(row, operation) };
      if (operation.removeSources) {
        for (const column of operation.sourceColumns) delete nextRow[column];
      }
      return nextRow;
    });
  }
  throw new Error(`Unsupported schema operation: ${operation.type}`);
}

export function getSchemaOperationColumns(columns, visibleColumns, operation) {
  if (operation.type === "createColumn") {
    return {
      nextColumns: [...columns, operation.column],
      nextVisibleColumns: [...visibleColumns, operation.column],
      addedColumns: [operation.column],
      removedColumns: [],
    };
  }
  if (operation.type === "deleteColumns") {
    const removed = uniqueStrings(operation.columns);
    return {
      nextColumns: columns.filter((column) => !removed.includes(column)),
      nextVisibleColumns: visibleColumns.filter((column) => !removed.includes(column)),
      addedColumns: [],
      removedColumns: removed,
    };
  }
  const sourceColumns = operation.type === "splitColumn" ? [operation.sourceColumn] : operation.sourceColumns;
  const outputColumns = operation.type === "splitColumn" ? operation.outputColumns : [operation.outputColumn];
  const removed = operation.removeSources ? sourceColumns : [];
  const remaining = columns.filter((column) => !removed.includes(column) && !outputColumns.includes(column));
  const sourceIndexes = sourceColumns.map((column) => columns.indexOf(column)).filter((index) => index >= 0);
  const originalInsertAt = sourceIndexes.length ? Math.max(...sourceIndexes) + 1 : columns.length;
  const removedBeforeInsert = removed.filter((column) => columns.indexOf(column) < originalInsertAt).length;
  const insertAt = Math.min(originalInsertAt - removedBeforeInsert, remaining.length);
  const nextColumns = [...remaining.slice(0, insertAt), ...outputColumns, ...remaining.slice(insertAt)];
  const anySourceVisible = sourceColumns.some((column) => visibleColumns.includes(column));
  const nextVisible = nextColumns.filter((column) => (
    visibleColumns.includes(column) || (outputColumns.includes(column) && anySourceVisible)
  ));
  return { nextColumns, nextVisibleColumns: nextVisible, addedColumns: outputColumns, removedColumns: removed };
}

export function validateSchemaOperation(columns, operation) {
  if (operation.type === "createColumn") {
    const column = String(operation.column ?? "").trim();
    if (!column) return invalidPlan("Enter a column name.");
    if (column.toLocaleLowerCase() === "__rowid") return invalidPlan("This column name is reserved.");
    if (columns.some((current) => current.toLocaleLowerCase() === column.toLocaleLowerCase())) {
      return invalidPlan(`Column "${column}" already exists.`);
    }
    if (!["empty", "fixed"].includes(operation.initialMode)) return invalidPlan("Choose how the column should start.");
    return { valid: true };
  }
  if (operation.type === "deleteColumns") {
    const selected = uniqueStrings(operation.columns);
    if (!selected.length) return invalidPlan("Choose at least one column.");
    const missing = selected.find((column) => !columns.includes(column));
    if (missing) return invalidPlan(`Column "${missing}" is missing.`);
    if (selected.length >= columns.length) return invalidPlan("Keep at least one column.");
    return { valid: true };
  }
  if (operation.type === "splitColumn") {
    const validation = validateSplitOptions(operation);
    if (!validation.valid) return validation;
    if (!columns.includes(operation.sourceColumn)) return invalidPlan(`Column "${operation.sourceColumn}" is missing.`);
    const normalizedOutputs = operation.outputColumns.map((column) => String(column).trim());
    const conflict = normalizedOutputs.find((column) => columns.includes(column) && column !== operation.sourceColumn);
    if (conflict) return invalidPlan(`Column "${conflict}" already exists.`);
    if (normalizedOutputs.includes(operation.sourceColumn)) return invalidPlan("Output columns must use new names.");
    return { valid: true };
  }
  if (operation.type === "combineColumns") {
    const validation = validateCombineOptions(operation);
    if (!validation.valid) return validation;
    const missing = operation.sourceColumns.find((column) => !columns.includes(column));
    if (missing) return invalidPlan(`Column "${missing}" is missing.`);
    const outputColumn = String(operation.outputColumn).trim();
    if (columns.includes(outputColumn)) return invalidPlan(`Column "${outputColumn}" already exists.`);
    return { valid: true };
  }
  return invalidPlan("Unsupported column operation.");
}

export function getSchemaRecipeDependencies(step) {
  if (step.type === "createColumn") return { inputs: [], outputs: [step.column] };
  if (step.type === "deleteColumns") return { inputs: step.columns ?? [], outputs: [] };
  if (step.type === "splitColumn") return { inputs: [step.sourceColumn], outputs: step.outputColumns };
  if (step.type === "combineColumns") return { inputs: step.sourceColumns, outputs: [step.outputColumn] };
  return { inputs: [], outputs: [] };
}

export function mergeVisibleColumnOrder(columns, visibleColumnOrder) {
  const visibleSet = new Set(visibleColumnOrder);
  const knownVisible = visibleColumnOrder.filter((column) => columns.includes(column));
  let visibleIndex = 0;
  return columns.map((column) => (
    visibleSet.has(column) ? knownVisible[visibleIndex++] : column
  ));
}

function splitValue(value, options) {
  const text = String(value ?? "");
  let parts;
  let joiner;
  if (options.separatorMode === "whitespace") {
    parts = text.trim() ? text.trim().split(/\s+/) : [];
    joiner = " ";
  } else {
    const separator = getSplitSeparator(options);
    parts = text.split(separator);
    joiner = separator;
  }
  const outputCount = options.outputColumns.length;
  if (parts.length > outputCount) {
    parts = [...parts.slice(0, outputCount - 1), parts.slice(outputCount - 1).join(joiner)];
  }
  while (parts.length < outputCount) parts.push("");
  return parts;
}

function combineValue(row, options) {
  const separator = options.separatorMode === "custom"
    ? String(options.customSeparator ?? "")
    : COMBINE_SEPARATORS[options.separatorMode] ?? " ";
  const values = options.sourceColumns.map((column) => String(row[column] ?? ""));
  return (options.skipEmpty ? values.filter((value) => value.trim() !== "") : values).join(separator);
}

function getSplitSeparator(options) {
  if (options.separatorMode === "custom") return String(options.customSeparator ?? "");
  return SPLIT_SEPARATORS[options.separatorMode] ?? "";
}

function validateSplitOptions(options) {
  if (!String(options?.sourceColumn ?? "").trim()) return invalidPlan("Choose a source column.");
  const outputs = uniqueStrings(options?.outputColumns);
  if (outputs.length < 2 || outputs.length !== options.outputColumns.length) return invalidPlan("Enter at least two unique output-column names.");
  if (options.separatorMode === "custom" && !String(options.customSeparator ?? "")) return invalidPlan("Enter a custom separator.");
  return { valid: true };
}

function validateCombineOptions(options) {
  const sources = uniqueStrings(options?.sourceColumns);
  if (sources.length < 2 || sources.length !== options.sourceColumns.length) return invalidPlan("Choose at least two unique source columns.");
  if (!String(options?.outputColumn ?? "").trim()) return invalidPlan("Enter an output-column name.");
  return { valid: true };
}

function normalizeDuplicateValue(value, options) {
  let normalized = String(value ?? "");
  if (options?.trimValues) normalized = normalized.trim();
  if (options?.ignoreCase) normalized = normalized.toLowerCase();
  return normalized;
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  const normalized = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  return [...new Set(normalized)];
}

function invalidPlan(error) {
  return {
    valid: false,
    error,
    examples: [],
    changes: [],
    deletedRows: [],
    changeCount: 0,
    changedRowCount: 0,
    deleteCount: 0,
    duplicateRowCount: 0,
    groupCount: 0,
  };
}
