import test from "node:test";
import assert from "node:assert/strict";
import {
  createBinEntries,
  createDataBinExportRows,
  getArchivedColumns,
  moveEntriesToBin,
  normalizeDataBin,
  restoreEntriesFromBin,
} from "./dataBin.js";

const rows = [
  { __rowId: "a", Name: "Ada", Legacy: "one" },
  { __rowId: "b", Name: "Bo", Legacy: "two" },
  { __rowId: "c", Name: "Cy", Legacy: "three" },
];

test("moves unique rows into the bin and restores their order", () => {
  let id = 0;
  const entries = createBinEntries(rows, ["b", "c", "b"], {
    columns: ["Name", "Legacy"],
    reason: "Failed validation",
    createId: () => `bin-${++id}`,
  });
  assert.equal(entries.length, 2);
  const moved = moveEntriesToBin(rows, [], entries);
  assert.deepEqual(moved.rows.map((row) => row.__rowId), ["a"]);
  assert.equal(moved.dataBin.length, 2);

  const restored = restoreEntriesFromBin(moved.rows, moved.dataBin, entries, ["Name", "Legacy"]);
  assert.deepEqual(restored.rows.map((row) => row.__rowId), ["a", "b", "c"]);
  assert.deepEqual(restored.dataBin, []);
});

test("restoring after a schema change keeps current columns only", () => {
  const [entry] = createBinEntries(rows, ["b"], {
    columns: ["Name", "Legacy"],
    createId: () => "bin-b",
  });
  const restored = restoreEntriesFromBin([rows[0], rows[2]], [entry], [entry], ["Name"]);
  assert.deepEqual(restored.rows[1], { __rowId: "b", Name: "Bo" });
  assert.deepEqual(getArchivedColumns(entry, ["Name"]), ["Legacy"]);
});

test("normalizes saved entries and exports bin metadata", () => {
  const normalized = normalizeDataBin([{ id: "bin-a", row: rows[0], originalIndex: "0", reason: "Manual" }]);
  assert.equal(normalized.length, 1);
  assert.equal(createDataBinExportRows(normalized)[0]["Bin Reason"], "Manual");
  assert.deepEqual(normalizeDataBin([{ nope: true }]), []);
});
