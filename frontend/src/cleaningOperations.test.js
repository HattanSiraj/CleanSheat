import test from "node:test";
import assert from "node:assert/strict";
import {
  applySchemaTransformToRows,
  buildDuplicatePlan,
  buildTextCleanupPlan,
  getCombinePreview,
  getSchemaOperationColumns,
  getSplitPreview,
  mergeVisibleColumnOrder,
  validateSchemaOperation,
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

test("columns can be created with empty or fixed values", () => {
  const input = rows([{ id: "1" }, { id: "2" }]);
  const empty = { type: "createColumn", column: "Total", initialMode: "empty", initialValue: "" };
  assert.equal(validateSchemaOperation(["id"], empty).valid, true);
  assert.deepEqual(applySchemaTransformToRows(input, empty).map((row) => row.Total), ["", ""]);
  const fixed = { ...empty, column: "Status", initialMode: "fixed", initialValue: "Pending" };
  assert.deepEqual(applySchemaTransformToRows(input, fixed).map((row) => row.Status), ["Pending", "Pending"]);
  assert.deepEqual(getSchemaOperationColumns(["id"], ["id"], fixed).nextColumns, ["id", "Status"]);
});

test("column creation rejects reserved and repeated names", () => {
  assert.equal(validateSchemaOperation(["Email"], { type: "createColumn", column: "email", initialMode: "empty" }).valid, false);
  assert.equal(validateSchemaOperation(["Email"], { type: "createColumn", column: "__rowId", initialMode: "empty" }).valid, false);
  assert.equal(validateSchemaOperation(["Email"], { type: "createColumn", column: "__ROWID", initialMode: "empty" }).valid, false);
});

test("several columns can be deleted while one column must remain", () => {
  const input = rows([{ id: "1", old: "x", junk: "y" }]);
  const operation = { type: "deleteColumns", columns: ["old", "junk"] };
  assert.equal(validateSchemaOperation(["id", "old", "junk"], operation).valid, true);
  const result = applySchemaTransformToRows(input, operation);
  assert.deepEqual(Object.keys(result[0]).sort(), ["__rowId", "id"]);
  assert.deepEqual(getSchemaOperationColumns(["id", "old", "junk"], ["id", "junk"], operation).nextVisibleColumns, ["id"]);
  assert.equal(validateSchemaOperation(["id", "old"], { type: "deleteColumns", columns: ["id", "old"] }).valid, false);
});

test("visible column ordering keeps hidden columns in their existing slots", () => {
  assert.deepEqual(
    mergeVisibleColumnOrder(["A", "B", "C", "D"], ["D", "A", "C"]),
    ["D", "B", "A", "C"],
  );
});
