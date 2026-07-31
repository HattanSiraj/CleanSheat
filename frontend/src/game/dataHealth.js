const MAX_HEALTH_ROW_BANDS = 20;
const MAX_HEALTH_COLUMN_BANDS = 40;

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
      columns: [],
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
      healthPercentage: 100,
      issuePercentage: 0,
      firstIssue: null,
    };
  });

  const columnIndexes = new Map(safeColumns.map((column, index) => [column, index]));
  const columnHealth = safeColumns.map((column, index) => ({
    column,
    columnIndex: index,
    issueCount: 0,
    healthPercentage: 100,
    firstIssue: null,
  }));
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
    columnHealth[columnIndex].issueCount += 1;
    columnHealth[columnIndex].firstIssue ??= issue;
    maxIssues = Math.max(maxIssues, cell.issueCount);
  }

  for (const cell of cells) {
    const rowCapacity = cell.rowEnd - cell.rowStart + 1;
    const columnCapacity = cell.columnEnd - cell.columnStart + 1;
    const capacity = Math.max(1, rowCapacity * columnCapacity);
    cell.issuePercentage = Math.min(100, cell.issueCount / capacity * 100);
    cell.healthPercentage = Math.max(0, 100 - cell.issuePercentage);
  }
  for (const column of columnHealth) {
    const issuePercentage = safeRowCount
      ? Math.min(100, column.issueCount / safeRowCount * 100)
      : 0;
    column.healthPercentage = Math.max(0, 100 - issuePercentage);
  }

  return {
    rowCount: safeRowCount,
    columnCount: safeColumns.length,
    rowBandCount,
    columnBandCount,
    cells,
    columns: columnHealth,
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
  return `${rowLabel}, ${columnLabel}, ${formatHealthPercentage(cell.healthPercentage)} healthy, ${issueLabel}`;
}

export function formatHealthPercentage(value) {
  const percentage = Math.min(100, Math.max(0, Number(value) || 0));
  if (percentage === 100 || percentage === 0) return `${percentage}%`;
  if (percentage >= 99.99) {
    const precise = percentage.toFixed(4);
    return precise === "100.0000"
      ? ">99.9999%"
      : `${precise.replace(/0+$/, "").replace(/\.$/, "")}%`;
  }
  if (percentage >= 99) return `${percentage.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
  if (percentage >= 90) return `${percentage.toFixed(1).replace(/\.0$/, "")}%`;
  return `${Math.round(percentage)}%`;
}

function bandStart(index, bandCount, total) {
  return Math.floor(index * total / bandCount);
}

function bandEnd(index, bandCount, total) {
  return Math.max(bandStart(index, bandCount, total), Math.ceil((index + 1) * total / bandCount) - 1);
}
