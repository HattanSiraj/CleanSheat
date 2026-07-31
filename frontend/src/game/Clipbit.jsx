import { useEffect, useRef, useState } from "react";

const RAGE_CLICK_COUNT = 7;
const RAGE_CLICK_WINDOW = 2500;
const BREAK_DURATION = 1400;

export function Clipbit({
  message,
  mood = "idle",
  minimized = false,
  campaign = false,
  hell = false,
  reducedEffects = false,
  onToggle,
  onMinimize,
  onPester,
  onRage,
  breakSignal = 0,
}) {
  const [glitching, setGlitching] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [angry, setAngry] = useState(false);
  const recentClicksRef = useRef([]);
  const breakTimeoutRef = useRef(null);
  const breakSignalRef = useRef(breakSignal);
  const visibleMood = angry ? "angry" : mood;
  const isTip = message?.startsWith("TIP //");
  const isNonsense = message?.startsWith("NONSENSE //");
  const visibleMessage = isTip
    ? message.slice(6).trim()
    : isNonsense
      ? message.slice(12).trim()
      : message;
  const mouthPath = {
    happy: "M55 72q12 12 24 0",
    worried: "M55 80q12-12 24 0",
    terrified: "M58 73h18v10H58z",
    angry: "M53 75h30v9H53zM60 75v9M68 75v9M76 75v9",
  }[visibleMood] ?? "M55 75h24";

  useEffect(() => {
    if (reducedEffects || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let glitchTimeout;
    const glitchInterval = window.setInterval(() => {
      setGlitching(true);
      glitchTimeout = window.setTimeout(() => setGlitching(false), 260);
    }, 8000);
    return () => {
      window.clearInterval(glitchInterval);
      if (glitchTimeout) window.clearTimeout(glitchTimeout);
    };
  }, [reducedEffects]);

  useEffect(() => () => {
    if (breakTimeoutRef.current) window.clearTimeout(breakTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (breakSignal === breakSignalRef.current) return;
    breakSignalRef.current = breakSignal;
    startBreaking(false);
  }, [breakSignal]);

  function startBreaking(notifyParent = true) {
    if (breaking) return;
    recentClicksRef.current = [];
    setGlitching(false);
    setAngry(true);
    setBreaking(true);
    if (notifyParent) onRage?.();
    const breakDuration = reducedEffects || window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 50
      : BREAK_DURATION;
    breakTimeoutRef.current = window.setTimeout(() => {
      breakTimeoutRef.current = null;
      setBreaking(false);
      onMinimize?.();
    }, breakDuration);
  }

  function handleCharacterClick() {
    if (breaking) return;
    if (minimized) {
      recentClicksRef.current = [];
      setAngry(false);
      onPester?.();
      onToggle?.();
      return;
    }

    const now = Date.now();
    const recentClicks = recentClicksRef.current.filter((clickedAt) => now - clickedAt <= RAGE_CLICK_WINDOW);
    recentClicks.push(now);
    recentClicksRef.current = recentClicks;
    if (recentClicks.length >= RAGE_CLICK_COUNT) {
      startBreaking();
      return;
    }
    onPester?.();
  }

  return (
    <aside className={`clipbit ${minimized ? "minimized" : ""} ${campaign ? "campaign-mode" : ""} ${hell ? "hell-mode" : ""} ${glitching ? "glitching" : ""} ${breaking ? "breaking" : ""}`} aria-live="polite">
      {!minimized && message && (
        <div className="clipbit-bubble">
          <button type="button" className="clipbit-minimize" onClick={onToggle} aria-label="Minimize Clipbit">x</button>
          {(isTip || isNonsense) && (
            <span className={`clipbit-tip-label ${isNonsense ? "nonsense" : ""}`}>
              {isNonsense ? "NONSENSE" : "TIP / TRICK"}
            </span>
          )}
          <p>{visibleMessage}</p>
        </div>
      )}
      <button
        type="button"
        className={`clipbit-character ${visibleMood}`}
        data-game-sound="custom"
        onClick={handleCharacterClick}
        aria-label={minimized ? "Open Clipbit" : "Bother Clipbit"}
      >
        <svg viewBox="0 0 120 150" role="img" aria-label={`Clipbit looks ${visibleMood}`}>
          <path className="clipbit-shadow" d="M27 135h72v9H27z" />
          <path className="clipbit-wire outer" d="M76 20c25 0 34 20 34 41v46c0 25-17 38-39 38s-39-13-39-38V48c0-18 12-30 28-30s28 12 28 30v55c0 12-7 20-17 20s-17-8-17-20V55" />
          <path className="clipbit-wire inner" d="M61 55v47c0 7 4 12 10 12s10-5 10-12V48c0-13-8-21-21-21s-21 8-21 21v59c0 20 12 29 32 29s32-9 32-29V61c0-17-8-32-27-32" />
          <g className="clipbit-face">
            <rect x="40" y="48" width="54" height="35" />
            <rect className="clipbit-eye left" x="51" y="58" width="8" height="10" />
            <rect className="clipbit-eye right" x="75" y="58" width="8" height="10" />
            <path className="clipbit-brow left" d="M48 54l14 6" />
            <path className="clipbit-brow right" d="M72 60l14-6" />
            <path className="clipbit-mouth" d={mouthPath} />
          </g>
          <path className="clipbit-foot left" d="M34 132h26v9H28v-5z" />
          <path className="clipbit-foot right" d="M78 132h26l6 4v5H78z" />
        </svg>
        {minimized && <span>{angry ? ">:[" : "CLIPBIT"}</span>}
      </button>
    </aside>
  );
}
