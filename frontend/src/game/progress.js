import { GRADE_ORDER, isBetterResult } from "./scoring.js";

export const GAME_PROGRESS_KEY = "cleansheet.game-progress";
export const BOOT_CHALLENGE_IDS = [
  "boot-scan-training",
  "boot-category-training",
  "boot-issue-training",
  "boot-recovery-training",
  "boot-sequence",
];
const GAME_PROGRESS_VERSION = 1;
const ACHIEVEMENT_RULES_VERSION = 2;
const BOOT_SEQUENCE_VERSION = 3;

export function createGameProgress() {
  return {
    version: GAME_PROGRESS_VERSION,
    achievementRulesVersion: ACHIEVEMENT_RULES_VERSION,
    bootSequenceVersion: BOOT_SEQUENCE_VERSION,
    records: {},
    achievements: {},
  };
}

export function readGameProgress(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(GAME_PROGRESS_KEY) ?? "null");
    if (parsed?.version !== GAME_PROGRESS_VERSION) return createGameProgress();
    const achievements = parsed.achievements && typeof parsed.achievements === "object"
      ? { ...parsed.achievements }
      : {};
    if (parsed.achievementRulesVersion !== ACHIEVEMENT_RULES_VERSION) {
      delete achievements["under-par"];
      delete achievements["regex-wizard"];
    }
    const records = parsed.records && typeof parsed.records === "object" ? { ...parsed.records } : {};
    if (parsed.bootSequenceVersion !== BOOT_SEQUENCE_VERSION && records["boot-sequence"]?.complete) {
      for (const challengeId of BOOT_CHALLENGE_IDS.slice(0, -1)) {
        records[challengeId] = createMigratedBootRecord(records["boot-sequence"]);
      }
    }
    return {
      version: GAME_PROGRESS_VERSION,
      achievementRulesVersion: ACHIEVEMENT_RULES_VERSION,
      bootSequenceVersion: BOOT_SEQUENCE_VERSION,
      records,
      achievements,
    };
  } catch {
    return createGameProgress();
  }
}

export function writeGameProgress(progress, storage = window.localStorage) {
  storage.setItem(GAME_PROGRESS_KEY, JSON.stringify(progress));
}

export function recordChallengeResult(progress, challenge, score) {
  if (!challenge || !score?.complete) return progress;
  const previous = progress.records[challenge.id];
  const result = {
    revision: challenge.revision,
    complete: true,
    grade: score.grade,
    score: score.total,
    bestMoves: score.moves,
    bestCombo: score.maxCombo,
    fewestHints: score.hintsUsed,
    completions: (previous?.completions ?? 0) + 1,
    completedAt: new Date().toISOString(),
  };
  if (previous && !isBetterResult(score, previous)) {
    result.grade = previous.grade;
    result.score = previous.score;
    result.bestMoves = Math.min(previous.bestMoves ?? score.moves, score.moves);
    result.bestCombo = Math.max(previous.bestCombo ?? 0, score.maxCombo);
    result.fewestHints = Math.min(previous.fewestHints ?? score.hintsUsed, score.hintsUsed);
  }
  return {
    ...progress,
    records: {
      ...progress.records,
      [challenge.id]: result,
    },
  };
}

export function isBootComplete(progress) {
  return BOOT_CHALLENGE_IDS.every((challengeId) => progress.records?.[challengeId]?.complete);
}

export function getBestGrade(progress) {
  return Object.values(progress.records).reduce((best, record) => (
    GRADE_ORDER.indexOf(record.grade ?? "") > GRADE_ORDER.indexOf(best) ? record.grade : best
  ), "");
}

function createMigratedBootRecord(source) {
  return {
    revision: 1,
    complete: true,
    grade: source.grade ?? "C",
    score: source.score ?? 0,
    bestMoves: source.bestMoves ?? 0,
    bestCombo: source.bestCombo ?? 0,
    fewestHints: source.fewestHints ?? 0,
    completions: 1,
    completedAt: source.completedAt ?? new Date().toISOString(),
  };
}
