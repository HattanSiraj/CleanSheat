import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { CHALLENGES, hasCurrentChallengeRevision } from "./challengeData.js";
import { evaluateChallenge, evaluateObjective, evaluateRule } from "./challengeEngine.js";

test("generated challenge datasets are deterministic and match their advertised size", () => {
  for (const challenge of CHALLENGES.filter((item) => item.createRows)) {
    const first = challenge.createRows();
    const second = challenge.createRows();
    assert.equal(first.length, challenge.rowCount);
    assert.deepEqual(first.slice(0, 5), second.slice(0, 5));
    assert.equal(challenge.story.length, 3);
    assert.ok(challenge.story.every((page) => page.trim().length > 0));
  }
});

test("external challenges include a dataset and a complete story", () => {
  for (const challenge of CHALLENGES.filter((item) => item.dataFile)) {
    assert.ok(challenge.dataFile.endsWith(".csv"));
    assert.equal(challenge.story.length, 3);
    assert.ok(challenge.story.every((page) => page.trim().length > 0));
  }
});

test("formula objectives reject missing operands and accept matching totals", () => {
  const objective = { kind: "formula", target: "Total", left: "Qty", right: "Price", operator: "*", tolerance: 0.01 };
  assert.equal(evaluateObjective(objective, { rows: [{ Qty: "2", Price: "4", Total: "8" }] }).complete, true);
  assert.equal(evaluateObjective(objective, { rows: [{ Qty: "", Price: "4", Total: "8" }] }).complete, false);
});

test("calculated column objectives require the column type and every formula result", () => {
  const objective = {
    kind: "calculatedColumn",
    target: "Closing",
    expectedType: "Number",
    formula: "[Opening] + [Delivered] - [Sold] - [Wasted]",
    tolerance: 0.01,
  };
  const base = {
    columns: ["Opening", "Delivered", "Sold", "Wasted"],
    columnRules: {},
    rows: [{ Opening: "100", Delivered: "25", Sold: "60", Wasted: "3" }],
  };
  assert.equal(evaluateObjective(objective, base).detail, "Create Closing");
  const withColumn = { ...base, columns: [...base.columns, "Closing"], rows: [{ ...base.rows[0], Closing: "62" }] };
  assert.equal(evaluateObjective(objective, withColumn).detail, "Set Closing to Number");
  assert.equal(evaluateObjective(objective, { ...withColumn, columnRules: { Closing: { type: "Number" } } }).complete, true);
  assert.equal(evaluateObjective(objective, { ...withColumn, columnRules: { Closing: { type: "Number" } }, rows: [{ ...withColumn.rows[0], Closing: "61" }] }).complete, false);
});

test("column objectives track required and deleted columns", () => {
  const context = { columns: ["ID", "Total"], columnRules: { Total: { type: "Number" } } };
  assert.equal(evaluateObjective({ kind: "columnsPresent", expected: { Total: "Number" } }, context).complete, true);
  assert.equal(evaluateObjective({ kind: "columnsAbsent", columns: ["Legacy"] }, context).complete, true);
  assert.equal(evaluateObjective({ kind: "columnsAbsent", columns: ["Total"] }, context).complete, false);
});

test("cafe challenge needs a calculated column and removes the kid notes", () => {
  const challenge = CHALLENGES.find((item) => item.id === "cafe-closing-time");
  const sourceRows = challenge.createRows();
  const initialColumns = Object.keys(sourceRows[0]);
  assert.equal(evaluateChallenge(challenge, { rows: sourceRows, columns: initialColumns, columnRules: {} }).complete, false);

  const rows = sourceRows.map((row) => {
    const { "Kid Notes": ignored, ...cleanRow } = row;
    return {
      ...cleanRow,
      "Closing Stock": String(Number(row["Opening Stock"]) + Number(row.Delivered) - Number(row.Sold) - Number(row.Wasted)),
    };
  });
  const columns = [...Object.keys(rows[0])];
  const evaluation = evaluateChallenge(challenge, {
    rows,
    columns,
    columnRules: { "Closing Stock": { type: "Number" } },
    history: [],
  });
  assert.equal(evaluation.complete, true);
});

test("dataset from hell can be completed with the new calculation chain", () => {
  const challenge = CHALLENGES.find((item) => item.id === "dataset-from-hell");
  const seen = new Set();
  const rows = challenge.createRows().flatMap((row, index) => {
    if (seen.has(row["Row Key"])) return [];
    seen.add(row["Row Key"]);
    const gross = numericOr(row["Gross Amount"], 100);
    const discountPercent = numericOr(row["Discount Percent"], 10);
    const shipping = numericOr(row["Shipping Fee"], 5);
    const taxPercent = numericOr(row["Tax Percent"], 15);
    const discount = Number((gross * discountPercent / 100).toFixed(2));
    const tax = Number(((gross - discount) * taxPercent / 100).toFixed(2));
    const { "Legacy Total": ignored, ...cleanRow } = row;
    return [{
      ...cleanRow,
      Email: String(row.Email).includes("@") ? row.Email : `fixed.${index}@example.com`,
      Phone: row.Phone === "not supplied" ? `+966 55 ${String(1000000 + index).slice(-7)}` : row.Phone,
      "Order Date": /^\d{4}-\d{2}-\d{2}$/.test(row["Order Date"]) ? row["Order Date"] : "2025-01-01",
      Status: titleValue(row.Status),
      "Gross Amount": gross.toFixed(2),
      "Discount Percent": String(discountPercent),
      "Shipping Fee": shipping.toFixed(2),
      "Tax Percent": String(taxPercent),
      "Discount Amount": discount.toFixed(2),
      "Tax Amount": tax.toFixed(2),
      "Final Charge": (gross - discount + tax + shipping).toFixed(2),
    }];
  });
  const columns = Object.keys(rows[0]);
  const columnRules = Object.fromEntries(columns.map((column) => [column, { type: "Text" }]));
  Object.assign(columnRules, {
    Email: { type: "Email" },
    Phone: { type: "Phone" },
    "Order Date": { type: "Date" },
    Status: { type: "Category" },
    "Gross Amount": { type: "Number" },
    "Discount Percent": { type: "Number" },
    "Shipping Fee": { type: "Number" },
    "Tax Percent": { type: "Number" },
    "Discount Amount": { type: "Number" },
    "Tax Amount": { type: "Number" },
    "Final Charge": { type: "Number" },
  });
  const evaluation = evaluateChallenge(challenge, {
    rows,
    columns,
    columnRules,
    scanIssues: [],
    lastScannedAt: new Date(),
    history: [],
  });
  assert.equal(evaluation.complete, true);
});

test("method objectives inspect fill metadata", () => {
  const objective = { kind: "method", method: "median", column: "Time", groupBy: "Priority" };
  const history = [{ recipeStep: { type: "fill", method: "median", columns: ["Time"], groupBy: "Priority" } }];
  assert.equal(evaluateObjective(objective, { history }).complete, true);
});

test("optional phone objective accepts cleaned empty values without old null markers", () => {
  const challenge = CHALLENGES.find((item) => item.id === "signup-swamp");
  const objective = challenge.objectives.find((item) => item.id === "phone-optional");
  const columnRules = { Phone: { missingPolicy: "allowed", missingTokens: [] } };
  assert.equal(evaluateObjective(objective, { columnRules }).complete, true);
});

test("signup challenge tracks email and phone scan issues separately", () => {
  const challenge = CHALLENGES.find((item) => item.id === "signup-swamp");
  const emailObjective = challenge.objectives.find((item) => item.id === "emails-clean");
  const phoneObjective = challenge.objectives.find((item) => item.id === "phones-clean");
  const scanIssues = [{ column: "Email" }];
  const columnRules = { Email: { type: "Email" }, Phone: { type: "Phone" } };
  assert.equal(evaluateObjective(emailObjective, { scanIssues, lastScannedAt: new Date(), columnRules }).complete, false);
  assert.equal(evaluateObjective(phoneObjective, { scanIssues, lastScannedAt: new Date(), columnRules }).complete, true);
});

test("signup scan objectives cannot pass while their columns are still Text", () => {
  const challenge = CHALLENGES.find((item) => item.id === "signup-swamp");
  const emailObjective = challenge.objectives.find((item) => item.id === "emails-clean");
  const result = evaluateObjective(emailObjective, {
    scanIssues: [],
    lastScannedAt: new Date(),
    columnRules: { Email: { type: "Text" } },
  });
  assert.equal(result.complete, false);
  assert.equal(result.detail, "Set Email to Email");
});

test("no-missing objectives cannot be completed by deleting required rows", () => {
  const objective = { kind: "noMissing", columns: ["Time"], minimumRows: 2 };
  assert.equal(evaluateObjective(objective, { rows: [{ Time: "10" }, { Time: "" }] }).complete, false);
  assert.equal(evaluateObjective(objective, { rows: [{ Time: "10" }] }).complete, false);
  assert.equal(evaluateObjective(objective, { rows: [{ Time: "10" }, { Time: "20" }] }).complete, true);
});

test("support challenge starts with dirty priorities and missing resolution times", () => {
  const challenge = CHALLENGES.find((item) => item.id === "support-night-shift");
  const rows = challenge.createRows();
  const evaluation = evaluateChallenge(challenge, { rows, history: [] });
  assert.equal(evaluation.completedCount, 0);
  assert.ok(rows.some((row) => !["Low", "Normal", "High", "Urgent"].includes(row.Priority)));
  assert.ok(rows.some((row) => row["Resolution Minutes"] === ""));
});

test("support challenge accepts only the correct median recovery", () => {
  const challenge = CHALLENGES.find((item) => item.id === "support-night-shift");
  const sourceRows = challenge.createRows();
  const medians = calculatePriorityMedians(sourceRows);
  const fixedRows = sourceRows.map((row) => {
    const priority = toPriority(row.Priority);
    return {
      ...row,
      Priority: priority,
      "Resolution Minutes": row["Resolution Minutes"] || String(medians[priority]),
    };
  });
  const evaluation = evaluateChallenge(challenge, { rows: fixedRows, history: [] });
  assert.equal(evaluation.complete, true);

  const wrongRows = fixedRows.map((row, index) => index === 4 ? { ...row, "Resolution Minutes": "999" } : row);
  assert.equal(evaluateChallenge(challenge, { rows: wrongRows, history: [] }).complete, false);
});

test("challenge rules stop deletion shortcuts without changing objective score", () => {
  const challenge = {
    objectives: [{ id: "clean", kind: "noMissing", columns: ["Value"] }],
    rules: [{ id: "keep", kind: "rowCount", minimum: 2, maximum: 2 }],
  };
  const evaluation = evaluateChallenge(challenge, { rows: [{ Value: "ready" }] });
  assert.equal(evaluation.score, 100);
  assert.equal(evaluation.rulesPassed, false);
  assert.equal(evaluation.complete, false);
  assert.equal(evaluation.stars, 2);
});

test("minimum match rules protect meaningful rows", () => {
  const rows = [{ Invoice: "C100" }, { Invoice: "100" }, { Invoice: "c101" }];
  const rule = { kind: "minimumMatches", column: "Invoice", operator: "startsWith", value: "C", minimum: 2 };
  assert.equal(evaluateRule(rule, { rows }).complete, true);
  assert.equal(evaluateRule({ ...rule, minimum: 3 }, { rows }).complete, false);
});

test("duplicate objectives point players to the correct cleaning tool", () => {
  const objective = { kind: "unique", columns: ["ID"] };
  const result = evaluateObjective(objective, { rows: [{ ID: "1" }, { ID: "1" }] });
  assert.equal(result.complete, false);
  assert.match(result.detail, /Cleaning Tools then Duplicates/);
});

test("challenge revisions invalidate old records and saves", () => {
  const challenge = CHALLENGES[0];
  assert.equal(hasCurrentChallengeRevision(challenge, challenge.revision), true);
  assert.equal(hasCurrentChallengeRevision(challenge, challenge.revision - 1), false);
  assert.equal(hasCurrentChallengeRevision(challenge, undefined), false);
});

test("online retail challenge data matches the credited source snapshot", () => {
  const challenge = CHALLENGES.find((item) => item.id === "final-final-export");
  const csvUrl = new URL("../public/challenges/online_retail_2010_2011.csv", import.meta.url);
  const parsed = Papa.parse(readFileSync(csvUrl, "utf8"), { header: true, skipEmptyLines: true });
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.length, challenge.rowCount);
  assert.deepEqual(parsed.meta.fields, ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"]);

  const seen = new Set();
  let duplicates = 0;
  let blankDescriptions = 0;
  let cancellations = 0;
  let badDebtAdjustments = 0;
  let cleanedRows = 0;
  let cleanedCancellations = 0;
  let cleanedBadDebtAdjustments = 0;
  let blankDescriptionsWithPrice = 0;
  for (const row of parsed.data) {
    const key = parsed.meta.fields.map((column) => row[column] ?? "").join("\u001f");
    const isDuplicate = seen.has(key);
    if (isDuplicate) duplicates += 1;
    seen.add(key);
    const description = String(row.Description ?? "").trim();
    const isCancellation = String(row.Invoice ?? "").toLocaleUpperCase().startsWith("C");
    const isBadDebtAdjustment = description.toLocaleLowerCase() === "adjust bad debt";
    if (!description) {
      blankDescriptions += 1;
      if (Number(row.Price) !== 0) blankDescriptionsWithPrice += 1;
    }
    if (isCancellation) cancellations += 1;
    if (isBadDebtAdjustment) badDebtAdjustments += 1;
    if (!isDuplicate && description) {
      cleanedRows += 1;
      if (isCancellation) cleanedCancellations += 1;
      if (isBadDebtAdjustment) cleanedBadDebtAdjustments += 1;
    }
  }

  assert.equal(duplicates, 5268);
  assert.equal(blankDescriptions, 1454);
  assert.equal(blankDescriptionsWithPrice, 0);
  assert.equal(cancellations, 9288);
  assert.equal(badDebtAdjustments, 3);
  assert.equal(cleanedRows, 535188);
  assert.equal(cleanedCancellations, 9251);
  assert.equal(cleanedBadDebtAdjustments, 3);
  assert.equal(challenge.rules.find((rule) => rule.id === "retail-row-count").minimum, 535188);
});

test("challenge scoring awards three stars only when every objective is complete", () => {
  const challenge = { objectives: [{ id: "one", kind: "rowCount", minimum: 1 }] };
  assert.equal(evaluateChallenge(challenge, { rows: [{}] }).stars, 3);
  assert.equal(evaluateChallenge(challenge, { rows: [] }).stars, 0);
});

function toPriority(value) {
  const normalized = String(value).trim().toLocaleLowerCase();
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}

function calculatePriorityMedians(rows) {
  const values = {};
  for (const row of rows) {
    const priority = toPriority(row.Priority);
    if (!row["Resolution Minutes"]) continue;
    values[priority] ??= [];
    values[priority].push(Number(row["Resolution Minutes"]));
  }
  return Object.fromEntries(Object.entries(values).map(([priority, groupValues]) => {
    const sorted = groupValues.sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return [priority, median];
  }));
}

function numericOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function titleValue(value) {
  const normalized = String(value).trim().toLocaleLowerCase();
  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
}
