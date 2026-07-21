import test from "node:test";
import assert from "node:assert/strict";
import Papa from "papaparse";
import { generateDatasetFromHell, HEADERS, toCsv } from "../scripts/generate_dataset_from_hell.mjs";

test("dataset from hell is repeatable when the seed matches", () => {
  assert.deepEqual(generateDatasetFromHell(250, 666), generateDatasetFromHell(250, 666));
});

test("dataset from hell contains broad, overlapping corruption", () => {
  const { rows, summary } = generateDatasetFromHell(1000, 666);
  const expectedChaos = [
    "repairable email formatting",
    "broken emails and phones",
    "impossible and vague dates",
    "numbers mixed with words",
    "conflicting calculations",
    "category drift",
    "inconsistent missing markers",
    "email and phone swapped",
    "country and city swapped",
    "mojibake text",
    "quoted multiline cells",
    "identifier format drift",
    "combined contact fields",
    "ambiguous dates",
    "meaningless manual rows",
    "exact duplicate exports",
    "near duplicate exports",
  ];

  assert.equal(rows.length, 1000);
  for (const issue of expectedChaos) assert.ok(summary[issue] > 0, `Missing generated chaos: ${issue}`);
});

test("dataset from hell remains a valid CSV despite quotes and newlines", () => {
  const { rows } = generateDatasetFromHell(250, 666);
  const parsed = Papa.parse(toCsv(rows), { header: true, skipEmptyLines: true });

  assert.deepEqual(parsed.meta.fields, HEADERS);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.length, rows.length);
  assert.equal(parsed.data[72].Notes, rows[72].Notes);
});
