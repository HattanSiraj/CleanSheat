import { evaluateFormula, parseFormula, parseFormulaNumber } from "./formulaEngine.js";
import { cleanTextValue } from "./cleaningOperations.js";

export function evaluateChallenge(challenge, context) {
  if (!challenge) return emptyEvaluation();
  const needsSourceRows = challenge.objectives.some((objective) => (
    objective.kind === "groupMedianFill" || objective.kind === "fillContract"
  ));
  const evaluationContext = {
    ...context,
    sourceRows: context.sourceRows ?? (needsSourceRows ? challenge.createRows?.() ?? [] : []),
  };
  const objectives = challenge.objectives.map((objective) => evaluateObjective(objective, evaluationContext));
  const rules = (challenge.rules ?? []).map((rule) => evaluateRule(rule, evaluationContext));
  return summarizeChallenge(objectives, rules, context);
}

export async function evaluateChallengeInChunks(challenge, context, {
  signal,
  onProgress,
  yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
} = {}) {
  if (!challenge) return emptyEvaluation();
  const needsSourceRows = challenge.objectives.some((objective) => (
    objective.kind === "groupMedianFill" || objective.kind === "fillContract"
  ));
  const evaluationContext = {
    ...context,
    sourceRows: context.sourceRows ?? (needsSourceRows ? challenge.createRows?.() ?? [] : []),
  };
  const workCount = challenge.objectives.length + (challenge.rules?.length ?? 0);
  let completedWork = 0;
  const objectives = [];
  const rules = [];

  for (const objective of challenge.objectives) {
    throwIfAborted(signal);
    objectives.push(evaluateObjective(objective, evaluationContext));
    completedWork += 1;
    onProgress?.(workCount ? completedWork / workCount : 1);
    await yieldControl();
  }
  for (const rule of challenge.rules ?? []) {
    throwIfAborted(signal);
    rules.push(evaluateRule(rule, evaluationContext));
    completedWork += 1;
    onProgress?.(workCount ? completedWork / workCount : 1);
    await yieldControl();
  }

  return summarizeChallenge(objectives, rules, context);
}

function summarizeChallenge(objectives, rules, context) {
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

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Operation cancelled");
  error.name = "AbortError";
  throw error;
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

  if (objective.kind === "validationContract") {
    result = evaluateValidationContract(objective, {
      columns,
      rules,
      scanIssues: context.scanIssues ?? [],
      lastScannedAt: context.lastScannedAt,
    });
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

  if (objective.kind === "textNormalized") {
    result = evaluateTextNormalized(objective, rows);
  }

  if (objective.kind === "allowedValues") {
    const allowed = new Set(objective.values);
    const invalid = rows.filter((row) => {
      const value = String(row[objective.column] ?? "").trim();
      return !(objective.allowBlank && !value) && !allowed.has(value);
    }).length;
    const typeReady = !objective.expectedType || rules[objective.column]?.type === objective.expectedType;
    const configuredValues = new Set((rules[objective.column]?.allowedValues ?? []).map((value) => String(value).trim()));
    const configuredReady = !objective.requireConfiguredValues || (
      rules[objective.column]?.mode === "friendly"
      && rules[objective.column]?.friendlyKind === "allowedValues"
      && configuredValues.size === allowed.size
      && [...allowed].every((value) => configuredValues.has(value))
    );
    result = {
      complete: invalid === 0 && typeReady && configuredReady,
      detail: !typeReady
        ? `Set ${objective.column} to ${objective.expectedType}`
        : !configuredReady
          ? `Configure the ${objective.values.length.toLocaleString()} allowed values`
        : invalid
          ? `${invalid.toLocaleString()} values still disagree`
          : "Values are consistent",
    };
  }

  if (objective.kind === "patternMatch") {
    result = evaluatePatternMatch(objective, { rows, rules, columns });
  }

  if (objective.kind === "transformedColumns") {
    result = evaluateTransformedColumns(objective, { rows, columns });
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

  if (objective.kind === "fillContract") {
    result = evaluateFillContract(objective, context);
  }

  if (objective.kind === "groupConsistencyRecovery") {
    result = evaluateGroupConsistencyRecovery(objective, rows);
  }

  if (objective.kind === "exportSchema") {
    result = evaluateExportSchema(objective, {
      rows,
      columns,
      rules,
      scanIssues: context.scanIssues ?? [],
      lastScannedAt: context.lastScannedAt,
    });
  }

  return { ...objective, ...result };
}

function evaluateValidationContract(objective, context) {
  const checks = objective.checks ?? [];
  const issueColumns = new Set((context.scanIssues ?? []).map((issue) => issue.column));
  let ready = 0;
  let firstProblem = "";

  for (const check of checks) {
    const rule = context.rules[check.column] ?? {};
    let problem = "";
    if (!context.columns.includes(check.column)) problem = `Keep ${check.column}`;
    else if (check.type && rule.type !== check.type) problem = `Set ${check.column} to ${check.type}`;
    else if (check.mode && rule.mode !== check.mode) problem = `Configure ${check.column} with ${getModeLabel(check.mode)}`;
    else if (check.presetId && rule.presetId !== check.presetId) problem = `Choose the required ${check.column} format`;
    else if (check.matchMode && (rule.matchMode ?? "full") !== check.matchMode) problem = `Use full matching for ${check.column}`;
    else if (check.missingPolicy && rule.missingPolicy !== check.missingPolicy) problem = `Allow missing values in ${check.column}`;
    else if (check.mode === "customRegex" && !regexContractMatches(rule.customPattern, check)) problem = `${check.column} Regex is too loose or too strict`;
    else if (objective.requireScan !== false && !context.lastScannedAt) problem = "Run a scan";
    else if (objective.requireScan !== false && issueColumns.has(check.column)) problem = `${check.column} still has scanned issues`;

    if (problem) {
      if (!firstProblem) firstProblem = problem;
    } else {
      ready += 1;
    }
  }

  return {
    complete: checks.length > 0 && ready === checks.length,
    detail: ready === checks.length ? `${ready}/${checks.length} validation rules ready` : `${ready}/${checks.length} ready, ${firstProblem}`,
  };
}

function regexContractMatches(pattern, check) {
  let regex;
  try {
    regex = new RegExp(`^(?:${String(pattern ?? "").trim()})$`);
  } catch {
    return false;
  }
  return (check.validSamples ?? []).every((value) => regex.test(String(value)))
    && (check.invalidSamples ?? []).every((value) => !regex.test(String(value)));
}

function getModeLabel(mode) {
  if (mode === "customRegex") return "Custom Regex";
  if (mode === "friendly") return "Allowed Values";
  return mode;
}

function evaluateTextNormalized(objective, rows) {
  let remaining = 0;
  for (const row of rows) {
    const value = String(row[objective.column] ?? "");
    if (value !== cleanTextValue(value, objective)) remaining += 1;
  }
  return {
    complete: rows.length > 0 && remaining === 0,
    detail: remaining ? `${remaining.toLocaleString()} ${objective.column} values still need cleanup` : `${objective.column} is consistent`,
  };
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

function evaluatePatternMatch(objective, context) {
  if (!context.columns.includes(objective.column)) {
    return { complete: false, detail: `Keep ${objective.column}` };
  }
  if (objective.expectedType && context.rules[objective.column]?.type !== objective.expectedType) {
    return { complete: false, detail: `Set ${objective.column} to ${objective.expectedType}` };
  }
  let pattern;
  try {
    pattern = new RegExp(objective.pattern, objective.flags ?? "");
  } catch {
    return { complete: false, detail: "Challenge Regex is invalid" };
  }
  let invalid = 0;
  let blank = 0;
  for (const row of context.rows) {
    const value = String(row[objective.column] ?? "");
    if (!value.trim() && objective.allowBlank) {
      blank += 1;
      continue;
    }
    pattern.lastIndex = 0;
    if (!pattern.test(value)) invalid += 1;
  }
  const missingNeedsPermission = blank > 0
    && objective.requireAllowedMissingWhenBlank
    && context.rules[objective.column]?.missingPolicy !== "allowed";
  return {
    complete: context.rows.length > 0 && invalid === 0 && !missingNeedsPermission,
    detail: invalid
      ? `${invalid.toLocaleString()} values do not match`
      : missingNeedsPermission
        ? `Allow missing values in ${objective.column} or delete those rows`
        : blank
          ? `${blank.toLocaleString()} empty values are allowed`
          : "Every value matches",
  };
}

function evaluateTransformedColumns(objective, context) {
  const required = objective.operation === "split"
    ? [objective.source, ...(objective.outputs ?? [])]
    : [...(objective.sources ?? []), objective.target];
  const missing = required.filter((column) => !context.columns.includes(column));
  if (missing.length) return { complete: false, detail: `Create or keep ${missing.join(", ")}` };

  let failures = 0;
  for (const row of context.rows) {
    if (objective.operation === "split") {
      const expected = splitValue(row[objective.source], objective);
      if ((objective.outputs ?? []).some((column, index) => String(row[column] ?? "") !== expected[index])) failures += 1;
    } else {
      const values = (objective.sources ?? []).map((column) => String(row[column] ?? ""));
      const parts = objective.skipEmpty === false ? values : values.filter((value) => value.trim() !== "");
      const expected = parts.join(objective.separator ?? " ");
      if (String(row[objective.target] ?? "") !== expected) failures += 1;
    }
  }
  return {
    complete: context.rows.length > 0 && failures === 0,
    detail: failures ? `${failures.toLocaleString()} transformed rows disagree` : "Every transformed row matches",
  };
}

function splitValue(value, objective) {
  const text = String(value ?? "");
  const separator = objective.separator === "whitespace" ? /\s+/ : objective.separator ?? /\s+/;
  const parts = text.trim().split(separator);
  const outputCount = objective.outputs?.length ?? 0;
  if (parts.length > outputCount && outputCount > 0) {
    return [...parts.slice(0, outputCount - 1), parts.slice(outputCount - 1).join(objective.joinOverflowWith ?? " ")];
  }
  return Array.from({ length: outputCount }, (_, index) => parts[index] ?? "");
}

function evaluateGroupConsistencyRecovery(objective, rows) {
  const groups = new Map();
  let missing = 0;
  for (const row of rows) {
    const value = String(row[objective.column] ?? "").trim();
    if (!value) missing += 1;
    const group = String(row[objective.groupBy] ?? "").trim();
    if (!group || !matchesGroupSelector(group, objective.selector)) continue;
    const values = groups.get(group) ?? new Set();
    if (value) values.add(value);
    groups.set(group, values);
  }
  const inconsistent = [...groups.values()].filter((values) => values.size > 1).length;
  const enoughGroups = groups.size >= (objective.minimumGroups ?? 1);
  const detail = missing
    ? `${missing.toLocaleString()} ${objective.column} gaps remain`
    : inconsistent
      ? `${inconsistent.toLocaleString()} customer groups still disagree`
      : !enoughGroups
        ? "Too few customer groups remain"
        : `${groups.size.toLocaleString()} customer groups are consistent`;
  return { complete: rows.length > 0 && missing === 0 && inconsistent === 0 && enoughGroups, detail };
}

function matchesGroupSelector(value, selector = {}) {
  if (selector.numericModulo !== undefined) {
    const number = Number(value);
    if (!Number.isFinite(number) || number % selector.numericModulo !== (selector.remainder ?? 0)) return false;
  }
  return true;
}

function evaluateFillContract(objective, context) {
  const sourceRows = context.sourceRows ?? [];
  const rows = context.rows ?? [];
  const rules = context.columnRules ?? {};
  if (!sourceRows.length || !objective.idColumn || !objective.column) {
    return { complete: false, detail: "Challenge fill source is unavailable" };
  }
  if (objective.expectedType && rules[objective.column]?.type !== objective.expectedType) {
    return { complete: false, detail: `Set ${objective.column} to ${objective.expectedType}` };
  }

  const expected = buildFillContractValues(objective, sourceRows);
  const currentById = new Map(rows.map((row) => [String(row[objective.idColumn] ?? ""), row]));
  let failures = 0;
  for (const [id, expectedValue] of expected) {
    const row = currentById.get(id);
    if (!row || !fillContractValuesMatch(row[objective.column], expectedValue, objective.tolerance)) {
      failures += 1;
    }
  }

  return {
    complete: expected.size > 0 && failures === 0,
    detail: failures
      ? `${failures.toLocaleString()} ${objective.column} fills do not match`
      : `${expected.size.toLocaleString()} ${objective.method} fills match`,
  };
}

function buildFillContractValues(objective, sourceRows) {
  const targets = sourceRows.filter((row) => isBlank(row[objective.column]));
  const expected = new Map();
  if (!targets.length) return expected;

  if (objective.method === "distribution") {
    const validValues = sourceRows
      .map((row) => row[objective.column])
      .filter((value) => !isBlank(value));
    const allocations = buildDistributionValues(validValues, targets.length);
    targets.forEach((row, index) => {
      expected.set(String(row[objective.idColumn] ?? ""), allocations[index]);
    });
    return expected;
  }

  if (objective.method === "previous" || objective.method === "next") {
    for (const groupRows of groupFillRows(sourceRows, objective.groupBy).values()) {
      const sorted = [...groupRows].sort((left, right) => compareFillOrder(
        left[objective.orderBy],
        right[objective.orderBy],
      ));
      if (objective.orderDirection === "desc") sorted.reverse();
      const traversal = objective.method === "next" ? [...sorted].reverse() : sorted;
      let neighbor;
      for (const row of traversal) {
        const value = row[objective.column];
        if (!isBlank(value)) neighbor = value;
        else if (neighbor !== undefined) expected.set(String(row[objective.idColumn] ?? ""), neighbor);
      }
    }
    return expected;
  }

  const validByGroup = groupFillRows(
    sourceRows.filter((row) => !isBlank(row[objective.column])),
    objective.groupBy,
  );
  for (const row of targets) {
    const key = objective.groupBy ? String(row[objective.groupBy] ?? "").trim() : "__all__";
    const values = (validByGroup.get(key) ?? []).map((item) => item[objective.column]);
    const replacement = calculateFillStatistic(objective.method, values, objective.expectedType);
    if (replacement !== undefined) expected.set(String(row[objective.idColumn] ?? ""), replacement);
  }
  return expected;
}

function groupFillRows(rows, groupBy) {
  const groups = new Map();
  for (const row of rows) {
    const key = groupBy ? String(row[groupBy] ?? "").trim() : "__all__";
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }
  return groups;
}

function calculateFillStatistic(method, values, expectedType) {
  if (!values.length) return undefined;
  if (method === "mode") {
    const counts = new Map();
    let winner = values[0];
    let winnerCount = 0;
    for (const value of values) {
      const key = String(value).trim();
      const count = (counts.get(key)?.count ?? 0) + 1;
      if (!counts.has(key)) counts.set(key, { value, count });
      else counts.get(key).count = count;
      if (count > winnerCount) {
        winner = counts.get(key).value;
        winnerCount = count;
      }
    }
    return winner;
  }

  const numbers = values.map(toNumber).filter((value) => value !== null);
  if (!numbers.length) return undefined;
  const value = method === "median"
    ? median(numbers)
    : numbers.reduce((sum, number) => sum + number, 0) / numbers.length;
  return expectedType === "Integer" ? String(Math.round(value)) : value.toFixed(2);
}

function buildDistributionValues(values, targetCount) {
  if (!values.length) return [];
  const counts = new Map();
  values.forEach((value, index) => {
    const key = String(value).trim();
    if (!counts.has(key)) counts.set(key, { value, sourceCount: 0, order: index });
    counts.get(key).sourceCount += 1;
  });
  const allocations = [...counts.values()].map((item) => {
    const raw = targetCount * item.sourceCount / values.length;
    return { ...item, raw, count: Math.floor(raw) };
  });
  let remainder = targetCount - allocations.reduce((sum, item) => sum + item.count, 0);
  const ranked = [...allocations].sort((left, right) => (
    right.raw - Math.floor(right.raw) - (left.raw - Math.floor(left.raw))
    || right.sourceCount - left.sourceCount
    || left.order - right.order
  ));
  for (const allocation of ranked) {
    if (!remainder) break;
    allocation.count += 1;
    remainder -= 1;
  }
  return allocations.flatMap((allocation) => Array(allocation.count).fill(allocation.value));
}

function compareFillOrder(left, right) {
  const leftText = String(left ?? "").trim();
  const rightText = String(right ?? "").trim();
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  const leftDate = Date.parse(leftText);
  const rightDate = Date.parse(rightText);
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) return leftDate - rightDate;
  return leftText.localeCompare(rightText, undefined, { numeric: true });
}

function fillContractValuesMatch(actual, expected, tolerance = 0.01) {
  const actualNumber = toNumber(actual);
  const expectedNumber = toNumber(expected);
  if (actualNumber !== null && expectedNumber !== null) {
    return Math.abs(actualNumber - expectedNumber) <= tolerance;
  }
  return String(actual ?? "") === String(expected ?? "");
}

function evaluateExportSchema(objective, context) {
  const transforms = objective.transforms ?? [objective.split, objective.combine].filter(Boolean);
  const transformsReady = transforms.every((transform) => (
    evaluateTransformedColumns(transform, context).complete
  ));
  const checks = objective.checks ?? [];
  const rulesReady = !checks.length || evaluateValidationContract({
    checks,
    requireScan: objective.requireScan,
  }, context).complete;
  const expectedColumns = objective.expectedColumns ?? [];
  const orderReady = !expectedColumns.length || (
    expectedColumns.length === context.columns.length
    && expectedColumns.every((column, index) => context.columns[index] === column)
  );
  const removedColumns = objective.removedColumns ?? [];
  const removedReady = removedColumns.every((column) => !context.columns.includes(column));
  const checksToReport = [
    transforms.length ? transformsReady : null,
    checks.length ? rulesReady : null,
    expectedColumns.length ? orderReady : null,
    removedColumns.length ? removedReady : null,
  ].filter((value) => value !== null);
  const ready = checksToReport.filter(Boolean).length;
  const total = checksToReport.length;
  let problem = "";
  if (!transformsReady) problem = objective.transformHint ?? "finish the required split and combine operations";
  else if (!rulesReady) problem = objective.validationHint ?? "configure the derived column formats and scan";
  else if (!removedReady) problem = objective.removedHint ?? "remove the unwanted source columns";
  else if (!orderReady) problem = objective.orderHint ?? "move the columns into the final export order";
  return {
    complete: total > 0 && ready === total,
    detail: total > 0 && ready === total
      ? "Export columns and order are ready"
      : `${ready}/${total} export steps ready, ${problem}`,
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

  if (rule.kind === "guidedRowCleanup") {
    result = evaluateGuidedRowCleanup(rule, context.history ?? []);
  }

  return { ...rule, ...result };
}

function evaluateGuidedRowCleanup(rule, history) {
  const deletedRows = collectDeletedRows(history);
  const optionalValues = new Set((rule.optionalInvalidValues ?? []).map((value) => String(value).trim().toLocaleLowerCase()));
  let requiredDeleted = 0;
  let optionalDeleted = 0;
  let unrelatedDeleted = 0;

  for (const row of deletedRows) {
    const validRequiredValues = (rule.requiredColumns ?? [])
      .filter((column) => toNumber(row[column]) !== null)
      .length;
    const required = validRequiredValues < (rule.minimumValidRequiredValues ?? 1);
    const optionalValue = String(row[rule.optionalColumn] ?? "").trim().toLocaleLowerCase();
    const optional = optionalValues.has(optionalValue);
    if (required) requiredDeleted += 1;
    if (optional && !required) optionalDeleted += 1;
    if (!required && !optional) unrelatedDeleted += 1;
  }

  const requiredCount = rule.requiredDeletions ?? 0;
  const complete = requiredDeleted >= requiredCount && unrelatedDeleted === 0;
  const detail = unrelatedDeleted
    ? `${unrelatedDeleted.toLocaleString()} unrelated row${unrelatedDeleted === 1 ? "" : "s"} were deleted`
    : requiredDeleted < requiredCount
      ? `${requiredDeleted.toLocaleString()} / ${requiredCount.toLocaleString()} unrecoverable number rows removed`
      : optionalDeleted
        ? `${requiredDeleted.toLocaleString()} number rows and ${optionalDeleted.toLocaleString()} empty date rows removed`
        : `${requiredDeleted.toLocaleString()} unrecoverable number rows removed`;
  return { complete, detail };
}

function collectDeletedRows(history) {
  const deletedById = new Map();
  const visit = (action) => {
    if (action?.kind === "compound") {
      (action.actions ?? []).forEach(visit);
      return;
    }
    if (action?.kind !== "deleteRows") return;
    for (const item of action.rows ?? []) {
      const row = item?.row ?? item;
      if (!row) continue;
      const id = row.__rowId ?? `deleted-${deletedById.size}`;
      deletedById.set(id, row);
    }
  };
  history.forEach(visit);
  return [...deletedById.values()];
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

  for (const [index, row] of sourceRows.entries()) {
    const group = canonicalGroup(row[objective.groupBy], objective.groups);
    if (!group) continue;
    if (isBlank(row[objective.column])) {
      targetRows.push({ id: String(row[objective.idColumn] ?? ""), group, index });
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
    // The player may repair the ID column before filling the median values.
    const row = currentById.get(target.id) ?? currentRows[target.index];
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
