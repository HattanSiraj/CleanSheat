import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDateConversionChanges,
  formatDateParts,
  isDate,
  parseDateParts,
} from "./dateConversion.js";

test("date conversion changes only source values and keeps target values alone", () => {
  const rows = [
    { __rowId: "one", Date: "2026-07-06" },
    { __rowId: "two", Date: "07/07/2026" },
    { __rowId: "three", Date: "" },
    { __rowId: "four", Date: "not a date" },
  ];

  const result = buildDateConversionChanges(rows, "Date", "date-eu", "date-iso-dash");

  assert.equal(result.valid, true);
  assert.equal(result.changeCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.emptyCount, 1);
  assert.deepEqual(result.changes, [
    {
      rowId: "two",
      column: "Date",
      before: "07/07/2026",
      after: "2026-07-07",
    },
  ]);
});

test("date conversion respects the chosen slash order", () => {
  const rows = [{ __rowId: "one", Date: "04/07/2026" }];

  const us = buildDateConversionChanges(rows, "Date", "date-us", "date-iso-dash");
  const eu = buildDateConversionChanges(rows, "Date", "date-eu", "date-iso-dash");

  assert.equal(us.changes[0].after, "2026-04-07");
  assert.equal(eu.changes[0].after, "2026-07-04");
});

test("date parsing rejects impossible dates and formatting pads date parts", () => {
  assert.equal(parseDateParts("31/02/2026", "date-eu"), null);
  assert.equal(isDate("2026-02-29"), false);
  assert.equal(isDate("2024-02-29"), true);
  assert.equal(formatDateParts({ year: 2026, month: 7, day: 4 }, "date-iso-slash"), "2026/07/04");
});
