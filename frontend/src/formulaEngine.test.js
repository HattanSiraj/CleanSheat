import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFormula, formatFormulaNumber, parseFormula, parseFormulaNumber } from "./formulaEngine.js";

test("formula engine follows operation order and parentheses", () => {
  const normal = parseFormula("[Opening] + [Delivered] - [Sold] - [Wasted]");
  assert.equal(evaluateFormula(normal.ast, { Opening: "100", Delivered: "25", Sold: "60", Wasted: "3" }), 62);
  const grouped = parseFormula("([Gross] - [Discount] + [Shipping]) * [Tax] / 100");
  assert.equal(evaluateFormula(grouped.ast, { Gross: "100", Discount: "10", Shipping: "5", Tax: "15" }), 14.25);
});

test("formula engine handles constants, negative values, and references", () => {
  const parsed = parseFormula("-[Amount] + 10");
  assert.deepEqual(parsed.references, ["Amount"]);
  assert.equal(evaluateFormula(parsed.ast, { Amount: "-2" }), 12);
  assert.equal(parseFormulaNumber("1,250.50"), 1250.5);
  assert.equal(formatFormulaNumber(12.345), "12.35");
});

test("formula engine rejects missing inputs and division by zero", () => {
  assert.throws(() => evaluateFormula(parseFormula("[A] / [B]").ast, { A: "2", B: "0" }), /divide by zero/);
  assert.throws(() => evaluateFormula(parseFormula("[A] + 1").ast, { A: "" }), /empty or not numeric/);
});
