import test from "node:test";
import assert from "node:assert/strict";
import { formatIssueRows, groupValidationIssues } from "./validationIssueGroups.js";

test("validation issue display groups repeated bad values without losing their count", () => {
  const issues = [
    { row: 2, column: "Email", expected: "Email", value: "bad@", reason: "Expected standard email" },
    { row: 7, column: "Email", expected: "Email", value: "bad@", reason: "Expected standard email" },
    { row: 9, column: "Email", expected: "Email", value: "other", reason: "Expected standard email" },
  ];

  const grouped = groupValidationIssues(issues);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].count, 2);
  assert.deepEqual(grouped[0].rows, [2, 7]);
  assert.equal(formatIssueRows(grouped[0]), "2, 7");
});

test("validation issue display keeps the same bad value separate across columns and rules", () => {
  const issues = [
    { row: 1, column: "Phone", expected: "Phone", value: "", reason: "Required value is empty" },
    { row: 2, column: "Email", expected: "Email", value: "", reason: "Required value is empty" },
    { row: 3, column: "Phone", expected: "Phone", value: "", reason: "Value is missing" },
  ];

  assert.equal(groupValidationIssues(issues).length, 3);
});
