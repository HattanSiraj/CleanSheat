export const DEFAULT_MISSING_CONDITION = {
  column: "",
  operator: "equals",
  value: "",
};

export const DEFAULT_MISSING_RULE = {
  missingPolicy: "required",
  missingTokens: [],
  missingTokenCaseSensitive: false,
  missingCondition: DEFAULT_MISSING_CONDITION,
};

export function normalizeMissingRule(rule = {}) {
  return {
    ...rule,
    missingPolicy: ["required", "allowed", "conditional"].includes(rule.missingPolicy)
      ? rule.missingPolicy
      : DEFAULT_MISSING_RULE.missingPolicy,
    missingTokens: Array.isArray(rule.missingTokens)
      ? [...new Set(rule.missingTokens.map((token) => String(token).trim()).filter(Boolean))]
      : [],
    missingTokenCaseSensitive: rule.missingTokenCaseSensitive === true,
    missingCondition: {
      ...DEFAULT_MISSING_CONDITION,
      ...(rule.missingCondition ?? {}),
    },
  };
}

export function parseMissingTokens(value) {
  return [...new Set(String(value ?? "")
    .split(/[\n,]/)
    .map((token) => token.trim())
    .filter(Boolean))];
}

export function isMissingValue(value, rule = DEFAULT_MISSING_RULE) {
  const text = String(value ?? "").trim();
  if (!text) return true;
  const normalizedRule = normalizeMissingRule(rule);
  return normalizedRule.missingTokens.some((token) => normalizedRule.missingTokenCaseSensitive
    ? text === token
    : text.toLocaleLowerCase() === token.toLocaleLowerCase());
}

export function isValueRequired(row, rule = DEFAULT_MISSING_RULE) {
  const normalizedRule = normalizeMissingRule(rule);
  if (normalizedRule.missingPolicy === "required") return true;
  if (normalizedRule.missingPolicy === "allowed") return false;
  return evaluateMissingCondition(row, normalizedRule.missingCondition);
}

export function evaluateMissingCondition(row, condition = DEFAULT_MISSING_CONDITION) {
  const column = condition.column ?? "";
  if (!column) return true;
  const actual = String(row?.[column] ?? "").trim();
  const expected = String(condition.value ?? "").trim();
  if (condition.operator === "isEmpty") return actual === "";
  if (condition.operator === "isNotEmpty") return actual !== "";
  if (condition.operator === "notEquals") return actual.toLocaleLowerCase() !== expected.toLocaleLowerCase();
  return actual.toLocaleLowerCase() === expected.toLocaleLowerCase();
}

export function getMissingIssue(row, column, rule) {
  const value = row?.[column];
  if (!isMissingValue(value, rule) || !isValueRequired(row, rule)) return null;
  const normalizedRule = normalizeMissingRule(rule);
  const text = String(value ?? "").trim();
  if (normalizedRule.missingPolicy === "conditional") {
    const condition = normalizedRule.missingCondition;
    const comparison = condition.operator === "isEmpty"
      ? "is empty"
      : condition.operator === "isNotEmpty"
        ? "is not empty"
        : condition.operator === "notEquals"
          ? `is not ${condition.value}`
          : `is ${condition.value}`;
    return {
      value: text,
      reason: `Value is required when ${condition.column} ${comparison}`,
    };
  }
  return {
    value: text,
    reason: text ? `Value is missing (${text})` : "Required value is empty",
  };
}

export function isMissingRuleValid(rule, columns = [], currentColumn = "") {
  const normalizedRule = normalizeMissingRule(rule);
  if (normalizedRule.missingPolicy !== "conditional") return true;
  return Boolean(
    normalizedRule.missingCondition.column
    && normalizedRule.missingCondition.column !== currentColumn
    && columns.includes(normalizedRule.missingCondition.column),
  );
}
