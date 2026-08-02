import test from "node:test";
import assert from "node:assert/strict";
import {
  checkLookupRows,
  checkLookupRowsInChunks,
  getLookupStrengthLevel,
  normalizeLookupKey,
  rankLookupCandidates,
  recommendLookupDirection,
  sampleLookupRows,
  validateLookupRule,
} from "./lookupEngine.js";

const valid = (value) => String(value ?? "").trim() !== "BAD" && String(value ?? "").trim() !== "";
const missing = (value) => String(value ?? "").trim() === "";

test("learns unique mappings and leaves ambiguous values alone", () => {
  const rows = [
    { __rowId: "1", Code: "A", Name: "Apple" },
    { __rowId: "2", Code: "A", Name: "" },
    { __rowId: "3", Code: "B", Name: "Banana" },
    { __rowId: "4", Code: "B", Name: "Berry" },
    { __rowId: "5", Code: "B", Name: "BAD" },
    { __rowId: "6", Code: "C", Name: "" },
  ];
  const result = checkLookupRows(rows, { id: "r", sourceColumn: "Code", targetColumn: "Name" }, {
    sourceRule: { type: "Text" }, targetRule: { type: "Text" }, isMissing: missing, isValid: valid,
  });
  assert.deepEqual(result.counts, { safe: 1, ambiguous: 1, noEvidence: 1, invalidSource: 0 });
  assert.equal(result.issues[0].suggestedValue, "Apple");
  assert.equal(result.issues[0].currentValue, "");
  assert.equal(result.issues[0].id, "r:2:lookup:Name");
  assert.equal(result.issues[1].fixable, false);
  assert.equal(result.dependencyStrength, 66.7);
  assert.deepEqual(result.mappingPreview, [
    { sourceValue: "A", targetValue: "Apple", evidenceCount: 1 },
  ]);
});

test("numeric lookup keys treat equivalent number formats as equal", () => {
  assert.equal(normalizeLookupKey("2.00", "Number"), normalizeLookupKey("2", "Number"));
  assert.equal(normalizeLookupKey("1,200", "Number"), "number:1200");
});

test("validates the lookup shape", () => {
  assert.equal(validateLookupRule({ sourceColumn: "Code", targetColumn: "Name" }, ["Code", "Name"]).valid, true);
  assert.equal(validateLookupRule({ sourceColumn: "Code", targetColumn: "Code" }, ["Code"]).valid, false);
});

test("recommends both directions only when both mappings are clean", () => {
  const strong = { evidenceRowCount: 20, dependencyStrength: 100, mappingCount: 4 };
  const mixed = { evidenceRowCount: 20, dependencyStrength: 80, mappingCount: 3 };
  assert.equal(recommendLookupDirection(strong, strong), "both");
  assert.equal(recommendLookupDirection(mixed, strong), "reverse");
  assert.equal(recommendLookupDirection(strong, mixed), "forward");
  assert.equal(recommendLookupDirection(mixed, mixed), "none");
  assert.equal(getLookupStrengthLevel(strong), "strong");
  assert.equal(getLookupStrengthLevel(mixed), "mixed");
});

test("preview analysis can count repairs without storing every issue", () => {
  const result = checkLookupRows([
    { __rowId: "1", Code: "A", Name: "Apple" },
    { __rowId: "2", Code: "A", Name: "" },
  ], { id: "preview", sourceColumn: "Code", targetColumn: "Name" }, {
    sourceRule: { type: "Text" }, targetRule: { type: "Text" }, isMissing: missing, isValid: valid, collectIssues: false,
  });
  assert.equal(result.counts.safe, 1);
  assert.equal(result.mappingCount, 1);
  assert.equal(result.dependencyStrength, 100);
  assert.equal(getLookupStrengthLevel(result), "thin");
  assert.deepEqual(result.issues, []);
});

test("relation previews learn only from rows where both cells are valid", () => {
  const result = checkLookupRows([
    { __rowId: "1", Code: "A", Name: "Apple" },
    { __rowId: "2", Code: "BAD", Name: "Ghost" },
  ], { id: "preview", sourceColumn: "Code", targetColumn: "Name" }, {
    sourceRule: { type: "Text" }, targetRule: { type: "Text" }, isMissing: missing, isValid: valid, collectIssues: false,
  });
  assert.equal(result.mappingCount, 1);
  assert.equal(result.evidenceRowCount, 1);
});

test("dependency strength follows the dominant match for each source", () => {
  const rows = [
    { __rowId: "1", Code: "A", Name: "Apple" },
    { __rowId: "2", Code: "A", Name: "Apple" },
    { __rowId: "3", Code: "A", Name: "Apple" },
    { __rowId: "4", Code: "A", Name: "Apricot" },
    { __rowId: "5", Code: "B", Name: "Banana" },
    { __rowId: "6", Code: "B", Name: "Banana" },
  ];
  const result = checkLookupRows(rows, { id: "strength", sourceColumn: "Code", targetColumn: "Name" }, {
    sourceRule: { type: "Text" }, targetRule: { type: "Text" }, isMissing: missing, isValid: valid, collectIssues: false,
  });
  assert.equal(result.evidenceRowCount, 6);
  assert.equal(result.dependencyStrength, 83.3);
  assert.equal(getLookupStrengthLevel(result), "mixed");
});

test("samples large files from across the full row range", () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ index }));
  const sample = sampleLookupRows(rows, 5);
  assert.deepEqual(sample.map((row) => row.index), [0, 20, 40, 60, 80]);
  assert.equal(sampleLookupRows(rows, 100), rows);
});

test("ranks recommended candidates before noisy matches", () => {
  const result = (strength, safe, evidence = 10) => ({
    dependencyStrength: strength,
    evidenceRowCount: evidence,
    mappingCount: 2,
    counts: { safe },
  });
  const ranked = rankLookupCandidates([
    { column: "Noisy", recommendation: "none", forward: result(90, 20), reverse: result(90, 20) },
    { column: "Useful", recommendation: "forward", forward: result(100, 2), reverse: result(50, 0) },
    { column: "Quiet", recommendation: "forward", forward: result(100, 1), reverse: result(50, 0) },
  ]);
  assert.deepEqual(ranked.map((candidate) => candidate.column), ["Useful", "Quiet", "Noisy"]);
});

test("chunked lookup checks match the regular checker", async () => {
  const rows = [
    { __rowId: "1", Code: "A", Name: "Apple" },
    { __rowId: "2", Code: "A", Name: "" },
    { __rowId: "3", Code: "B", Name: "Banana" },
  ];
  const options = {
    sourceRule: { type: "Text" },
    targetRule: { type: "Text" },
    isMissing: missing,
    isValid: valid,
  };
  const rule = { id: "chunked", sourceColumn: "Code", targetColumn: "Name" };
  const expected = checkLookupRows(rows, rule, options);
  const actual = await checkLookupRowsInChunks(rows, rule, options, {
    rowLimit: 1,
    yieldControl: () => Promise.resolve(),
  });
  assert.deepEqual(actual, expected);
});

test("repair and mapping previews stay bounded while totals cover every row", () => {
  const rows = [
    { __rowId: "evidence", Code: "A", Name: "Apple" },
    ...Array.from({ length: 10 }, (_, index) => ({ __rowId: `missing-${index}`, Code: "A", Name: "" })),
  ];
  const result = checkLookupRows(rows, { id: "bounded", sourceColumn: "Code", targetColumn: "Name" }, {
    sourceRule: { type: "Text" },
    targetRule: { type: "Text" },
    isMissing: missing,
    isValid: valid,
    collectIssues: false,
    repairLimit: 2,
    mappingLimit: 1,
  });
  assert.equal(result.counts.safe, 10);
  assert.equal(result.repairPreview.length, 2);
  assert.equal(result.mappingCount, 1);
  assert.equal(result.mappingPreview.length, 1);
  assert.deepEqual(result.issues, []);
});
