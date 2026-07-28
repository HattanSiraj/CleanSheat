import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGES } from "./challengeData.js";
import { buildDataHealthMap, getHealthCellLabel } from "./game/dataHealth.js";
import {
  OFFICE_CHAT_POSITION_KEY,
  clampOfficePosition,
  getOfficeMessage,
  readOfficePosition,
  writeOfficePosition,
} from "./game/officeMessages.js";

test("data health maps stay bounded for huge datasets", () => {
  const columns = Array.from({ length: 120 }, (_, index) => `Column ${index + 1}`);
  const map = buildDataHealthMap({
    rowCount: 1_000_000,
    columns,
    issues: [{ row: 1_000_000, column: "Column 120", rowId: "last" }],
  });

  assert.equal(map.rowBandCount, 20);
  assert.equal(map.columnBandCount, 40);
  assert.equal(map.cells.length, 800);
  assert.equal(map.cells.at(-1).issueCount, 1);
  assert.equal(map.cells.at(-1).firstIssue.rowId, "last");
});

test("data health maps group real row and column ranges", () => {
  const columns = ["Name", "Email", "Phone"];
  const map = buildDataHealthMap({
    rowCount: 100,
    columns,
    issues: [
      { row: 1, column: "Name", rowId: "top" },
      { row: 100, column: "Phone", rowId: "bottom" },
      { row: 101, column: "Phone", rowId: "outside" },
      { row: 5, column: "Hidden", rowId: "hidden" },
    ],
    maxRowBands: 2,
    maxColumnBands: 2,
  });

  assert.equal(map.cells[0].issueCount, 1);
  assert.equal(map.cells[3].issueCount, 1);
  assert.equal(map.cells.reduce((total, cell) => total + cell.issueCount, 0), 2);
  assert.match(getHealthCellLabel(map.cells[3], columns), /Rows 51 to 100/);
  assert.match(getHealthCellLabel(map.cells[3], columns), /Email to Phone/);
});

test("office messages rotate and insert scan details", () => {
  const office = {
    sender: "Mona",
    department: "IT desk",
    trouble: ["Found {{issues}} problems", "Still found {{issues}} problems"],
  };

  assert.deepEqual(getOfficeMessage(office, "trouble", 0, { issues: 12 }), {
    sender: "Mona",
    department: "IT desk",
    text: "Found 12 problems",
    kind: "trouble",
  });
  assert.equal(getOfficeMessage(office, "trouble", 3, { issues: 4 }).text, "Still found 4 problems");
  assert.equal(getOfficeMessage(office, "win", 0), null);
});

test("office chat positions stay inside the current window", () => {
  assert.deepEqual(
    clampOfficePosition(
      { right: -40, top: 900 },
      { width: 350, height: 240 },
      { width: 1000, height: 700 },
    ),
    { right: 8, top: 452 },
  );
  assert.deepEqual(
    clampOfficePosition(
      { right: 900, top: -20 },
      { width: 350, height: 240 },
      { width: 1000, height: 700 },
    ),
    { right: 642, top: 8 },
  );
});

test("office chat positions survive a refresh", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  writeOfficePosition({ right: 120, top: 180 }, storage);
  assert.equal(values.has(OFFICE_CHAT_POSITION_KEY), true);
  assert.deepEqual(readOfficePosition(storage), { right: 120, top: 180 });
  values.set(OFFICE_CHAT_POSITION_KEY, "{\"right\":\"lost\",\"top\":2}");
  assert.equal(readOfficePosition(storage), null);
});

test("every campaign challenge has a complete office chat set", () => {
  for (const challenge of CHALLENGES) {
    assert.ok(challenge.office?.sender, `${challenge.id} needs an office sender`);
    for (const kind of ["start", "trouble", "progress", "cleanScan", "win"]) {
      assert.ok(getOfficeMessage(challenge.office, kind, 0, { issues: 5, issueLabel: "5 issues", objective: "Test objective" }), `${challenge.id} needs ${kind}`);
    }
  }
});

test("every challenge has two hover lines separate from its story", () => {
  for (const challenge of CHALLENGES) {
    assert.equal(challenge.preview?.length, 2, `${challenge.id} needs two hover lines`);
    for (const line of challenge.preview) {
      assert.ok(line.trim(), `${challenge.id} has an empty hover line`);
      assert.equal(challenge.story.includes(line), false, `${challenge.id} repeats its story in the hover preview`);
    }
  }
});
