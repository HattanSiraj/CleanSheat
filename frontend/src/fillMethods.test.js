import test from "node:test";
import assert from "node:assert/strict";
import { calculateColumnFill, calculateMultiColumnCustomFill } from "./fillMethods.js";

const validNumber = (value) => /^-?\d+(?:\.\d+)?$/.test(String(value));
const validText = (value) => ["A", "B"].includes(value);

test("targets empty and invalid cells independently", () => {
  const rows = [{ value: "" }, { value: "bad" }, { value: "4" }];
  const empty = calculateColumnFill(rows, { column: "value", type: "Number", method: "custom", scope: "empty", customValue: "1", isValid: validNumber }, true);
  const invalid = calculateColumnFill(rows, { column: "value", type: "Number", method: "custom", scope: "invalid", customValue: "2", isValid: validNumber }, true);
  assert.deepEqual(empty.changes.map((change) => change.after), ["1"]);
  assert.deepEqual(invalid.changes.map((change) => change.after), ["2"]);
});

test("uses deterministic mode and ignores invalid sources", () => {
  const rows = [{ value: "B" }, { value: "A" }, { value: "A" }, { value: "wrong" }, { value: "" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Category", method: "mode", scope: "both", isValid: validText }, true);
  assert.equal(result.changeCount, 2);
  assert.ok(result.changes.every((change) => change.after === "A"));
});

test("most common ties use the first value in original row order", () => {
  const rows = [{ value: "B" }, { value: "A" }, { value: "" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Category", method: "mode", scope: "both", isValid: validText }, true);
  assert.equal(result.changes[0].after, "B");
});

test("custom replacement can remain invalid", () => {
  const rows = [{ value: "bad" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Number", method: "custom", scope: "invalid", customValue: "NaN", isValid: validNumber }, true);
  assert.equal(result.valid, true);
  assert.equal(result.changes[0].after, "NaN");
});

test("formats numeric statistics for number and integer columns", () => {
  const rows = [{ value: "1" }, { value: "2" }, { value: "9" }, { value: "" }];
  const average = calculateColumnFill(rows, { column: "value", type: "Number", method: "average", scope: "both", isValid: validNumber }, true);
  const median = calculateColumnFill(rows, { column: "value", type: "Integer", method: "median", scope: "both", isValid: validNumber }, true);
  assert.equal(average.changes[0].after, "4.00");
  assert.equal(median.changes[0].after, "2");
});

test("previous and next use an explicit order and skip invalid sources", () => {
  const rows = [{ order: 1, value: "A" }, { order: 2, value: "" }, { order: 3, value: "wrong" }, { order: 4, value: "B" }];
  const previous = calculateColumnFill(rows, { column: "value", type: "Category", method: "previous", scope: "both", orderBy: "order", isValid: validText }, true);
  const next = calculateColumnFill(rows, { column: "value", type: "Category", method: "next", scope: "both", orderBy: "order", isValid: validText }, true);
  assert.deepEqual(previous.changes.map((change) => change.after), ["A", "A"]);
  assert.deepEqual(next.changes.map((change) => change.after), ["B", "B"]);
});

test("statistics can be calculated within groups", () => {
  const rows = [{ group: "A", value: "2" }, { group: "A", value: "" }, { group: "B", value: "10" }, { group: "B", value: "20" }, { group: "B", value: "" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Number", method: "average", scope: "empty", groupBy: "group", isValid: validNumber }, true);
  assert.deepEqual(result.changes.map((change) => change.after), ["2.00", "15.00"]);
});

test("custom missing detectors target null markers as empty", () => {
  const rows = [{ value: "NULL" }, { value: "4" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Number", method: "custom", scope: "empty", customValue: "1", isValid: validNumber, isMissing: (value) => value === "NULL" }, true);
  assert.equal(result.changes[0].after, "1");
});

test("allowed missing values are neither targets nor fill sources", () => {
  const rows = [
    { __rowId: "1", order: "1", value: "10" },
    { __rowId: "2", order: "2", value: "" },
    { __rowId: "3", order: "3", value: "bad" },
  ];
  const plan = calculateColumnFill(rows, {
    column: "value",
    method: "previous",
    scope: "both",
    type: "Number",
    orderBy: "order",
    isValid: (value) => /^\d+$/.test(value),
    isMissing: (value) => value === "",
    isIgnoredMissing: (value) => value === "",
  }, true);
  assert.equal(plan.changeCount, 1);
  assert.equal(plan.changes[0].after, "10");
});

test("distribution preserves category proportions with deterministic remainder", () => {
  const rows = [{ value: "A" }, { value: "A" }, { value: "B" }, { value: "" }, { value: "" }, { value: "" }];
  const result = calculateColumnFill(rows, { column: "value", type: "Category", method: "distribution", scope: "both", isValid: validText }, true);
  assert.deepEqual(result.allocations.map(({ value, count }) => [value, count]), [["A", 2], ["B", 1]]);
  assert.deepEqual(result.changes.map((change) => change.after), ["A", "A", "B"]);
});

test("custom fill supports multiple columns", () => {
  const rows = [{ first: "", second: "bad" }, { first: "A", second: "B" }];
  const result = calculateMultiColumnCustomFill(rows, [
    { column: "first", isValid: validText },
    { column: "second", isValid: validText },
  ], { scope: "both", customValue: "Unknown" }, true);
  assert.equal(result.changeCount, 2);
  assert.deepEqual(result.changes.map((change) => change.column), ["first", "second"]);
});
