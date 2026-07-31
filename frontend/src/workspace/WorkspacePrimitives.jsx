export function ToolbarChip({ label, value, tone = "default" }) {
  return (
    <div className={`toolbar-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function HintCode({ children, hint }) {
  return (
    <span className="hint-code" tabIndex="0">
      <code>{children}</code>
      <span className="hint-tooltip" role="tooltip">{hint}</span>
    </span>
  );
}

export function ToolCard({ title, description, onClick, disabled = false, locked = false, badge = "" }) {
  return (
    <button
      type="button"
      className={`cleaning-tool-card ${locked ? "locked" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={locked || disabled}
    >
      <span><strong>{title}</strong>{badge && <small>{badge}</small>}</span>
      <p>{description}</p>
    </button>
  );
}

export function ToolCheck({ checked, onChange, label }) {
  return (
    <label className="check-row tool-check">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="fake-checkbox" aria-hidden="true" />
      <span className="column-name">{label}</span>
    </label>
  );
}

export function ColumnPicker({ columns, selected, onToggle, onSelectAll, onSelectVisible, label }) {
  return (
    <fieldset className="tool-fieldset column-picker-fieldset">
      <legend>{label}</legend>
      {(onSelectAll || onSelectVisible) && (
        <div className="column-picker-actions">
          {onSelectVisible && <button type="button" className="secondary-button" onClick={onSelectVisible}>Use visible</button>}
          {onSelectAll && <button type="button" className="secondary-button" onClick={onSelectAll}>Use all</button>}
          <button type="button" className="secondary-button" onClick={() => selected.forEach(onToggle)} disabled={!selected.length}>Clear</button>
        </div>
      )}
      <div className="tool-column-list">
        {columns.map((column) => (
          <ToolCheck
            key={column}
            checked={selected.includes(column)}
            onChange={() => onToggle(column)}
            label={column}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function ToolPreview({ valid, error, summary, children }) {
  return (
    <div className={`tool-preview ${valid ? "" : "invalid"}`}>
      <span className="field-label">Preview</span>
      {valid
        ? <><strong>{summary}</strong>{children}</>
        : <strong className="error-text">{error}</strong>}
    </div>
  );
}

export function ToolActions({ onCancel, onApply, applyLabel, disabled, danger = false }) {
  return (
    <div className="rule-builder-actions cleaning-tool-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Back</button>
      <button type="button" className={danger ? "delete-issue-rows-button" : ""} onClick={onApply} disabled={disabled}>{applyLabel}</button>
    </div>
  );
}

export function ColumnHeader(props) {
  const field = props.column?.getColDef()?.field;
  const isSelected = props.selectedColumn === field;

  return (
    <button
      type="button"
      className={`grid-header-button ${isSelected ? "selected" : ""}`}
      onClick={() => props.onSelect(field)}
    >
      {props.displayName}
    </button>
  );
}
