import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { CHALLENGES, hasCurrentChallengeRevision } from "./challengeData.js";
import { evaluateChallenge, evaluateChallengeInChunks, evaluateObjective, evaluateRule } from "./challengeEngine.js";

test("chunked challenge evaluation matches the synchronous evaluator", async () => {
  const challenge = CHALLENGES.find((item) => item.createRows);
  const rows = challenge.createRows();
  const context = { rows, columns: Object.keys(rows[0]), columnRules: {}, history: [] };
  let yields = 0;

  const expected = evaluateChallenge(challenge, context);
  const actual = await evaluateChallengeInChunks(challenge, context, {
    yieldControl: async () => { yields += 1; },
  });

  assert.deepEqual(actual, expected);
  assert.equal(yields, challenge.objectives.length + (challenge.rules?.length ?? 0));
});

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

test("every campaign file has a full objective list", () => {
  for (const challenge of CHALLENGES) {
    assert.ok(challenge.objectives.length >= 6);
  }
});

test("HELL DISK contains six deterministic corrupted files", () => {
  const hellChallenges = CHALLENGES.filter((challenge) => challenge.pack === "hell");
  assert.equal(hellChallenges.length, 6);
  assert.deepEqual(hellChallenges.map((challenge) => challenge.packOrder), [1, 2, 3, 4, 5, 6]);
  assert.ok(hellChallenges.every((challenge) => /[0-9_[\]█/:)]/.test(challenge.title)));

  const missingChallenge = hellChallenges.find((challenge) => challenge.id === "hell-missing-value-cult");
  const rows = missingChallenge.createRows();
  assert.ok(rows.every((row) => /^READ-[0-9]{6}$/.test(row["Reading ID"])));
  assert.equal(new Set(rows.map((row) => row["Reading ID"])).size, rows.length);
});

test("fill contracts verify the chosen grouped statistic against source rows", () => {
  const sourceRows = [
    { ID: "1", Group: "A", Value: "10" },
    { ID: "2", Group: "A", Value: "20" },
    { ID: "3", Group: "A", Value: "" },
    { ID: "4", Group: "B", Value: "7" },
    { ID: "5", Group: "B", Value: "" },
  ];
  const challenge = {
    objectives: [{
      id: "group-average",
      title: "Fill each group average",
      kind: "fillContract",
      idColumn: "ID",
      column: "Value",
      groupBy: "Group",
      method: "average",
      expectedType: "Number",
    }],
    createRows: () => sourceRows,
  };
  const context = {
    columns: ["ID", "Group", "Value"],
    columnRules: { Value: { type: "Number" } },
    rows: sourceRows.map((row) => (
      row.ID === "3" ? { ...row, Value: "15.00" }
        : row.ID === "5" ? { ...row, Value: "7.00" }
          : row
    )),
  };

  assert.equal(evaluateChallenge(challenge, context).complete, true);
  assert.equal(evaluateChallenge(challenge, {
    ...context,
    rows: context.rows.map((row) => row.ID === "3" ? { ...row, Value: "14" } : row),
  }).complete, false);
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

test("pattern objectives check every value and any requested type", () => {
  const objective = {
    kind: "patternMatch",
    column: "Code",
    expectedType: "Text",
    pattern: "^ROW-[0-9]{3}$",
  };
  const context = {
    rows: [{ Code: "ROW-001" }, { Code: "ROW-002" }],
    columns: ["Code"],
    columnRules: { Code: { type: "Text" } },
  };
  assert.equal(evaluateObjective(objective, context).complete, true);
  assert.equal(evaluateObjective(objective, { ...context, rows: [{ Code: "ROW_001" }] }).complete, false);
  assert.equal(evaluateObjective(objective, { ...context, columnRules: { Code: { type: "Number" } } }).complete, false);
});

test("optional pattern values need an allowed missing policy when blanks remain", () => {
  const objective = {
    kind: "patternMatch",
    column: "Date",
    expectedType: "Date",
    pattern: "^\\d{4}-\\d{2}-\\d{2}$",
    allowBlank: true,
    requireAllowedMissingWhenBlank: true,
  };
  const context = {
    rows: [{ Date: "2026-07-01" }, { Date: "" }],
    columns: ["Date"],
    columnRules: { Date: { type: "Date", missingPolicy: "required" } },
  };
  assert.equal(evaluateObjective(objective, context).complete, false);
  assert.equal(evaluateObjective(objective, {
    ...context,
    columnRules: { Date: { type: "Date", missingPolicy: "allowed" } },
  }).complete, true);
  assert.equal(evaluateObjective(objective, {
    ...context,
    rows: [{ Date: "2026-07-01" }],
  }).complete, true);
});

test("transformed column objectives verify split and combined results", () => {
  const rows = [{ Name: "Mina A", First: "Mina", Initial: "A", Product: "Cable", Zone: "North", Label: "Cable | North" }];
  const columns = Object.keys(rows[0]);
  const split = { kind: "transformedColumns", operation: "split", source: "Name", outputs: ["First", "Initial"], separator: "whitespace" };
  const combine = { kind: "transformedColumns", operation: "combine", sources: ["Product", "Zone"], target: "Label", separator: " | " };
  assert.equal(evaluateObjective(split, { rows, columns }).complete, true);
  assert.equal(evaluateObjective(combine, { rows, columns }).complete, true);
  assert.equal(evaluateObjective(combine, { rows: [{ ...rows[0], Label: "North Cable" }], columns }).complete, false);
});

test("cafe challenge needs a calculated column and removes the kid notes", () => {
  const challenge = CHALLENGES.find((item) => item.id === "cafe-closing-time");
  const sourceRows = challenge.createRows();
  const initialColumns = Object.keys(sourceRows[0]);
  assert.equal(evaluateChallenge(challenge, { rows: sourceRows, columns: initialColumns, columnRules: {} }).complete, false);

  const items = ["Coffee Beans", "Oat Milk", "Croissants", "Paper Cups", "Chocolate Syrup"];
  const rows = sourceRows.map((row, index) => {
    const { "Kid Notes": _ignored, ...cleanRow } = row;
    return {
      ...cleanRow,
      "Stock Check ID": `CAFE-${String(index + 1).padStart(3, "0")}`,
      "Stock Date": `2026-07-${String(index % 20 + 1).padStart(2, "0")}`,
      Item: items[index % items.length],
      "Closing Stock": String(Number(row["Opening Stock"]) + Number(row.Delivered) - Number(row.Sold) - Number(row.Wasted)),
    };
  });
  const columns = [...Object.keys(rows[0])];
  const evaluation = evaluateChallenge(challenge, {
    rows,
    columns,
    columnRules: {
      "Stock Date": { type: "Date" },
      Item: { type: "Category" },
      "Opening Stock": { type: "Number" },
      Delivered: { type: "Number" },
      Sold: { type: "Number" },
      Wasted: { type: "Number" },
      "Closing Stock": { type: "Number" },
    },
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
    const { "Legacy Total": _ignored, ...cleanRow } = row;
    return [{
      ...cleanRow,
      Email: String(row.Email).includes("@") ? row.Email : `fixed.${index}@example.com`,
      Phone: row.Phone === "not supplied" ? `+966 55 ${String(1000000 + index).slice(-7)}` : row.Phone,
      "Order Date": /^\d{4}-\d{2}-\d{2}$/.test(row["Order Date"]) ? row["Order Date"] : "2025-01-01",
      Status: titleValue(row.Status),
      Paid: index % 5 === 0 ? "no" : "yes",
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
    Paid: { type: "Boolean" },
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

test("optional phone objective accepts the configured null markers", () => {
  const challenge = CHALLENGES.find((item) => item.id === "signup-swamp");
  const objective = challenge.objectives.find((item) => item.id === "phone-optional");
  const columnRules = { Phone: { missingPolicy: "allowed", missingTokens: ["NULL", "N/A"] } };
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

test("validation contracts accept equivalent regex rules and reject wildcard shortcuts", () => {
  const objective = {
    kind: "validationContract",
    checks: [{
      column: "Invoice",
      type: "Text",
      mode: "customRegex",
      matchMode: "full",
      validSamples: ["536365", "C536379", "A563185"],
      invalidSamples: ["53636", "X536365", "5363657"],
    }],
  };
  const context = {
    columns: ["Invoice"],
    columnRules: {
      Invoice: {
        type: "Text",
        mode: "customRegex",
        matchMode: "full",
        customPattern: "(?:A|C)?\\d{6}",
      },
    },
    scanIssues: [],
    lastScannedAt: new Date(),
  };
  assert.equal(evaluateObjective(objective, context).complete, true);
  assert.equal(evaluateObjective(objective, {
    ...context,
    columnRules: { Invoice: { ...context.columnRules.Invoice, customPattern: ".*" } },
  }).complete, false);
  assert.equal(evaluateObjective(objective, {
    ...context,
    scanIssues: [{ column: "Invoice" }],
  }).complete, false);
});

test("text normalization objectives check the requested cleanup without changing case by accident", () => {
  const description = {
    kind: "textNormalized",
    column: "Description",
    trimEdges: true,
    collapseWhitespace: true,
    caseMode: "keep",
  };
  const stockCode = {
    kind: "textNormalized",
    column: "StockCode",
    caseMode: "upper",
  };
  assert.equal(evaluateObjective(description, {
    rows: [{ Description: "  Blue   mug " }],
  }).complete, false);
  assert.equal(evaluateObjective(description, {
    rows: [{ Description: "Blue mug" }, { Description: "BLUE MUG" }],
  }).complete, true);
  assert.equal(evaluateObjective(stockCode, {
    rows: [{ StockCode: "ab12" }],
  }).complete, false);
  assert.equal(evaluateObjective(stockCode, {
    rows: [{ StockCode: "AB12" }],
  }).complete, true);
});

test("exact category objectives allow blanks but require the full configured list", () => {
  const objective = {
    kind: "allowedValues",
    column: "Country",
    expectedType: "Category",
    values: ["France", "Ireland"],
    allowBlank: true,
    requireConfiguredValues: true,
  };
  const context = {
    rows: [{ Country: "France" }, { Country: "Ireland" }, { Country: "" }],
    columnRules: {
      Country: {
        type: "Category",
        mode: "friendly",
        friendlyKind: "allowedValues",
        allowedValues: ["Ireland", "France"],
      },
    },
  };
  assert.equal(evaluateObjective(objective, context).complete, true);
  assert.equal(evaluateObjective(objective, {
    ...context,
    columnRules: {
      Country: {
        ...context.columnRules.Country,
        allowedValues: ["Ireland", "France", "EIRE"],
      },
    },
  }).complete, false);
});

test("group recovery objectives reject blanks and values copied from the wrong group", () => {
  const objective = {
    kind: "groupConsistencyRecovery",
    column: "Country",
    groupBy: "Customer ID",
    selector: { numericModulo: 7, remainder: 0 },
    minimumGroups: 2,
  };
  const rows = [
    { "Customer ID": "14", Country: "Ireland" },
    { "Customer ID": "14", Country: "" },
    { "Customer ID": "21", Country: "France" },
    { "Customer ID": "21", Country: "France" },
  ];
  assert.equal(evaluateObjective(objective, { rows }).complete, false);
  assert.equal(evaluateObjective(objective, {
    rows: rows.map((row) => row["Customer ID"] === "14" ? { ...row, Country: "Ireland" } : row),
  }).complete, true);
  assert.equal(evaluateObjective(objective, {
    rows: rows.map((row) => !row.Country ? { ...row, Country: "France" } : row),
  }).complete, false);
});

test("export schema objectives check the transforms formats and exact column order", () => {
  const objective = {
    kind: "exportSchema",
    split: { operation: "split", source: "InvoiceDate", outputs: ["Invoice Date", "Invoice Time"], separator: "whitespace" },
    combine: { operation: "combine", sources: ["StockCode", "Description"], target: "Product Label", separator: " | " },
    checks: [
      { column: "Invoice Date", type: "Date", presetId: "date-us" },
      {
        column: "Invoice Time",
        type: "Text",
        mode: "customRegex",
        matchMode: "full",
        validSamples: ["8:26", "14:50", "23:59"],
        invalidSamples: ["24:00", "8.26", "14:5"],
      },
    ],
    expectedColumns: ["InvoiceDate", "Invoice Date", "Invoice Time", "StockCode", "Description", "Product Label"],
  };
  const row = {
    InvoiceDate: "12/1/2010 8:26",
    "Invoice Date": "12/1/2010",
    "Invoice Time": "8:26",
    StockCode: "85123A",
    Description: "WHITE HANGING HEART",
    "Product Label": "85123A | WHITE HANGING HEART",
  };
  const context = {
    rows: [row],
    columns: objective.expectedColumns,
    columnRules: {
      "Invoice Date": { type: "Date", presetId: "date-us" },
      "Invoice Time": {
        type: "Text",
        mode: "customRegex",
        matchMode: "full",
        customPattern: "(?:[01]?\\d|2[0-3]):[0-5]\\d",
      },
    },
    scanIssues: [],
    lastScannedAt: new Date(),
  };
  assert.equal(evaluateObjective(objective, context).complete, true);
  assert.equal(evaluateObjective(objective, {
    ...context,
    columns: [...context.columns].reverse(),
  }).complete, false);
  assert.equal(evaluateObjective(objective, {
    ...context,
    rows: [{ ...row, "Product Label": "85123A WHITE HANGING HEART" }],
  }).complete, false);
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
  const agents = ["Mina", "Omar", "Sara", "Yousef"];
  const channels = ["Email", "Chat", "Phone"];
  const fixedRows = sourceRows.map((row, index) => {
    const priority = toPriority(row.Priority);
    const resolutionMinutes = row["Resolution Minutes"] || String(medians[priority]);
    return {
      ...row,
      "Ticket ID": `T-${20000 + index}`,
      "Opened At": `2026-06-${String(index % 28 + 1).padStart(2, "0")} ${String((index * 3) % 24).padStart(2, "0")}:00`,
      Priority: priority,
      Agent: agents[(index * 3) % agents.length],
      Channel: channels[index % channels.length],
      "Resolution Minutes": resolutionMinutes,
      "Resolution Hours": String(Number(resolutionMinutes) / 60),
    };
  });
  const columns = Object.keys(fixedRows[0]);
  const columnRules = {
    "Opened At": { type: "Date" },
    Priority: { type: "Category" },
    Agent: { type: "Category" },
    Channel: { type: "Category" },
    "Resolution Minutes": { type: "Number" },
    "Resolution Hours": { type: "Number" },
  };
  const context = {
    rows: fixedRows,
    columns,
    columnRules,
    scanIssues: [],
    lastScannedAt: new Date(),
    history: [],
  };
  const evaluation = evaluateChallenge(challenge, context);
  assert.equal(evaluation.complete, true);

  const wrongRows = fixedRows.map((row, index) => index === 4 ? { ...row, "Resolution Minutes": "999" } : row);
  assert.equal(evaluateChallenge(challenge, { ...context, rows: wrongRows }).complete, false);
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

test("guided cleanup allows broken date rows but rejects deleting unrelated rows", () => {
  const rule = {
    kind: "guidedRowCleanup",
    requiredColumns: ["Quantity", "Price", "Total"],
    minimumValidRequiredValues: 2,
    requiredDeletions: 1,
    optionalColumn: "Date",
    optionalInvalidValues: ["", "ERROR"],
  };
  const required = { __rowId: "required", Quantity: "", Price: "4", Total: "", Date: "2026-07-01" };
  const optional = { __rowId: "optional", Quantity: "2", Price: "4", Total: "8", Date: "" };
  const clean = { __rowId: "clean", Quantity: "2", Price: "4", Total: "8", Date: "2026-07-01" };
  const history = [{ kind: "deleteRows", rows: [{ row: required }, { row: optional }] }];
  assert.equal(evaluateRule(rule, { history }).complete, true);
  assert.equal(evaluateRule(rule, {
    history: [...history, { kind: "deleteRows", rows: [{ row: clean }] }],
  }).complete, false);
});

test("boot sequence accepts keeping or deleting its broken date rows", () => {
  const challenge = CHALLENGES.find((item) => item.id === "boot-sequence");
  const rule = challenge.rules.find((item) => item.kind === "guidedRowCleanup");
  const csvUrl = new URL("../public/sample_sales.csv", import.meta.url);
  const parsed = Papa.parse(readFileSync(csvUrl, "utf8"), { header: true, skipEmptyLines: true });
  const rows = parsed.data.map((row, index) => ({ ...row, __rowId: `boot-${index}` }));
  const numericColumns = ["Quantity", "Price Per Unit", "Total Spent"];
  const validNumberCount = (row) => numericColumns
    .filter((column) => String(row[column]).trim() !== "" && Number.isFinite(Number(row[column])))
    .length;
  const requiredRows = rows.filter((row) => validNumberCount(row) < 2);
  const optionalDateRows = rows.filter((row) => (
    validNumberCount(row) >= 2
    && ["", "ERROR", "UNKNOWN"].includes(String(row["Transaction Date"]).trim())
  ));
  assert.equal(requiredRows.length, 58);
  const requiredHistory = [{
    kind: "deleteRows",
    rows: requiredRows.map((row) => ({ row })),
  }];
  assert.equal(evaluateRule(rule, { history: requiredHistory }).complete, true);
  assert.equal(evaluateRule(rule, {
    history: [{
      kind: "deleteRows",
      rows: [...requiredRows, ...optionalDateRows].map((row) => ({ row })),
    }],
  }).complete, true);
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

test("online retail challenge data contains the planned mess and one exact solution", () => {
  const challenge = CHALLENGES.find((item) => item.id === "final-final-export");
  const parsed = loadRetailFixture();
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.length, challenge.rowCount);
  const sourceColumns = ["Invoice", "StockCode", "Description", "Quantity", "InvoiceDate", "Price", "Customer ID", "Country"];
  assert.deepEqual(parsed.meta.fields, sourceColumns);

  const seen = new Set();
  let duplicates = 0;
  let blankDescriptions = 0;
  let blankCountries = 0;
  let cancellations = 0;
  let badDebtAdjustments = 0;
  let blankDescriptionsWithPrice = 0;
  let eireRows = 0;
  let descriptionChanges = 0;
  let stockCodeChanges = 0;
  const countriesByCustomer = new Map();
  for (const row of parsed.data) {
    const key = retailRowKey(row, sourceColumns);
    const isDuplicate = seen.has(key);
    if (isDuplicate) duplicates += 1;
    seen.add(key);
    const description = String(row.Description ?? "").trim();
    const country = String(row.Country ?? "").trim();
    const customerId = String(row["Customer ID"] ?? "").trim();
    const isCancellation = String(row.Invoice ?? "").toLocaleUpperCase().startsWith("C");
    const isBadDebtAdjustment = description.toLocaleLowerCase() === "adjust bad debt";
    if (!description) {
      blankDescriptions += 1;
      if (Number(row.Price) !== 0) blankDescriptionsWithPrice += 1;
    }
    if (!country) blankCountries += 1;
    if (country === "EIRE") eireRows += 1;
    if (String(row.Description ?? "") !== cleanRetailDescription(row.Description)) descriptionChanges += 1;
    if (String(row.StockCode ?? "") !== String(row.StockCode ?? "").toLocaleUpperCase()) stockCodeChanges += 1;
    if (isCancellation) cancellations += 1;
    if (isBadDebtAdjustment) badDebtAdjustments += 1;
    if (customerId && country) {
      const values = countriesByCustomer.get(customerId) ?? new Set();
      values.add(cleanRetailCountry(country));
      countriesByCustomer.set(customerId, values);
    }
  }

  const gapRows = parsed.data.filter((row) => !String(row.Country ?? "").trim());
  assert.equal(duplicates, 804);
  assert.equal(blankDescriptions, 299);
  assert.equal(blankCountries, 201);
  assert.equal(blankDescriptionsWithPrice, 0);
  assert.equal(eireRows, 1026);
  assert.equal(descriptionChanges, 22110);
  assert.equal(stockCodeChanges, 592);
  assert.equal(cancellations, 1870);
  assert.equal(badDebtAdjustments, 3);
  assert.equal(new Set(gapRows.map((row) => row["Customer ID"])).size, 201);
  assert.ok(gapRows.every((row) => Number(row["Customer ID"]) % 7 === 0));
  assert.ok(gapRows.every((row) => countriesByCustomer.get(row["Customer ID"])?.size === 1));
  assert.ok(gapRows.every((row) => cleanRetailDescription(row.Description)));
  assert.ok(gapRows.every((row) => !String(row.Invoice).toLocaleUpperCase().startsWith("C")));

  const normalizedRows = normalizeRetailRows(parsed.data);
  assert.equal(countRetailDuplicates(normalizedRows, sourceColumns), 924);
  const solvedRows = buildSolvedRetailRows(parsed.data, sourceColumns);
  assert.equal(solvedRows.length, 98777);
  assert.equal(solvedRows.filter((row) => String(row.Invoice).toLocaleUpperCase().startsWith("C")).length, 1855);
  assert.equal(solvedRows.filter((row) => cleanRetailDescription(row.Description).toLocaleLowerCase() === "adjust bad debt").length, 3);
  assert.equal(challenge.rules.find((rule) => rule.id === "retail-row-count").minimum, 98777);
});

test("online retail challenge can complete every linked objective and protected rule", () => {
  const challenge = CHALLENGES.find((item) => item.id === "final-final-export");
  const parsed = loadRetailFixture();
  const sourceColumns = parsed.meta.fields;
  const initialEvaluation = evaluateChallenge(challenge, {
    rows: parsed.data,
    columns: sourceColumns,
    columnRules: {},
    scanIssues: [],
  });
  assert.equal(initialEvaluation.completedCount, 0);

  const rows = buildSolvedRetailRows(parsed.data, sourceColumns);
  const exportObjective = challenge.objectives.find((objective) => objective.id === "retail-export-schema");
  const countryObjective = challenge.objectives.find((objective) => objective.id === "retail-countries");
  const columns = exportObjective.expectedColumns;
  const columnRules = Object.fromEntries(columns.map((column) => [column, { type: "Text" }]));
  Object.assign(columnRules, {
    Invoice: {
      type: "Text",
      mode: "customRegex",
      matchMode: "full",
      customPattern: "(?:A|C)?[0-9]{6}",
    },
    InvoiceDate: {
      type: "Text",
      mode: "customRegex",
      matchMode: "full",
      customPattern: "(?:[1-9]|1[0-2])/(?:[1-9]|[12][0-9]|3[01])/(?:2010|2011) (?:[0-9]|1[0-9]|2[0-3]):[0-5][0-9]",
    },
    Quantity: { type: "Integer" },
    Price: { type: "Number" },
    "Customer ID": {
      type: "Text",
      mode: "customRegex",
      matchMode: "full",
      missingPolicy: "allowed",
      customPattern: "[0-9]{5}",
    },
    Country: {
      type: "Category",
      mode: "friendly",
      friendlyKind: "allowedValues",
      allowedValues: countryObjective.values,
    },
    "Invoice Date": { type: "Date", presetId: "date-us" },
    "Invoice Time": {
      type: "Text",
      mode: "customRegex",
      matchMode: "full",
      customPattern: "(?:[01]?[0-9]|2[0-3]):[0-5][0-9]",
    },
    "Line Total": { type: "Number" },
  });
  const fullMatch = (value, pattern) => new RegExp(`^(?:${pattern})$`).test(String(value ?? ""));
  assert.ok(rows.every((row) => fullMatch(row.Invoice, columnRules.Invoice.customPattern)));
  assert.ok(rows.every((row) => fullMatch(row.InvoiceDate, columnRules.InvoiceDate.customPattern)));
  assert.ok(rows.every((row) => !row["Customer ID"] || fullMatch(row["Customer ID"], columnRules["Customer ID"].customPattern)));
  assert.ok(rows.every((row) => fullMatch(row["Invoice Time"], columnRules["Invoice Time"].customPattern)));
  assert.ok(rows.every((row) => Number.isInteger(Number(row.Quantity))));
  assert.ok(rows.every((row) => Number.isFinite(Number(row.Price))));
  assert.ok(rows.every((row) => countryObjective.values.includes(row.Country)));

  const evaluation = evaluateChallenge(challenge, {
    rows,
    columns,
    columnRules,
    scanIssues: [],
    lastScannedAt: new Date(),
    history: [],
  });

  assert.equal(evaluation.totalCount, 10);
  assert.equal(evaluation.completedCount, 10);
  assert.equal(evaluation.rulesPassed, true);
  assert.equal(evaluation.complete, true);
  assert.equal(evaluation.stars, 3);
});

test("challenge scoring awards three stars only when every objective is complete", () => {
  const challenge = { objectives: [{ id: "one", kind: "rowCount", minimum: 1 }] };
  assert.equal(evaluateChallenge(challenge, { rows: [{}] }).stars, 3);
  assert.equal(evaluateChallenge(challenge, { rows: [] }).stars, 0);
});

function loadRetailFixture() {
  const csvUrl = new URL("../public/challenges/online_retail_2010_2011.csv", import.meta.url);
  return Papa.parse(readFileSync(csvUrl, "utf8"), { header: true, skipEmptyLines: true });
}

function cleanRetailDescription(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function cleanRetailCountry(value) {
  const country = String(value ?? "").trim();
  return country === "EIRE" ? "Ireland" : country;
}

function retailRowKey(row, columns) {
  return columns.map((column) => row[column] ?? "").join("\u001f");
}

function countRetailDuplicates(rows, columns) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const key = retailRowKey(row, columns);
    if (seen.has(key)) duplicates += 1;
    seen.add(key);
  }
  return duplicates;
}

function normalizeRetailRows(sourceRows) {
  const rows = sourceRows.map((row) => ({
    ...row,
    StockCode: String(row.StockCode ?? "").toLocaleUpperCase(),
    Description: cleanRetailDescription(row.Description),
    Country: cleanRetailCountry(row.Country),
  }));
  const countriesByCustomer = new Map();
  for (const row of rows) {
    const customerId = String(row["Customer ID"] ?? "").trim();
    const country = String(row.Country ?? "").trim();
    if (!customerId || !country) continue;
    const counts = countriesByCustomer.get(customerId) ?? new Map();
    counts.set(country, (counts.get(country) ?? 0) + 1);
    countriesByCustomer.set(customerId, counts);
  }
  for (const row of rows) {
    if (String(row.Country ?? "").trim()) continue;
    const customerId = String(row["Customer ID"] ?? "").trim();
    const counts = countriesByCustomer.get(customerId) ?? new Map();
    row.Country = [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "United Kingdom";
  }
  return rows;
}

function buildSolvedRetailRows(sourceRows, sourceColumns) {
  const seen = new Set();
  const solvedRows = [];
  for (const row of normalizeRetailRows(sourceRows)) {
    const key = retailRowKey(row, sourceColumns);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!cleanRetailDescription(row.Description)) continue;
    const [invoiceDate, invoiceTime] = String(row.InvoiceDate ?? "").trim().split(/\s+/);
    solvedRows.push({
      ...row,
      "Invoice Date": invoiceDate,
      "Invoice Time": invoiceTime,
      "Product Label": `${row.StockCode} | ${row.Description}`,
      "Line Total": String(Number(row.Quantity) * Number(row.Price)),
    });
  }
  return solvedRows;
}

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
