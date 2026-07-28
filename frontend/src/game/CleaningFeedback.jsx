import React from "react";

export function EffectsControl({ mode, onChange, compact = false }) {
  const reduced = mode === "reduced";
  return (
    <button
      type="button"
      className={`effects-control ${compact ? "compact" : "campaign-menu-button"}`}
      onClick={() => onChange(reduced ? "full" : "reduced")}
      aria-pressed={reduced}
      title="Full adds particles and movement while Reduced keeps the useful highlights"
    >
      FX {reduced ? "Reduced" : "Full"}
    </button>
  );
}

export function CleaningFeedbackLayer({ event, reduced = false, placement = "table" }) {
  if (!event) return null;
  const sourceLabel = event.sourceColumns?.join(" + ");
  const targetLabel = event.targetColumns?.join(" + ");
  const particles = reduced || event.kind === "scan-error" ? 0 : Math.min(16, event.particles ?? 0);

  return (
    <div
      className={`cleaning-feedback-layer ${placement === "viewport" ? "viewport-feedback" : "table-feedback"} feedback-${event.kind} ${reduced ? "reduced" : ""}`}
      role="status"
      aria-live="polite"
      style={{ "--feedback-duration": `${event.duration}ms` }}
    >
      <div className="cleaning-feedback-banner">
        <span>{getFeedbackEyebrow(event.kind)}</span>
        <strong>{event.message}</strong>
        {event.detail && <small>{event.detail}</small>}
        {sourceLabel && targetLabel && (
          <div className="feedback-formula-route" aria-label={`${sourceLabel} calculated ${targetLabel}`}>
            <span>{sourceLabel}</span>
            <b aria-hidden="true">&gt;</b>
            <span>{targetLabel}</span>
          </div>
        )}
      </div>
      {(event.kind === "undo" || event.kind === "redo") && <div className="feedback-sweep" aria-hidden="true" />}
      {!!particles && (
        <div className="feedback-particles" aria-hidden="true">
          {Array.from({ length: particles }, (_, index) => (
            <i
              key={index}
              style={{
                "--particle-index": index,
                "--particle-x": `${8 + ((index * 29) % 84)}%`,
                "--particle-delay": `${(index % 5) * 35}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getFeedbackEyebrow(kind) {
  if (kind === "formula") return "FORMULA LINK";
  if (kind === "delete") return "ROW SHREDDER";
  if (kind === "undo") return "UNDO";
  if (kind === "redo") return "REDO";
  if (kind === "combo") return "MULTI CLEAN";
  if (kind === "objective") return "OBJECTIVE";
  if (kind === "victory") return "CHALLENGE CLEAR";
  if (kind === "scan-error") return "SCAN RESULT";
  if (kind === "scan-clean") return "SCAN RESULT";
  if (kind === "schema") return "COLUMN TOOL";
  return "CLEANING TOOL";
}
