import assert from "node:assert/strict";
import test from "node:test";
import { getCleanSheetStorageKeys } from "./workspaceStorage.js";

test("storage cleanup only selects CleanSheet keys", () => {
  const values = new Map([
    ["cleansheet.game-progress", "{}"],
    ["cleansheet.saved-regex-rules", "[]"],
    ["another-app.settings", "{}"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
  };

  assert.deepEqual(getCleanSheetStorageKeys(storage), [
    "cleansheet.game-progress",
    "cleansheet.saved-regex-rules",
  ]);
});
