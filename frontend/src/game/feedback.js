export const EFFECTS_STORAGE_KEY = "cleansheet.game-effects";
export const MAX_FEEDBACK_QUEUE = 3;
export const MAX_FEEDBACK_TARGETS = 80;

export const INITIAL_FEEDBACK_STATE = {
  active: null,
  queue: [],
};

let feedbackSequence = 0;

export function readEffectsMode(storage = globalThis.window?.localStorage) {
  try {
    return storage?.getItem(EFFECTS_STORAGE_KEY) === "reduced" ? "reduced" : "full";
  } catch {
    return "full";
  }
}

export function writeEffectsMode(mode, storage = globalThis.window?.localStorage) {
  try {
    storage?.setItem(EFFECTS_STORAGE_KEY, mode === "reduced" ? "reduced" : "full");
  } catch {
    // The setting can stay in memory when browser storage is unavailable.
  }
}

export function shouldReduceEffects(mode, mediaQuery = globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")) {
  return mode === "reduced" || Boolean(mediaQuery?.matches);
}

export function feedbackReducer(state, action) {
  if (action.type === "enqueue") return enqueueFeedback(state, action.event);
  if (action.type === "dismiss") {
    const [active = null, ...queue] = state.queue;
    return { active, queue };
  }
  if (action.type === "clear") return INITIAL_FEEDBACK_STATE;
  return state;
}

export function enqueueFeedback(state, event) {
  if (!event) return state;
  if (!state.active) return { active: event, queue: state.queue };

  if (event.priority > state.active.priority) {
    return {
      active: event,
      queue: state.queue.filter((queued) => queued.priority >= event.priority).slice(0, MAX_FEEDBACK_QUEUE),
    };
  }

  if (event.kind === state.active.kind) {
    return { ...state, active: event };
  }

  return {
    ...state,
    queue: [...state.queue, event].slice(0, MAX_FEEDBACK_QUEUE),
  };
}

export function createActionFeedback(action, direction = "apply", options = {}) {
  if (!action || action.label === "Edit cell") return null;
  const count = countActionChanges(action);
  const targets = sampleActionTargets(action, options.targetLimit ?? MAX_FEEDBACK_TARGETS);

  if (direction === "undo" || direction === "redo") {
    return makeFeedbackEvent({
      kind: direction,
      message: direction === "undo" ? "CHANGE REVERSED" : "CHANGE RESTORED",
      detail: action.label ?? `${count.toLocaleString()} values`,
      count,
      targets,
      sound: direction,
      duration: 900,
      priority: 2,
    }, options);
  }

  if (action.feedback?.kind === "formula" || action.recipeStep?.type === "relationshipFix") {
    return makeFeedbackEvent({
      kind: "formula",
      message: `${count.toLocaleString()} FORMULA ${count === 1 ? "FIX" : "FIXES"}`,
      detail: "Calculated values applied",
      count,
      targets,
      sourceColumns: action.feedback?.sourceColumns ?? [],
      targetColumns: action.feedback?.targetColumns ?? uniqueColumns(targets),
      sound: "formula",
      duration: 1150,
      priority: 2,
      particles: 10,
    }, options);
  }

  const deletedRows = countDeletedRows(action);
  if (deletedRows) {
    return makeFeedbackEvent({
      kind: "delete",
      message: `${deletedRows.toLocaleString()} ${deletedRows === 1 ? "ROW" : "ROWS"} DISCARDED`,
      detail: action.label ?? "Invalid rows removed",
      count: deletedRows,
      targets: [],
      sound: "deleteData",
      duration: 1050,
      priority: 2,
      particles: 12,
    }, options);
  }

  if (action.kind === "schema") {
    return makeFeedbackEvent({
      kind: "schema",
      message: "TABLE SHAPE UPDATED",
      detail: action.label ?? "Columns changed",
      count,
      targets,
      sound: "repair",
      duration: 950,
      priority: 1,
      particles: 8,
    }, options);
  }

  if (!count) return null;
  return makeFeedbackEvent({
    kind: "repair",
    message: `${count.toLocaleString()} ${count === 1 ? "VALUE" : "VALUES"} UPDATED`,
    detail: action.label ?? "Cleaning change applied",
    count,
    targets,
    sound: "repair",
    duration: 950,
    priority: 1,
    particles: 10,
  }, options);
}

export function createScanFeedback({
  issueCount = 0,
  objectiveIds = [],
  objectiveTitles = [],
  complete = false,
  challenge = false,
} = {}, options = {}) {
  if (complete) {
    return makeFeedbackEvent({
      kind: "victory",
      message: "DATASET RESTORED",
      detail: "Every objective is clean",
      objectiveIds,
      sound: "",
      duration: 1400,
      priority: 5,
      particles: 16,
    }, options);
  }

  if (issueCount > 0) {
    return makeFeedbackEvent({
      kind: "scan-error",
      message: "SCAN FOUND TROUBLE",
      detail: `${issueCount.toLocaleString()} visible ${issueCount === 1 ? "issue remains" : "issues remain"}`,
      sound: "error",
      duration: 850,
      priority: 2,
      particles: 8,
    }, options);
  }

  if (objectiveIds.length >= 2) {
    return makeFeedbackEvent({
      kind: "combo",
      message: `CLEAN COMBO x${objectiveIds.length}`,
      detail: objectiveTitles.slice(0, 3).join(" + "),
      objectiveIds,
      sound: "",
      duration: 1250,
      priority: 4,
      particles: 16,
    }, options);
  }

  if (objectiveIds.length === 1) {
    return makeFeedbackEvent({
      kind: "objective",
      message: "OBJECTIVE CLEAN",
      detail: objectiveTitles[0] ?? "One more problem solved",
      objectiveIds,
      sound: "",
      duration: 1150,
      priority: 3,
      particles: 12,
    }, options);
  }

  return makeFeedbackEvent({
    kind: "scan-clean",
    message: "CLEAN PASS",
    detail: "No visible issues found",
    sound: challenge ? "" : "scanClean",
    duration: 950,
    priority: 2,
    particles: 10,
  }, options);
}

export function sampleActionTargets(action, limit = MAX_FEEDBACK_TARGETS) {
  const targets = [];
  collectActionTargets(action, targets, Math.max(0, limit));
  return targets;
}

export function countActionChanges(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((total, child) => total + countActionChanges(child), 0);
  }
  if (action.kind === "cells") return action.changes?.length ?? 0;
  if (action.kind === "deleteRows") return action.rows?.length ?? 0;
  if (action.kind === "schema") return 1;
  return 0;
}

function countDeletedRows(action) {
  if (!action) return 0;
  if (action.kind === "compound") {
    return (action.actions ?? []).reduce((total, child) => total + countDeletedRows(child), 0);
  }
  return action.kind === "deleteRows" ? action.rows?.length ?? 0 : 0;
}

function collectActionTargets(action, targets, limit) {
  if (!action || targets.length >= limit) return;
  if (action.kind === "compound") {
    for (const child of action.actions ?? []) {
      collectActionTargets(child, targets, limit);
      if (targets.length >= limit) return;
    }
    return;
  }
  if (action.kind !== "cells") return;
  for (let index = 0; index < (action.changes?.length ?? 0) && targets.length < limit; index += 1) {
    const change = action.changes[index];
    targets.push({ rowId: change.rowId, column: change.column });
  }
}

function uniqueColumns(targets) {
  return [...new Set(targets.map((target) => target.column).filter(Boolean))];
}

function makeFeedbackEvent(event, options) {
  feedbackSequence += 1;
  return {
    id: options.id ?? `feedback-${Date.now()}-${feedbackSequence}`,
    particles: 0,
    targets: [],
    objectiveIds: [],
    sourceColumns: [],
    targetColumns: [],
    ...event,
  };
}
