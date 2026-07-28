import test from "node:test";
import assert from "node:assert/strict";
import {
  EFFECTS_STORAGE_KEY,
  INITIAL_FEEDBACK_STATE,
  MAX_FEEDBACK_QUEUE,
  MAX_FEEDBACK_TARGETS,
  createActionFeedback,
  createScanFeedback,
  enqueueFeedback,
  feedbackReducer,
  readEffectsMode,
  sampleActionTargets,
  shouldReduceEffects,
  writeEffectsMode,
} from "./game/feedback.js";

test("cleaning actions map to repair formula delete undo and redo feedback", () => {
  const bulk = createActionFeedback({
    label: "Fill invalid values",
    kind: "cells",
    changes: [
      { rowId: "1", column: "Phone" },
      { rowId: "2", column: "Phone" },
    ],
  }, "apply", { id: "bulk" });
  assert.equal(bulk.kind, "repair");
  assert.equal(bulk.count, 2);
  assert.equal(bulk.sound, "repair");

  const formula = createActionFeedback({
    label: "Apply relationship fixes",
    kind: "cells",
    changes: [{ rowId: "1", column: "Total" }],
    feedback: {
      kind: "formula",
      sourceColumns: ["Quantity", "Price"],
      targetColumns: ["Total"],
    },
  }, "apply", { id: "formula" });
  assert.equal(formula.kind, "formula");
  assert.deepEqual(formula.sourceColumns, ["Quantity", "Price"]);
  assert.deepEqual(formula.targetColumns, ["Total"]);

  const deleted = createActionFeedback({
    label: "Delete rows with issues",
    kind: "deleteRows",
    rows: [{ row: { __rowId: "1" } }, { row: { __rowId: "2" } }],
  }, "apply", { id: "delete" });
  assert.equal(deleted.kind, "delete");
  assert.equal(deleted.count, 2);

  assert.equal(createActionFeedback({ label: "Edit cell", kind: "cells", changes: [{}] }), null);
  assert.equal(createActionFeedback({ label: "Fill", kind: "cells", changes: [{}] }, "undo", { id: "undo" }).kind, "undo");
  assert.equal(createActionFeedback({ label: "Fill", kind: "cells", changes: [{}] }, "redo", { id: "redo" }).kind, "redo");
});

test("feedback queue keeps three waiting events and stronger events replace weaker ones", () => {
  const repair = (id, kind = "repair", priority = 1) => ({ id, kind, priority });
  let state = enqueueFeedback(INITIAL_FEEDBACK_STATE, repair("active"));
  state = enqueueFeedback(state, repair("one", "formula"));
  state = enqueueFeedback(state, repair("two", "delete"));
  state = enqueueFeedback(state, repair("three", "undo"));
  state = enqueueFeedback(state, repair("four", "redo"));
  assert.equal(state.queue.length, MAX_FEEDBACK_QUEUE);

  state = enqueueFeedback(state, repair("victory", "victory", 5));
  assert.equal(state.active.id, "victory");
  assert.equal(state.queue.length, 0);

  state = feedbackReducer(state, { type: "dismiss" });
  assert.equal(state.active, null);
});

test("rapid repeated feedback replaces the active copy instead of building a backlog", () => {
  const first = { id: "first", kind: "repair", priority: 1 };
  const latest = { id: "latest", kind: "repair", priority: 1 };
  const state = enqueueFeedback(enqueueFeedback(INITIAL_FEEDBACK_STATE, first), latest);
  assert.equal(state.active.id, "latest");
  assert.equal(state.queue.length, 0);
});

test("scan feedback reports clean passes issues objectives combos and wins", () => {
  assert.equal(createScanFeedback({ issueCount: 0 }, { id: "clean" }).kind, "scan-clean");
  assert.equal(createScanFeedback({ issueCount: 8 }, { id: "bad" }).kind, "scan-error");
  assert.equal(createScanFeedback({ issueCount: 0, challenge: true, corruption: 80 }, { id: "hidden" }).kind, "scan-clean");
  assert.equal(createScanFeedback({ issueCount: 2, objectiveIds: ["one"] }, { id: "visible-first" }).kind, "scan-error");
  assert.equal(createScanFeedback({ objectiveIds: ["one"], objectiveTitles: ["Fix dates"] }, { id: "objective" }).kind, "objective");
  assert.equal(createScanFeedback({ objectiveIds: ["one", "two"] }, { id: "combo" }).kind, "combo");
  assert.equal(createScanFeedback({ complete: true }, { id: "victory" }).kind, "victory");
});

test("effect mode persists and operating system reduced motion always wins", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  writeEffectsMode("reduced", storage);
  assert.equal(values.get(EFFECTS_STORAGE_KEY), "reduced");
  assert.equal(readEffectsMode(storage), "reduced");
  assert.equal(shouldReduceEffects("full", { matches: true }), true);
  assert.equal(shouldReduceEffects("full", { matches: false }), false);
});

test("million row actions count every change while sampling only visible effect targets", () => {
  const changes = { length: 1_000_000 };
  for (let index = 0; index < MAX_FEEDBACK_TARGETS; index += 1) {
    changes[index] = { rowId: `row-${index}`, column: "Value" };
  }
  const action = { label: "Huge fill", kind: "cells", changes };
  const feedback = createActionFeedback(action, "apply", { id: "huge" });
  assert.equal(feedback.count, 1_000_000);
  assert.equal(feedback.targets.length, MAX_FEEDBACK_TARGETS);
  assert.equal(sampleActionTargets(action, 5).length, 5);
});
