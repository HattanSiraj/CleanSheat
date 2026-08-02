import assert from "node:assert/strict";
import test from "node:test";
import { appendHistoryAction, canStoreHistoryAction, getHistorySnapshotSize, normalizeHistorySnapshot } from "./history.js";

test("history counts nested cell snapshots", () => {
  const action = {
    kind: "compound",
    actions: [
      { kind: "cells", changes: [{}, {}] },
      { kind: "deleteRows", rows: [{ row: { a: 1, b: 2, c: 3 } }] },
    ],
  };
  assert.equal(getHistorySnapshotSize(action), 5);
});

test("history keeps the newest actions within its memory budget", () => {
  const first = { id: "first", kind: "cells", changes: [{}, {}] };
  const second = { id: "second", kind: "cells", changes: [{}, {}] };
  const third = { id: "third", kind: "cells", changes: [{}] };
  const result = appendHistoryAction([first, second], third, { limit: 25, snapshotBudget: 3 });
  assert.deepEqual(result.actions.map((action) => action.id), ["second", "third"]);
});

test("an oversized action clears history instead of allowing an invalid undo chain", () => {
  const result = appendHistoryAction(
    [{ kind: "cells", changes: [{}] }],
    { kind: "cells", changes: [{}, {}, {}] },
    { snapshotBudget: 2 },
  );
  assert.deepEqual(result, { actions: [], stored: false });
  assert.equal(canStoreHistoryAction({ kind: "cells", changes: [{}, {}, {}] }, 2), false);
});

test("Data Bin moves count their archived row fields", () => {
  assert.equal(getHistorySnapshotSize({
    kind: "moveRowsToBin",
    entries: [{ row: { __rowId: "one", Name: "Ada", Email: "ada@example.com" } }],
  }), 3);
});

test("saved Undo and Redo history is restored within the memory budget", () => {
  const history = {
    past: [
      { id: "old", kind: "cells", changes: [{}, {}] },
      { id: "latest", kind: "cells", changes: [{}] },
    ],
    future: [{ id: "redo", kind: "config" }],
  };
  assert.deepEqual(normalizeHistorySnapshot(history, { limit: 2, snapshotBudget: 2 }), {
    past: [{ id: "latest", kind: "cells", changes: [{}] }],
    future: [{ id: "redo", kind: "config" }],
  });
  assert.deepEqual(normalizeHistorySnapshot(null), { past: [], future: [] });
});
