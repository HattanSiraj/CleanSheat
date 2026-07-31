export const GRADE_ORDER = ["", "C", "B", "A", "S"];

export function calculateChallengeScore(challenge, evaluation, runStats = {}) {
  const objectives = evaluation?.objectives ?? [];
  const rules = evaluation?.rules ?? [];
  const completedObjectives = objectives.filter((objective) => objective.complete).length;
  const completedRules = rules.filter((rule) => rule.complete).length;
  const objectiveRatio = objectives.length ? completedObjectives / objectives.length : 0;
  const integrityRatio = rules.length ? completedRules / rules.length : 1;
  const moves = Math.max(0, Number(runStats.moves) || 0);
  const hintsUsed = Math.max(0, Number(runStats.hintsUsed) || 0);
  const maxCombo = Math.max(0, Number(runStats.maxCombo) || 0);

  const breakdown = {
    objectives: Math.round(objectiveRatio * 60),
    integrity: Math.round(integrityRatio * 25),
    hints: hintsUsed ? 5 : 10,
    combo: maxCombo >= 3 ? 5 : maxCombo === 2 ? 3 : 0,
  };
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const complete = Boolean(evaluation?.complete);
  const checks = objectives.length + rules.length;
  const passedChecks = completedObjectives + completedRules;
  const corruption = checks ? Math.max(0, 100 - Math.round(passedChecks * 100 / checks)) : 100;

  return {
    total,
    grade: complete ? getGrade(total) : "",
    complete,
    corruption,
    breakdown,
    moves,
    hintsUsed,
    maxCombo,
  };
}

function getGrade(score) {
  if (score >= 98) return "S";
  if (score >= 88) return "A";
  if (score >= 75) return "B";
  return "C";
}

export function isBetterResult(next, previous) {
  if (!previous) return true;
  const nextRank = GRADE_ORDER.indexOf(next.grade);
  const previousRank = GRADE_ORDER.indexOf(previous.grade);
  if (nextRank !== previousRank) return nextRank > previousRank;
  if (next.total !== previous.score) return next.total > previous.score;
  return next.moves < (previous.bestMoves ?? Number.POSITIVE_INFINITY);
}

export function isScoreableAction(action) {
  return Boolean(action) && action.kind !== "columnOrder";
}

export function getActionChangeSize(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((sum, item) => sum + getActionChangeSize(item), 0);
  }
  if (action.kind === "cells") return action.changes?.length ?? 0;
  if (action.kind === "deleteRows") return action.rows?.length ?? 0;
  if (action.kind === "schema") return action.rowCount ?? 0;
  return 0;
}

export function getDeletedRowCount(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((sum, item) => sum + getDeletedRowCount(item), 0);
  }
  return action.kind === "deleteRows" ? action.rows?.length ?? 0 : 0;
}

export function createRunStats() {
  return {
    moves: 0,
    hintsUsed: 0,
    maxCombo: 0,
    scans: 0,
    undoCount: 0,
    deletedRows: 0,
    largestChange: 0,
    clipbitClicks: 0,
    completedObjectiveIds: [],
    startedAt: new Date().toISOString(),
  };
}

export function normalizeRunStats(value) {
  return {
    ...createRunStats(),
    ...(value ?? {}),
    completedObjectiveIds: Array.isArray(value?.completedObjectiveIds) ? value.completedObjectiveIds : [],
  };
}
