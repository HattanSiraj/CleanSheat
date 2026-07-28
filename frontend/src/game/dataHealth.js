export const MAX_HEALTH_ROW_BANDS = 20;
export const MAX_HEALTH_COLUMN_BANDS = 40;

export function buildDataHealthMap({
  rowCount = 0,
  columns = [],
  issues = [],
  maxRowBands = MAX_HEALTH_ROW_BANDS,
  maxColumnBands = MAX_HEALTH_COLUMN_BANDS,
} = {}) {
  const safeRowCount = Math.max(0, Number(rowCount) || 0);
  const safeColumns = Array.isArray(columns) ? columns : [];
  const rowBandCount = Math.min(safeRowCount, Math.max(1, maxRowBands));
  const columnBandCount = Math.min(safeColumns.length, Math.max(1, maxColumnBands));
  if (!rowBandCount || !columnBandCount) {
    return {
      rowCount: safeRowCount,
      columnCount: safeColumns.length,
      rowBandCount: 0,
      columnBandCount: 0,
      cells: [],
      maxIssues: 0,
    };
  }

  const cells = Array.from({ length: rowBandCount * columnBandCount }, (_, index) => {
    const rowBand = Math.floor(index / columnBandCount);
    const columnBand = index % columnBandCount;
    return {
      rowBand,
      columnBand,
      rowStart: bandStart(rowBand, rowBandCount, safeRowCount),
      rowEnd: bandEnd(rowBand, rowBandCount, safeRowCount),
      columnStart: bandStart(columnBand, columnBandCount, safeColumns.length),
      columnEnd: bandEnd(columnBand, columnBandCount, safeColumns.length),
      issueCount: 0,
      firstIssue: null,
    };
  });

  const columnIndexes = new Map(safeColumns.map((column, index) => [column, index]));
  let maxIssues = 0;
  for (const issue of issues ?? []) {
    const columnIndex = columnIndexes.get(issue.column);
    const rowIndex = Number(issue.row) - 1;
    if (columnIndex == null || !Number.isFinite(rowIndex) || rowIndex < 0 || rowIndex >= safeRowCount) continue;
    const rowBand = Math.min(rowBandCount - 1, Math.floor(rowIndex * rowBandCount / safeRowCount));
    const columnBand = Math.min(columnBandCount - 1, Math.floor(columnIndex * columnBandCount / safeColumns.length));
    const cell = cells[(rowBand * columnBandCount) + columnBand];
    cell.issueCount += 1;
    cell.firstIssue ??= issue;
    maxIssues = Math.max(maxIssues, cell.issueCount);
  }

  return {
    rowCount: safeRowCount,
    columnCount: safeColumns.length,
    rowBandCount,
    columnBandCount,
    cells,
    maxIssues,
  };
}

export function getHealthCellLabel(cell, columns) {
  const rowLabel = cell.rowStart === cell.rowEnd
    ? `Row ${cell.rowStart + 1}`
    : `Rows ${cell.rowStart + 1} to ${cell.rowEnd + 1}`;
  const firstColumn = columns[cell.columnStart] ?? "Unknown";
  const lastColumn = columns[cell.columnEnd] ?? firstColumn;
  const columnLabel = firstColumn === lastColumn ? firstColumn : `${firstColumn} to ${lastColumn}`;
  const issueLabel = cell.issueCount
    ? `${cell.issueCount.toLocaleString()} ${cell.issueCount === 1 ? "issue" : "issues"}`
    : "Clean";
  return `${rowLabel}, ${columnLabel}, ${issueLabel}`;
}

function bandStart(index, bandCount, total) {
  return Math.floor(index * total / bandCount);
}

function bandEnd(index, bandCount, total) {
  return Math.max(bandStart(index, bandCount, total), Math.ceil((index + 1) * total / bandCount) - 1);
}
