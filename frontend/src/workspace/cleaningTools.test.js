import assert from "node:assert/strict";
import test from "node:test";
import { CLEANING_TOOLS, getCleaningTool } from "./cleaningTools.js";

test("cleaning tool registry has unique IDs and complete labels", () => {
  const ids = CLEANING_TOOLS.map((tool) => tool.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(CLEANING_TOOLS.every((tool) => tool.title && tool.cardDescription && tool.description));
  assert.equal(CLEANING_TOOLS[0].id, "fillIssues");
  assert.equal(getCleaningTool("missingValues").title, "Missing Rules");
  assert.equal(getCleaningTool("recipes").title, "Cleaning Recipes");
});
