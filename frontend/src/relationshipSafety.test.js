import test from "node:test";
import assert from "node:assert/strict";
import { getCircularFormulaRuleIds } from "./relationshipSafety.js";

test("detects every target participating in a circular formula set", () => {
  const rules = [
    { id: "total", kind: "formula", targetColumn: "Total", references: ["Quantity", "Price"] },
    { id: "quantity", kind: "formula", targetColumn: "Quantity", references: ["Total", "Price"] },
    { id: "price", kind: "formula", targetColumn: "Price", references: ["Total", "Quantity"] },
  ];
  assert.deepEqual([...getCircularFormulaRuleIds(rules)].sort(), ["price", "quantity", "total"]);
});

test("does not protect one way calculations or downstream formulas", () => {
  const rules = [
    { id: "a", kind: "formula", targetColumn: "A", references: ["Source"] },
    { id: "b", kind: "formula", targetColumn: "B", references: ["A"] },
    { id: "lookup", kind: "lookup", targetColumn: "Source", references: ["B"] },
  ];
  assert.deepEqual([...getCircularFormulaRuleIds(rules)], []);
});

test("keeps a downstream rule outside a smaller cycle", () => {
  const rules = [
    { id: "a", kind: "formula", targetColumn: "A", references: ["B"] },
    { id: "b", kind: "formula", targetColumn: "B", references: ["A"] },
    { id: "summary", kind: "formula", targetColumn: "Summary", references: ["A"] },
  ];
  assert.deepEqual([...getCircularFormulaRuleIds(rules)].sort(), ["a", "b"]);
});
