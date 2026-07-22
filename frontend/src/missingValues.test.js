import test from "node:test";
import assert from "node:assert/strict";
import {
  getMissingIssue,
  isMissingRuleValid,
  isMissingValue,
  isValueRequired,
  normalizeMissingRule,
  parseMissingTokens,
} from "./missingValues.js";

test("missing tokens are normalized and can ignore case", () => {
  const rule = normalizeMissingRule({ missingTokens: ["NULL", " N/A ", "NULL"] });
  assert.deepEqual(rule.missingTokens, ["NULL", "N/A"]);
  assert.equal(isMissingValue(" null ", rule), true);
  assert.equal(isMissingValue("0", rule), false);
  assert.equal(isMissingValue(false, rule), false);
  assert.deepEqual(parseMissingTokens("NULL, N/A\n?"), ["NULL", "N/A", "?"]);
});

test("allowed missing values do not produce issues", () => {
  const row = { nickname: "" };
  const rule = normalizeMissingRule({ missingPolicy: "allowed" });
  assert.equal(isValueRequired(row, rule), false);
  assert.equal(getMissingIssue(row, "nickname", rule), null);
});

test("conditional missing values are required only when their condition matches", () => {
  const rule = normalizeMissingRule({
    missingPolicy: "conditional",
    missingCondition: { column: "Shipped", operator: "equals", value: "Yes" },
  });
  assert.equal(getMissingIssue({ Shipped: "yes", "Delivery Date": "" }, "Delivery Date", rule)?.reason, "Value is required when Shipped is Yes");
  assert.equal(getMissingIssue({ Shipped: "No", "Delivery Date": "" }, "Delivery Date", rule), null);
});

test("conditional rules require another existing column", () => {
  assert.equal(isMissingRuleValid({ missingPolicy: "conditional", missingCondition: { column: "Status" } }, ["Status", "Date"], "Date"), true);
  assert.equal(isMissingRuleValid({ missingPolicy: "conditional", missingCondition: { column: "Date" } }, ["Status", "Date"], "Date"), false);
});
