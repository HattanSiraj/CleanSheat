export const RECIPE_SCHEMA_VERSION = 1;
export const RECIPE_STORAGE_KEY = "cleansheet.cleaning-recipes";

const STEP_TYPES = new Set([
  "findReplace",
  "fill",
  "numericConversion",
  "relationshipFix",
  "deleteInvalidRows",
  "deduplicate",
  "textCleanup",
  "createColumn",
  "deleteColumns",
  "splitColumn",
  "combineColumns",
]);

export function createRecipe({ name, columnRules, regexRules = [], relationships, steps, columns }) {
  const recipe = {
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name: String(name ?? "").trim(),
    createdAt: new Date().toISOString(),
    requiredColumns: getRequiredColumns(columns, steps, relationships),
    columnRules: cloneJson(columnRules ?? {}),
    regexRules: cloneJson(regexRules),
    relationships: cloneJson(relationships ?? []),
    steps: cloneJson(steps ?? []),
  };
  const validation = validateRecipe(recipe);
  if (!validation.valid) throw new Error(validation.error);
  return recipe;
}

export function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== "object" || Array.isArray(recipe)) return invalid("Recipe JSON must contain an object.");
  if (recipe.schemaVersion !== RECIPE_SCHEMA_VERSION) return invalid(`Unsupported recipe version: ${recipe.schemaVersion ?? "missing"}.`);
  if (!String(recipe.id ?? "").trim()) return invalid("Recipe ID is missing.");
  if (!String(recipe.name ?? "").trim()) return invalid("Recipe name is missing.");
  if (!recipe.columnRules || typeof recipe.columnRules !== "object" || Array.isArray(recipe.columnRules)) return invalid("Recipe column rules are invalid.");
  if (!Array.isArray(recipe.requiredColumns) || !Array.isArray(recipe.regexRules) || !Array.isArray(recipe.relationships) || !Array.isArray(recipe.steps)) return invalid("Recipe lists are invalid.");
  const unsupported = recipe.steps.find((step) => !step || !STEP_TYPES.has(step.type));
  if (unsupported) return invalid(`Unsupported recipe step: ${unsupported?.type ?? "missing"}.`);
  return { valid: true };
}

export function parseRecipeJson(text, existingRecipes = []) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalid("This file does not contain valid JSON.");
  }
  const validation = validateRecipe(parsed);
  if (!validation.valid) return validation;
  const existingNames = new Set(existingRecipes.map((recipe) => recipe.name));
  const baseName = String(parsed.name).trim();
  let name = baseName;
  let suffix = 2;
  while (existingNames.has(name)) {
    name = `${baseName} (${suffix})`;
    suffix += 1;
  }
  return {
    valid: true,
    recipe: {
      ...cloneJson(parsed),
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    },
  };
}

export function readRecipes(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(RECIPE_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((recipe) => validateRecipe(recipe).valid) : [];
  } catch {
    return [];
  }
}

export function serializeRecipe(recipe) {
  const validation = validateRecipe(recipe);
  if (!validation.valid) throw new Error(validation.error);
  return JSON.stringify(recipe, null, 2);
}

export function getRequiredColumns(initialColumns, steps, relationships = []) {
  const available = new Set();
  const required = new Set();
  const relationshipById = new Map(relationships.map((rule) => [rule.id, rule]));
  for (const step of steps ?? []) {
    const inputs = getStepInputs(step, relationshipById);
    for (const input of inputs) {
      if (!available.has(input)) {
        required.add(input);
        available.add(input);
      }
    }
    if (step.type === "splitColumn") {
      if (step.removeSources) available.delete(step.sourceColumn);
      for (const output of step.outputColumns ?? []) available.add(output);
    }
    if (step.type === "combineColumns") {
      if (step.removeSources) for (const source of step.sourceColumns ?? []) available.delete(source);
      if (step.outputColumn) available.add(step.outputColumn);
    }
    if (step.type === "createColumn" && step.column) available.add(step.column);
    if (step.type === "deleteColumns") {
      for (const column of step.columns ?? []) available.delete(column);
    }
  }
  return [...required];
}

export function getStepInputs(step, relationshipById = new Map()) {
  if (["findReplace", "fill", "textCleanup", "deduplicate", "deleteInvalidRows"].includes(step.type)) return step.columns ?? [];
  if (step.type === "numericConversion") return [step.column].filter(Boolean);
  if (step.type === "splitColumn") return [step.sourceColumn].filter(Boolean);
  if (step.type === "combineColumns") return step.sourceColumns ?? [];
  if (step.type === "createColumn") return [];
  if (step.type === "deleteColumns") return step.columns ?? [];
  if (step.type === "relationshipFix") {
    const inputs = [];
    for (const id of step.relationshipIds ?? []) {
      const relationship = relationshipById.get(id);
      if (!relationship) continue;
      inputs.push(relationship.targetColumn, ...(relationship.references ?? extractFormulaReferences(relationship.formula)));
    }
    return [...new Set(inputs.filter(Boolean))];
  }
  return [];
}

export function moveRecipeStep(steps, index, direction) {
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || index >= steps.length || nextIndex >= steps.length) return steps;
  const next = [...steps];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function getRecipeStepLabel(step) {
  const labels = {
    findReplace: "Find & Replace",
    fill: "Fill invalid values",
    numericConversion: "Convert numeric column",
    relationshipFix: "Apply relationship fixes",
    deleteInvalidRows: "Delete rows with issues",
    deduplicate: "Remove duplicates",
    textCleanup: "Clean text",
    createColumn: "Create column",
    deleteColumns: "Delete columns",
    splitColumn: "Split column",
    combineColumns: "Combine columns",
  };
  return labels[step.type] ?? step.type;
}

function extractFormulaReferences(formula) {
  return [...String(formula ?? "").matchAll(/\[([^\]]+)\]/g)].map((match) => match[1].trim()).filter(Boolean);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function invalid(error) {
  return { valid: false, error };
}
