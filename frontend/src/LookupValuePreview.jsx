export function LookupValuePreview({
  anchorColumn,
  targetColumn,
  preview,
  direction,
}) {
  const directions = getSelectedDirections(anchorColumn, targetColumn, preview, direction);
  if (!directions.length) {
    return (
      <section className="lookup-value-preview">
        <strong>Preview the result</strong>
        <p>Choose a direction above to see the values it would learn and change</p>
      </section>
    );
  }

  const changes = directions.flatMap((item) => item.result.repairPreview.map((repair) => ({
    ...repair,
    direction: item.key,
  })));
  const mappings = directions.flatMap((item) => item.result.mappingPreview.map((mapping, index) => ({
    ...mapping,
    direction: item.key,
    sourceColumn: item.sourceColumn,
    targetColumn: item.targetColumn,
    key: `${item.key}:${index}`,
  })));
  const totalChanges = directions.reduce((total, item) => total + item.result.counts.safe, 0);
  const totalMappings = directions.reduce((total, item) => total + item.result.mappingCount, 0);

  return (
    <section className="lookup-value-preview" aria-label="Logical relation value preview">
      <div className="lookup-value-preview-heading">
        <strong>Preview the result</strong>
        <span>Nothing changes until you apply the fixes</span>
      </div>
      <div className="lookup-value-preview-grid">
        <article>
          <header>
            <strong>What will change</strong>
            <span>{totalChanges.toLocaleString()} cell{totalChanges === 1 ? "" : "s"}</span>
          </header>
          {changes.length ? (
            <div className="lookup-preview-list">
              {changes.map((change) => (
                <div className="lookup-change-row" key={`${change.direction}:${change.id}`}>
                  <span>Matched from {change.sourceColumn} = {formatLookupValue(change.sourceValue)}</span>
                  <div>
                    <code>{formatLookupValue(change.currentValue)}</code>
                    <b>→</b>
                    <code>{formatLookupValue(change.suggestedValue)}</code>
                  </div>
                  <small>Row {change.row.toLocaleString()} · {change.targetColumn}</small>
                </div>
              ))}
            </div>
          ) : <p>No fixable cells were found for this direction</p>}
          {totalChanges > changes.length && <small>Showing the first {changes.length.toLocaleString()} changes</small>}
        </article>

        <article>
          <header>
            <strong>Values it learned</strong>
            <span>{totalMappings.toLocaleString()} trusted pair{totalMappings === 1 ? "" : "s"}</span>
          </header>
          {mappings.length ? (
            <div className="lookup-preview-list">
              {mappings.map((mapping) => (
                <div className="lookup-mapping-row" key={mapping.key}>
                  <span>{mapping.sourceColumn}</span>
                  <code>{formatLookupValue(mapping.sourceValue)}</code>
                  <b>→</b>
                  <span>{mapping.targetColumn}</span>
                  <code>{formatLookupValue(mapping.targetValue)}</code>
                  <small>{mapping.evidenceCount.toLocaleString()} supporting row{mapping.evidenceCount === 1 ? "" : "s"}</small>
                </div>
              ))}
            </div>
          ) : <p>No trusted pairs were found for this direction</p>}
          {totalMappings > mappings.length && <small>Showing the first {mappings.length.toLocaleString()} pairs</small>}
        </article>
      </div>
    </section>
  );
}

function getSelectedDirections(anchorColumn, targetColumn, preview, direction) {
  const directions = [];
  if (["forward", "both"].includes(direction)) {
    directions.push({
      key: "forward",
      sourceColumn: anchorColumn,
      targetColumn,
      result: preview.forward,
    });
  }
  if (["reverse", "both"].includes(direction)) {
    directions.push({
      key: "reverse",
      sourceColumn: targetColumn,
      targetColumn: anchorColumn,
      result: preview.reverse,
    });
  }
  return directions;
}

function formatLookupValue(value) {
  if (value === null) return "(null)";
  if (value === undefined || String(value).trim() === "") return "(empty)";
  return String(value);
}
