export function createBinEntries(rows, rowIds, {
  columns = [],
  reason = "Moved manually",
  sourceAction = "manual",
  movedAt = new Date().toISOString(),
  createId = () => crypto.randomUUID(),
} = {}) {
  const selectedIds = new Set(rowIds);
  return rows.flatMap((row, index) => selectedIds.has(row.__rowId) ? [{
    id: createId(),
    row,
    originalIndex: index,
    originalColumns: [...columns],
    reason,
    sourceAction,
    movedAt,
  }] : []);
}

export function moveEntriesToBin(rows, dataBin, entries) {
  const rowIds = new Set(entries.map((entry) => entry.row.__rowId));
  const existingEntryIds = new Set(dataBin.map((entry) => entry.id));
  return {
    rows: rows.filter((row) => !rowIds.has(row.__rowId)),
    dataBin: [...dataBin, ...entries.filter((entry) => !existingEntryIds.has(entry.id))],
  };
}

export function restoreEntriesFromBin(rows, dataBin, entries, columns) {
  const entryIds = new Set(entries.map((entry) => entry.id));
  const existingRowIds = new Set(rows.map((row) => row.__rowId));
  const restoredRows = [...rows];
  for (const entry of [...entries].sort((left, right) => left.originalIndex - right.originalIndex)) {
    if (existingRowIds.has(entry.row.__rowId)) continue;
    const restoredRow = projectRow(entry.row, columns);
    restoredRows.splice(Math.min(entry.originalIndex, restoredRows.length), 0, restoredRow);
    existingRowIds.add(restoredRow.__rowId);
  }
  return {
    rows: restoredRows,
    dataBin: dataBin.filter((entry) => !entryIds.has(entry.id)),
  };
}

export function normalizeDataBin(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => entry?.id && entry?.row?.__rowId).map((entry) => ({
    ...entry,
    originalIndex: Math.max(0, Number(entry.originalIndex) || 0),
    originalColumns: Array.isArray(entry.originalColumns) ? entry.originalColumns : [],
    reason: String(entry.reason || "Moved to Data Bin"),
    sourceAction: String(entry.sourceAction || "unknown"),
    movedAt: String(entry.movedAt || ""),
  }));
}

export function createDataBinExportRows(entries) {
  return entries.map((entry) => ({
    "Bin Reason": entry.reason,
    "Bin Source": entry.sourceAction,
    "Moved At": entry.movedAt,
    "Original Row": entry.originalIndex + 1,
    ...entry.row,
  }));
}

export function getArchivedColumns(entry, columns) {
  const current = new Set(columns);
  return (entry.originalColumns ?? Object.keys(entry.row)).filter((column) => (
    column !== "__rowId" && !current.has(column)
  ));
}

function projectRow(row, columns) {
  const projected = { __rowId: row.__rowId };
  for (const column of columns) projected[column] = row[column] ?? "";
  return projected;
}
