import test from "node:test";
import assert from "node:assert/strict";
import {
  RECIPE_SCHEMA_VERSION,
  createRecipe,
  getRequiredColumns,
  moveRecipeStep,
  parseRecipeJson,
  serializeRecipe,
  validateRecipe,
} from "./recipeEngine.js";

test("recipes round-trip through JSON", () => {
  const recipe = createRecipe({ name: "Cleanup", columns: ["Name"], columnRules: {}, relationships: [], steps: [{ type: "textCleanup", columns: ["Name"] }] });
  const parsed = parseRecipeJson(serializeRecipe(recipe));
  assert.equal(parsed.valid, true);
  assert.equal(parsed.recipe.name, "Cleanup");
  assert.notEqual(parsed.recipe.id, recipe.id);
});

test("recipe imports reject malformed and unsupported data", () => {
  assert.equal(parseRecipeJson("not-json").valid, false);
  assert.equal(validateRecipe({ schemaVersion: RECIPE_SCHEMA_VERSION + 1 }).valid, false);
  assert.equal(validateRecipe({ schemaVersion: RECIPE_SCHEMA_VERSION, id: "x", name: "x", columnRules: {}, relationships: [], steps: [] }).valid, false);
});

test("required columns account for columns created by earlier steps", () => {
  const steps = [
    { type: "splitColumn", sourceColumn: "Name", outputColumns: ["First", "Last"] },
    { type: "textCleanup", columns: ["First", "Last"] },
    { type: "combineColumns", sourceColumns: ["First", "Missing"], outputColumn: "Display" },
  ];
  assert.deepEqual(getRequiredColumns(["Name"], steps), ["Name", "Missing"]);
});

test("required columns account for direct column creation and deletion", () => {
  const steps = [
    { type: "createColumn", column: "Calculated", initialMode: "empty" },
    { type: "textCleanup", columns: ["Calculated"] },
    { type: "deleteColumns", columns: ["Old"] },
  ];
  assert.deepEqual(getRequiredColumns(["Old"], steps), ["Old"]);
});

test("recipe steps can be reordered without mutation", () => {
  const steps = [{ type: "textCleanup" }, { type: "deduplicate" }];
  const moved = moveRecipeStep(steps, 1, -1);
  assert.deepEqual(moved.map((step) => step.type), ["deduplicate", "textCleanup"]);
  assert.deepEqual(steps.map((step) => step.type), ["textCleanup", "deduplicate"]);
});
