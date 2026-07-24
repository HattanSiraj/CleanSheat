import { evaluateFormula, parseFormula, parseFormulaNumber } from "./formulaEngine.js";

export function evaluateChallenge(challenge, context) {
  if (!challenge) return emptyEvaluation();
  const needsSourceRows = challenge.objectives.some((objective) => objective.kind === "groupMedianFill");
  const evaluationContext = {
    ...context,
    sourceRows: context.sourceRows ?? (needsSourceRows ? challenge.createRows?.() ?? [] : []),
  };
  const objectives = challenge.objectives.map((objective) => evaluateObjective(objective, evaluationContext));
  const rules = (challenge.rules ?? []).map((rule) => evaluateRule(rule, evaluationContext));
  const completedCount = objectives.filter((objective) => objective.complete).length;
  const score = objectives.length ? Math.round(completedCount * 100 / objectives.length) : 0;
  const objectivesComplete = completedCount === objectives.length;
  const rulesPassed = rules.every((rule) => rule.complete);
  const complete = objectivesComplete && rulesPassed;
  const stars = complete ? 3 : score >= 75 ? 2 : score >= 50 ? 1 : 0;
  return {
    score,
    stars,
    complete,
    completedCount,
    totalCount: objectives.length,
    objectives,
    rules,
    rulesPassed,
    moves: context.history?.length ?? 0,
  };
}

export function evaluateObjective(objective, context) {
  const rows = context.rows ?? [];
  const rules = context.columnRules ?? {};
  const columns = context.columns ?? Object.keys(rows[0] ?? {}).filter((column) => column !== "__rowId");
  let result = { complete: false, detail: "Not checked yet" };

  if (objective.kind === "types") {
    const entries = Object.entries(objective.expected);
    const matches = entries.filter(([column, type]) => rules[column]?.type === type).length;
    result = { complete: matches === entries.length, detail: `${matches}/${entries.length} column types set` };
  }

  if (objective.kind === "columnsPresent") {
    const expected = objective.expected ?? Object.fromEntries((objective.columns ?? []).map((column) => [column, null]));
    const entries = Object.entries(expected);
    const matches = entries.filter(([column, type]) => columns.includes(column) && (!type || rules[column]?.type === type)).length;
    result = {
      complete: matches === entries.length,
      detail: matches === entries.length ? "Required columns are ready" : `${matches}/${entries.length} required columns are ready`,
    };
  }

  if (objective.kind === "columnsAbsent") {
    const remaining = objective.columns.filter((column) => columns.includes(column));
    result = {
      complete: remaining.length === 0,
      detail: remaining.length ? `Delete ${remaining.join(", ")}` : "Unwanted columns are gone",
    };
  }

  if (objective.kind === "calculatedColumn") {
    result = evaluateCalculatedColumn(objective, { rows, rules, columns });
  }

  if (objective.kind === "noMissing") {
    const missing = rows.reduce((count, row) => count + objective.columns.filter((column) => isBlank(row[column])).length, 0);
    const removedRows = Math.max((objective.minimumRows ?? 0) - rows.length, 0);
    const detail = missing
      ? `${missing.toLocaleString()} gaps remain`
      : removedRows
        ? `${removedRows.toLocaleString()} required rows were removed`
        : "No gaps remain";
    result = { complete: missing === 0 && removedRows === 0, detail };
  }

  if (objective.kind === "allowedValues") {
    const allowed = new Set(objective.values);
    const invalid = rows.filter((row) => !allowed.has(String(row[objective.column] ?? ""))).length;
    result = { complete: invalid === 0, detail: invalid ? `${invalid.toLocaleString()} values still disagree` : "Values are consistent" };
  }

  if (objective.kind === "unique") {
    const seen = new Set();
    let duplicates = 0;
    for (const row of rows) {
      const key = objective.columns.map((column) => String(row[column] ?? "")).join("\u001f");
      if (seen.has(key)) duplicates += 1;
      seen.add(key);
    }
    result = {
      complete: duplicates === 0,
      detail: duplicates
        ? `${duplicates.toLocaleString()} duplicate rows remain, use Cleaning Tools then Duplicates`
        : "Rows are unique",
    };
  }

  if (objective.kind === "rowCount") {
    result = { complete: rows.length >= objective.minimum, detail: `${rows.length.toLocaleString()} / ${objective.minimum.toLocaleString()} rows kept` };
  }

  if (objective.kind === "formula") {
    let checked = 0;
    let failures = 0;
    for (const row of rows) {
      const left = toNumber(row[objective.left]);
      const right = toNumber(row[objective.right]);
      const target = toNumber(row[objective.target]);
      if (left === null || right === null || target === null) {
        failures += 1;
        continue;
      }
      checked += 1;
      const expected = calculate(left, right, objective.operator);
      if (!Number.isFinite(expected) || Math.abs(target - expected) > objective.tolerance) failures += 1;
    }
    result = { complete: rows.length > 0 && failures === 0, detail: failures ? `${failures.toLocaleString()} rows do not add up` : `${checked.toLocaleString()} rows add up` };
  }

  if (objective.kind === "scanClean") {
    const columns = new Set(objective.columns);
    const remaining = (context.scanIssues ?? []).filter((issue) => columns.has(issue.column)).length;
    const hasScanned = Boolean(context.lastScannedAt);
    const expectedTypes = objective.expectedTypes
      ?? (objective.expectedType ? Object.fromEntries(objective.columns.map((column) => [column, objective.expectedType])) : {});
    const wrongTypeColumns = Object.entries(expectedTypes).filter(([column, type]) => rules[column]?.type !== type);
    const typesReady = wrongTypeColumns.length === 0;
    const detail = !typesReady
      ? `Set ${wrongTypeColumns.map(([column, type]) => `${column} to ${type}`).join(", ")}`
      : hasScanned
        ? `${remaining.toLocaleString()} scanned issues remain`
        : "Run a scan";
    result = { complete: typesReady && hasScanned && remaining === 0, detail };
  }

  if (objective.kind === "missingPolicy") {
    const rule = rules[objective.column] ?? {};
    const expectedTokens = new Set((objective.tokens ?? []).map((token) => token.toLowerCase()));
    const actualTokens = new Set((rule.missingTokens ?? []).map((token) => String(token).toLowerCase()));
    const tokensMatch = [...expectedTokens].every((token) => actualTokens.has(token));
    result = {
      complete: rule.missingPolicy === objective.policy && tokensMatch,
      detail: rule.missingPolicy === objective.policy && tokensMatch ? "Missing-value rule is ready" : "Configure the missing-value rule",
    };
  }

  if (objective.kind === "method") {
    const used = (context.history ?? []).some((action) => {
      const step = action.recipeStep ?? action.audit ?? {};
      const columns = step.columns ?? (step.column ? [step.column] : []);
      return step.type === "fill"
        && step.method === objective.method
        && columns.includes(objective.column)
        && (!objective.groupBy || step.groupBy === objective.groupBy);
    });
    result = { complete: used, detail: used ? "Method appears in the cleaning history" : "Use the requested filling method" };
  }

  if (objective.kind === "groupMedianFill") {
    result = evaluateGroupMedianFill(objective, context);
  }

  return { ...objective, ...result };
}

function evaluateCalculatedColumn(objective, context) {
  if (!context.columns.includes(objective.target)) {
    return { complete: false, detail: `Create ${objective.target}` };
  }
  if (objective.expectedType && context.rules[objective.target]?.type !== objective.expectedType) {
    return { complete: false, detail: `Set ${objective.target} to ${objective.expectedType}` };
  }

  let parsed;
  try {
    parsed = parseFormula(objective.formula);
  } catch {
    return { complete: false, detail: "Challenge formula is invalid" };
  }
  const missingInputs = parsed.references.filter((column) => !context.columns.includes(column));
  if (missingInputs.length) {
    return { complete: false, detail: `Keep ${missingInputs.join(", ")}` };
  }

  let failures = 0;
  for (const row of context.rows) {
    const actual = parseFormulaNumber(row[objective.target]);
    let expected;
    try {
      expected = evaluateFormula(parsed.ast, row);
    } catch {
      failures += 1;
      continue;
    }
    if (actual === null || Math.abs(actual - expected) > (objective.tolerance ?? 0.01)) failures += 1;
  }
  return {
    complete: context.rows.length > 0 && failures === 0,
    detail: failures
      ? `${failures.toLocaleString()} rows do not match the calculation`
      : `${context.rows.length.toLocaleString()} rows calculated correctly`,
  };
}

export function evaluateRule(rule, context) {
  const rows = context.rows ?? [];
  let result = { complete: false, detail: "Not checked yet" };

  if (rule.kind === "rowCount") {
    const aboveMinimum = rule.minimum === undefined || rows.length >= rule.minimum;
    const belowMaximum = rule.maximum === undefined || rows.length <= rule.maximum;
    const exact = rule.minimum !== undefined && rule.minimum === rule.maximum;
    const target = exact
      ? `${rule.minimum.toLocaleString()} rows required`
      : `${(rule.minimum ?? 0).toLocaleString()} minimum${rule.maximum === undefined ? "" : ` and ${rule.maximum.toLocaleString()} maximum`}`;
    result = {
      complete: aboveMinimum && belowMaximum,
      detail: aboveMinimum && belowMaximum ? `${rows.length.toLocaleString()} rows kept` : `${rows.length.toLocaleString()} rows kept, ${target}`,
    };
  }

  if (rule.kind === "minimumMatches") {
    const matches = rows.filter((row) => matchesRuleValue(row[rule.column], rule)).length;
    result = {
      complete: matches >= rule.minimum,
      detail: `${matches.toLocaleString()} / ${rule.minimum.toLocaleString()} matching rows kept`,
    };
  }

  return { ...rule, ...result };
}

function emptyEvaluation() {
  return { score: 0, stars: 0, complete: false, completedCount: 0, totalCount: 0, objectives: [], rules: [], rulesPassed: true, moves: 0 };
}

function evaluateGroupMedianFill(objective, context) {
  const sourceRows = context.sourceRows ?? [];
  const currentRows = context.rows ?? [];
  const currentById = new Map(currentRows.map((row) => [String(row[objective.idColumn] ?? ""), row]));
  const valuesByGroup = new Map();
  const targetRows = [];

  for (const row of sourceRows) {
    const group = canonicalGroup(row[objective.groupBy], objective.groups);
    if (!group) continue;
    if (isBlank(row[objective.column])) {
      targetRows.push({ id: String(row[objective.idColumn] ?? ""), group });
      continue;
    }
    const value = toNumber(row[objective.column]);
    if (value === null) continue;
    const values = valuesByGroup.get(group) ?? [];
    values.push(value);
    valuesByGroup.set(group, values);
  }

  const medians = new Map([...valuesByGroup.entries()].map(([group, values]) => [group, median(values)]));
  let failures = 0;
  for (const target of targetRows) {
    const row = currentById.get(target.id);
    const actual = toNumber(row?.[objective.column]);
    const expected = medians.get(target.group);
    if (actual === null || !Number.isFinite(expected) || Math.abs(actual - expected) > (objective.tolerance ?? 0.01)) failures += 1;
  }

  return {
    complete: targetRows.length > 0 && failures === 0,
    detail: failures
      ? `${failures.toLocaleString()} recovered values do not match their Priority median`
      : `${targetRows.length.toLocaleString()} recovered values match their Priority median`,
  };
}

function canonicalGroup(value, groups = []) {
  const text = String(value ?? "").trim().toLocaleLowerCase();
  return groups.find((group) => group.toLocaleLowerCase() === text) ?? "";
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function matchesRuleValue(value, rule) {
  const actual = String(value ?? "").trim();
  const expected = String(rule.value ?? "").trim();
  const normalizedActual = rule.caseSensitive ? actual : actual.toLocaleLowerCase();
  const normalizedExpected = rule.caseSensitive ? expected : expected.toLocaleLowerCase();
  if (rule.operator === "startsWith") return normalizedActual.startsWith(normalizedExpected);
  return normalizedActual === normalizedExpected;
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function toNumber(value) {
  const number = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(number) && String(value ?? "").trim() !== "" ? number : null;
}

function calculate(left, right, operator) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "/") return right === 0 ? Number.NaN : left / right;
  return left * right;
}
