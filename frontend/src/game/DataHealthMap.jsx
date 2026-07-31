import { useMemo } from "react";
import {
  buildDataHealthMap,
  formatHealthPercentage,
  getHealthCellLabel,
} from "./dataHealth.js";

export function DataHealthMap({
  rowCount,
  columns,
  issues,
  current,
  unidentifiedColumns = [],
  onIssueSelect,
}) {
  const map = useMemo(
    () => buildDataHealthMap({ rowCount, columns, issues }),
    [columns, issues, rowCount],
  );
  const unidentifiedSet = useMemo(
    () => new Set(unidentifiedColumns),
    [unidentifiedColumns],
  );
  if (!map.cells.length) return null;

  const issueCount = issues.length;
  const viewWidth = map.columnBandCount * 10;
  const viewHeight = map.rowBandCount * 6;

  return (
    <section className={`data-health-map ${current ? "" : "stale"}`}>
      <div className="data-health-heading">
        <div>
          <span className="section-label">Data health map</span>
          <small>Rows run downward and columns run across</small>
        </div>
        <div className="data-health-reading">
          <strong>{current ? issueCount.toLocaleString() : "??"}</strong>
          <span>{current ? (issueCount === 1 ? "issue" : "issues") : "scan needed"}</span>
        </div>
      </div>

      <div className="data-health-screen">
        <span className="data-health-axis top">TOP</span>
        <svg
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={current ? `Data health map with ${issueCount} issues` : "Data health map needs another scan"}
        >
          {map.cells.map((cell) => {
            const bandColumns = columns.slice(cell.columnStart, cell.columnEnd + 1);
            const unidentified = bandColumns.every((column) => unidentifiedSet.has(column));
            const label = unidentified
              ? `${bandColumns.join(" to ")}, choose a column type before scanning`
              : getHealthCellLabel(cell, columns);
            const x = (cell.columnBand * 10) + 0.7;
            const y = (cell.rowBand * 6) + 0.7;
            const width = 8.6;
            return (
              <g key={`${cell.rowBand}:${cell.columnBand}`}>
                <rect
                  className={`data-health-cell ${cell.firstIssue ? "has-issues" : ""} ${unidentified ? "unidentified" : ""}`}
                  x={x}
                  y={y}
                  width={width}
                  height="4.6"
                  rx="0.35"
                  tabIndex={current && cell.firstIssue ? 0 : undefined}
                  role={current && cell.firstIssue ? "button" : undefined}
                  aria-label={label}
                  onClick={() => current && cell.firstIssue && onIssueSelect?.(cell.firstIssue)}
                  onKeyDown={(event) => {
                    if (!current || !cell.firstIssue || !["Enter", " "].includes(event.key)) return;
                    event.preventDefault();
                    onIssueSelect?.(cell.firstIssue);
                  }}
                >
                  <title>{label}</title>
                </rect>
                {!!cell.issueCount && (
                  <rect
                    className="data-health-issue-fill"
                    x={x}
                    y={y}
                    width={width * cell.issuePercentage / 100}
                    height="4.6"
                    rx="0.35"
                    aria-hidden="true"
                  />
                )}
              </g>
            );
          })}
        </svg>
        <span className="data-health-axis bottom">BOTTOM</span>
      </div>

      <div className="data-health-columns" aria-label="Column health percentages">
        {map.columns.map((column) => {
          const unidentified = unidentifiedSet.has(column.column);
          const healthLabel = unidentified
            ? "No type"
            : current
            ? formatHealthPercentage(column.healthPercentage)
            : "??";
          const issueLabel = unidentified
            ? "Not scanned"
            : current
            ? `${column.issueCount.toLocaleString()} ${column.issueCount === 1 ? "issue" : "issues"}`
            : "Scan needed";
          const label = unidentified
            ? `${column.column}, choose a column type before scanning`
            : current
            ? `${column.column}, ${healthLabel} healthy, ${issueLabel}`
            : `${column.column}, scan needed`;
          return (
            <button
              type="button"
              className={`${column.issueCount ? "has-issues" : "clean"} ${unidentified ? "unidentified" : ""}`}
              key={column.column}
              title={label}
              onClick={() => current && column.firstIssue && onIssueSelect?.(column.firstIssue)}
              disabled={unidentified || !current || !column.firstIssue}
            >
              <span><strong>{column.column}</strong><b>{healthLabel}</b></span>
              <span className="column-health-track" aria-hidden="true">
                <i style={{ width: current && !unidentified ? `${column.healthPercentage}%` : "0%" }} />
              </span>
              <small>{issueLabel}</small>
            </button>
          );
        })}
      </div>

      <div className="data-health-footer">
        <span><i className="clean" />Healthy share</span>
        <span><i className="danger" />Issue share</span>
        {!!unidentifiedSet.size && <span><i className="unidentified" />Not scanned</span>}
        <small>{current && issueCount ? "Red shows how much of each block is affected" : current ? "Nothing red survived the scan" : "The map is waiting for fresh scan results"}</small>
      </div>
    </section>
  );
}
