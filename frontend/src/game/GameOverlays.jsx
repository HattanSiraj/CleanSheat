import { useState } from "react";
import { ACHIEVEMENTS } from "./achievements.js";

export function SoundControls({ settings, onMute, onVolume }) {
  return (
    <div className="sound-controls">
      <button type="button" className="campaign-menu-button" onClick={onMute}>
        {settings.muted ? "Sound off" : "Sound on"}
      </button>
      <label>
        <span className="screen-reader-only">Sound volume</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          disabled={settings.muted}
        />
      </label>
    </div>
  );
}

export function ScanOverlay({ active, progress = 0, onCancel }) {
  if (!active) return null;
  return (
    <div className="scan-overlay" role="status" aria-live="polite">
      <div className="scan-line" />
      <div className="scan-overlay-status">
        <span>SCANNING DATA {Math.round(progress * 100)}%</span>
        <progress max="1" value={progress} />
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

export function AchievementToast({ achievement }) {
  if (!achievement) return null;
  return (
    <div className="achievement-toast" role="status">
      <span>ACHIEVEMENT UNLOCKED</span>
      <strong>{achievement.name}</strong>
      <small>{achievement.description}</small>
    </div>
  );
}

export function AchievementsDialog({ progress, onClose, onReset, onUnlockHell }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const earnedAchievementCount = ACHIEVEMENTS.filter((achievement) => progress.achievements[achievement.id]).length;

  async function resetProgress() {
    setResetting(true);
    await onReset?.();
  }

  return (
    <div className="challenge-browser-backdrop" onMouseDown={onClose}>
      <section className="achievements-dialog" role="dialog" aria-modal="true" aria-labelledby="achievements-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="challenge-browser-heading">
          <div>
            <span className="section-label">Player record</span>
            <h2 id="achievements-title">Achievements</h2>
            <p>{earnedAchievementCount}/{ACHIEVEMENTS.length} found</p>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>Close</button>
        </div>
        <div className="achievement-grid">
          {ACHIEVEMENTS.map((achievement) => {
            const earned = progress.achievements[achievement.id];
            const hidden = achievement.secret && !earned;
            return (
              <article className={`achievement-card ${earned ? "earned" : ""}`} key={achievement.id}>
                <span>{earned ? "OK" : "??"}</span>
                <div>
                  <strong>{hidden ? "Secret achievement" : achievement.name}</strong>
                  <p>{hidden ? "Clipbit refuses to explain this one" : achievement.description}</p>
                </div>
              </article>
            );
          })}
        </div>
        <div className={`achievement-reset ${confirmingReset ? "confirming" : ""}`}>
          {!confirmingReset ? (
            <>
              {onUnlockHell && (
                <button type="button" className="achievement-hell-test-button" onClick={onUnlockHell}>
                  Unlock HELL DISK
                </button>
              )}
              <button type="button" className="achievement-reset-button" onClick={() => setConfirmingReset(true)}>
                Reset Progress
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>Start over from zero?</strong>
                <p>This clears grades, achievements, unlocked files, and challenge saves while keeping Free Clean work</p>
              </div>
              <div className="achievement-reset-actions">
                <button type="button" className="secondary-button" onClick={() => setConfirmingReset(false)} disabled={resetting}>Cancel</button>
                <button type="button" className="achievement-reset-confirm" onClick={resetProgress} disabled={resetting}>
                  {resetting ? "Resetting..." : "Yes, Start Over"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
