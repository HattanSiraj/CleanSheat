import React, { useMemo } from "react";
import { buildDataHealthMap, getHealthCellLabel } from "./dataHealth.js";

export function DataHealthMap({
  rowCount,
  columns,
  issues,
  current,
  onIssueSelect,
}) {
  const map = useMemo(
    () => buildDataHealthMap({ rowCount, columns, issues }),
    [columns, issues, rowCount],
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
            const intensity = map.maxIssues ? cell.issueCount / map.maxIssues : 0;
            const tone = !cell.issueCount ? "clean" : intensity > 0.45 ? "danger" : "warning";
            const label = getHealthCellLabel(cell, columns);
            return (
              <rect
                className={`data-health-cell ${tone}`}
                key={`${cell.rowBand}:${cell.columnBand}`}
                x={(cell.columnBand * 10) + 0.7}
                y={(cell.rowBand * 6) + 0.7}
                width="8.6"
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
            );
          })}
        </svg>
        <span className="data-health-axis bottom">BOTTOM</span>
      </div>

      <div className="data-health-footer">
        <span><i className="clean" />Clean</span>
        <span><i className="warning" />Some trouble</span>
        <span><i className="danger" />Trouble pileup</span>
        <small>{current && issueCount ? "Click a red block to jump into the mess" : current ? "Nothing red survived the scan" : "The map is waiting for fresh scan results"}</small>
      </div>
    </section>
  );
}
