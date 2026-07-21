import test from "node:test";
import assert from "node:assert/strict";
import {
  applySchemaTransformToRows,
  buildDuplicatePlan,
  buildTextCleanupPlan,
  getCombinePreview,
  getSchemaOperationColumns,
  getSplitPreview,
} from "./cleaningOperations.js";

const rows = (values) => values.map((value, index) => ({ __rowId: `row-${index}`, ...value }));

test("duplicate matching supports exact and relaxed comparisons", () => {
  const input = rows([{ name: "Alex" }, { name: " alex " }, { name: "Alex" }]);
  assert.equal(buildDuplicatePlan(input, { columns: ["name"], keep: "first" }).deleteCount, 1);
  assert.equal(buildDuplicatePlan(input, { columns: ["name"], keep: "first", trimValues: true, ignoreCase: true }).deleteCount, 2);
});

test("invalid previews expose zeroed counters for safe rendering", () => {
  const duplicate = buildDuplicatePlan([], { columns: [] }, false);
  const split = getSplitPreview([], { sourceColumn: "", outputColumns: [] });
  assert.equal(duplicate.groupCount, 0);
  assert.equal(duplicate.deleteCount, 0);
  assert.equal(split.changedRowCount, 0);
});

test("duplicate removal can keep first, keep last, or remove every copy", () => {
  const input = rows([{ value: "A" }, { value: "A" }, { value: "B" }, { value: "A" }]);
  assert.deepEqual(buildDuplicatePlan(input, { columns: ["value"], keep: "first" }).deletedRows.map((item) => item.index), [1, 3]);
  assert.deepEqual(buildDuplicatePlan(input, { columns: ["value"], keep: "last" }).deletedRows.map((item) => item.index), [0, 1]);
  assert.deepEqual(buildDuplicatePlan(input, { columns: ["value"], keep: "all" }).deletedRows.map((item) => item.index), [0, 1, 3]);
});

test("text cleanup applies whitespace changes before casing", () => {
  const input = rows([{ name: "  hELLo   WORLD  " }]);
  const result = buildTextCleanupPlan(input, { columns: ["name"], trimEdges: true, collapseWhitespace: true, caseMode: "title" });
  assert.equal(result.changes[0].after, "Hello World");
});

test("split keeps overflow in the final output", () => {
  const input = rows([{ full: "one two three four" }]);
  const operation = { type: "splitColumn", sourceColumn: "full", outputColumns: ["first", "rest"], separatorMode: "whitespace", customSeparator: "", removeSources: false };
  assert.equal(getSplitPreview(input, operation).valid, true);
  const result = applySchemaTransformToRows(input, operation);
  assert.deepEqual([result[0].first, result[0].rest], ["one", "two three four"]);
});

test("combine can skip empty values and remove its sources", () => {
  const input = rows([{ first: "A", middle: "", last: "B" }]);
  const operation = { type: "combineColumns", sourceColumns: ["first", "middle", "last"], outputColumn: "full", separatorMode: "space", customSeparator: "", skipEmpty: true, removeSources: true };
  assert.equal(getCombinePreview(input, operation).valid, true);
  const result = applySchemaTransformToRows(input, operation);
  assert.equal(result[0].full, "A B");
  assert.equal("first" in result[0], false);
});

test("schema column order follows the source columns", () => {
  const operation = { type: "splitColumn", sourceColumn: "full", outputColumns: ["first", "last"], removeSources: false };
  const result = getSchemaOperationColumns(["id", "full", "age"], ["id", "full"], operation);
  assert.deepEqual(result.nextColumns, ["id", "full", "first", "last", "age"]);
  assert.deepEqual(result.nextVisibleColumns, ["id", "full", "first", "last"]);
  const replacing = getSchemaOperationColumns(["id", "full", "age"], ["id", "full"], { ...operation, removeSources: true });
  assert.deepEqual(replacing.nextColumns, ["id", "first", "last", "age"]);
});
