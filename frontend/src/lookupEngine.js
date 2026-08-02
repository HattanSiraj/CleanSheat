export function validateLookupRule(rule, columns) {
  if (!rule?.sourceColumn) return { valid: false, error: "Choose a source column" };
  if (!rule?.targetColumn) return { valid: false, error: "Choose a target column" };
  if (!columns.includes(rule.sourceColumn)) return { valid: false, error: `Source column ${rule.sourceColumn} is not in this file` };
  if (!columns.includes(rule.targetColumn)) return { valid: false, error: `Target column ${rule.targetColumn} is not in this file` };
  if (rule.sourceColumn === rule.targetColumn) return { valid: false, error: "Source and target must be different columns" };
  return { valid: true };
}

export function checkLookupRows(rows, rule, {
  sourceRule,
  targetRule,
  isMissing,
  isValid,
  collectIssues = true,
  issueLimit = Number.POSITIVE_INFINITY,
  mappingLimit = 25,
  repairLimit = 25,
} = {}) {
  const mappings = new Map();
  const sourceValues = new Map();
  let evidenceRowCount = 0;
  for (const row of rows) {
    const sourceValue = row[rule.sourceColumn];
    const sourceKey = normalizeLookupKey(sourceValue, sourceRule?.type);
    const targetValue = row[rule.targetColumn];
    if (
      sourceKey === null
      || !isValid?.(sourceValue, sourceRule, row)
      || isMissing?.(targetValue, targetRule, row)
      || !isValid?.(targetValue, targetRule, row)
    ) continue;
    const targetKey = normalizeTargetValue(targetValue, targetRule?.type);
    const values = mappings.get(sourceKey) ?? new Map();
    if (!sourceValues.has(sourceKey)) sourceValues.set(sourceKey, sourceValue);
    const existingTarget = values.get(targetKey);
    values.set(targetKey, {
      value: existingTarget?.value ?? targetValue,
      count: (existingTarget?.count ?? 0) + 1,
    });
    mappings.set(sourceKey, values);
    evidenceRowCount += 1;
  }

  const issues = [];
  const repairPreview = [];
  const counts = { safe: 0, ambiguous: 0, noEvidence: 0, invalidSource: 0 };
  rows.forEach((row, rowIndex) => {
    const targetValue = row[rule.targetColumn];
    const targetNeedsRepair = isMissing?.(targetValue, targetRule, row) || !isValid?.(targetValue, targetRule, row);
    if (!targetNeedsRepair) return;
    const sourceKey = normalizeLookupKey(row[rule.sourceColumn], sourceRule?.type);
    let status = "safe";
    let suggestedValue;
    let reason = "One verified value matches this source";
    if (sourceKey === null || !isValid?.(row[rule.sourceColumn], sourceRule, row)) {
      status = "invalidSource";
      reason = "Source value is empty or invalid";
    } else {
      const candidates = mappings.get(sourceKey);
      if (!candidates?.size) {
        status = "noEvidence";
        reason = "No verified target exists for this source";
      } else if (candidates.size > 1) {
        status = "ambiguous";
        reason = `${candidates.size} different targets use this source`;
      } else {
        suggestedValue = [...candidates.values()][0].value;
        if (!isValid?.(suggestedValue, targetRule, row)) {
          status = "noEvidence";
          suggestedValue = undefined;
          reason = "The learned target does not pass the target rule";
        }
      }
    }
    counts[status] += 1;
    const issue = {
        id: `${rule.id}:${row.__rowId}:lookup:${rule.targetColumn}`,
        ruleId: rule.id,
        rowId: row.__rowId,
        row: rowIndex + 1,
        sourceColumn: rule.sourceColumn,
        targetColumn: rule.targetColumn,
        sourceValue: row[rule.sourceColumn],
        currentValue: targetValue,
        suggestedValue,
        fixable: status === "safe",
        status,
        reason,
    };
    if (status === "safe" && repairPreview.length < repairLimit) repairPreview.push(issue);
    if (collectIssues && issues.length < issueLimit) issues.push(issue);
  });
  return summarizeLookup(mappings, sourceValues, evidenceRowCount, issues, counts, mappingLimit, repairPreview);
}

export async function checkLookupRowsInChunks(rows, rule, options = {}, {
  signal,
  onProgress,
  rowLimit = 5000,
  yieldControl = () => new Promise((resolve) => setTimeout(resolve, 0)),
} = {}) {
  const mappings = new Map();
  const sourceValues = new Map();
  let evidenceRowCount = 0;
  const {
    sourceRule,
    targetRule,
    isMissing,
    isValid,
    collectIssues = true,
    issueLimit = Number.POSITIVE_INFINITY,
    mappingLimit = 25,
    repairLimit = 25,
  } = options;

  await visitRowsInChunks(rows, (row) => {
    const sourceValue = row[rule.sourceColumn];
    const sourceKey = normalizeLookupKey(sourceValue, sourceRule?.type);
    const targetValue = row[rule.targetColumn];
    if (
      sourceKey === null
      || !isValid?.(sourceValue, sourceRule, row)
      || isMissing?.(targetValue, targetRule, row)
      || !isValid?.(targetValue, targetRule, row)
    ) return;
    const targetKey = normalizeTargetValue(targetValue, targetRule?.type);
    const values = mappings.get(sourceKey) ?? new Map();
    if (!sourceValues.has(sourceKey)) sourceValues.set(sourceKey, sourceValue);
    const existingTarget = values.get(targetKey);
    values.set(targetKey, {
      value: existingTarget?.value ?? targetValue,
      count: (existingTarget?.count ?? 0) + 1,
    });
    mappings.set(sourceKey, values);
    evidenceRowCount += 1;
  }, {
    signal,
    rowLimit,
    yieldControl,
    onProgress: (progress) => onProgress?.(progress / 2),
  });

  const issues = [];
  const repairPreview = [];
  const counts = { safe: 0, ambiguous: 0, noEvidence: 0, invalidSource: 0 };
  await visitRowsInChunks(rows, (row, rowIndex) => {
    const targetValue = row[rule.targetColumn];
    const targetNeedsRepair = isMissing?.(targetValue, targetRule, row) || !isValid?.(targetValue, targetRule, row);
    if (!targetNeedsRepair) return;
    const sourceKey = normalizeLookupKey(row[rule.sourceColumn], sourceRule?.type);
    let status = "safe";
    let suggestedValue;
    let reason = "One verified value matches this source";
    if (sourceKey === null || !isValid?.(row[rule.sourceColumn], sourceRule, row)) {
      status = "invalidSource";
      reason = "Source value is empty or invalid";
    } else {
      const candidates = mappings.get(sourceKey);
      if (!candidates?.size) {
        status = "noEvidence";
        reason = "No verified target exists for this source";
      } else if (candidates.size > 1) {
        status = "ambiguous";
        reason = `${candidates.size} different targets use this source`;
      } else {
        suggestedValue = [...candidates.values()][0].value;
        if (!isValid?.(suggestedValue, targetRule, row)) {
          status = "noEvidence";
          suggestedValue = undefined;
          reason = "The learned target does not pass the target rule";
        }
      }
    }
    counts[status] += 1;
    const issue = {
        id: `${rule.id}:${row.__rowId}:lookup:${rule.targetColumn}`,
        ruleId: rule.id,
        rowId: row.__rowId,
        row: rowIndex + 1,
        sourceColumn: rule.sourceColumn,
        targetColumn: rule.targetColumn,
        sourceValue: row[rule.sourceColumn],
        currentValue: targetValue,
        suggestedValue,
        fixable: status === "safe",
        status,
        reason,
    };
    if (status === "safe" && repairPreview.length < repairLimit) repairPreview.push(issue);
    if (collectIssues && issues.length < issueLimit) issues.push(issue);
  }, {
    signal,
    rowLimit,
    yieldControl,
    onProgress: (progress) => onProgress?.(0.5 + progress / 2),
  });

  return summarizeLookup(mappings, sourceValues, evidenceRowCount, issues, counts, mappingLimit, repairPreview);
}

export function sampleLookupRows(rows, limit = 50000) {
  if (rows.length <= limit) return rows;
  const sample = [];
  const step = rows.length / limit;
  for (let index = 0; index < limit; index += 1) {
    sample.push(rows[Math.floor(index * step)]);
  }
  return sample;
}

export function rankLookupCandidates(candidates) {
  return [...candidates].sort((left, right) => (
    Number(right.recommendation !== "none") - Number(left.recommendation !== "none")
    || getCandidateRepairCount(right) - getCandidateRepairCount(left)
    || getCandidateStrength(right) - getCandidateStrength(left)
    || getCandidateEvidence(right) - getCandidateEvidence(left)
    || left.column.localeCompare(right.column)
  ));
}

export function recommendLookupDirection(forward, reverse) {
  const forwardIsStrong = isStrongLookupDirection(forward);
  const reverseIsStrong = isStrongLookupDirection(reverse);
  if (forwardIsStrong && reverseIsStrong) return "both";
  if (forwardIsStrong) return "forward";
  if (reverseIsStrong) return "reverse";
  return "none";
}

export function getLookupStrengthLevel(result) {
  if (!result.evidenceRowCount || !result.mappingCount) return "none";
  if (result.evidenceRowCount < 3) return "thin";
  if (result.dependencyStrength >= 95) return "strong";
  if (result.dependencyStrength >= 60) return "mixed";
  return "weak";
}

export function normalizeLookupKey(value, type) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (["Number", "Integer"].includes(type)) {
    const numeric = Number(text.replaceAll(",", ""));
    return Number.isFinite(numeric) ? `number:${numeric}` : null;
  }
  return `${type === "Date" ? "date" : "text"}:${text}`;
}

function normalizeTargetValue(value, type) {
  const key = normalizeLookupKey(value, type);
  return key ?? `raw:${String(value ?? "")}`;
}

function summarizeLookup(mappings, sourceValues, evidenceRowCount, issues, counts, mappingLimit, repairPreview) {
  const mappingValues = [...mappings.values()];
  let dominantPairCount = 0;
  for (const values of mappingValues) {
    let dominantCount = 0;
    for (const target of values.values()) dominantCount = Math.max(dominantCount, target.count);
    dominantPairCount += dominantCount;
  }
  return {
    issues,
    counts,
    evidenceRowCount,
    dependencyStrength: evidenceRowCount
      ? Math.round((dominantPairCount / evidenceRowCount) * 1000) / 10
      : 0,
    mappingCount: mappingValues.filter((values) => values.size === 1).length,
    ambiguousMappingCount: mappingValues.filter((values) => values.size > 1).length,
    mappingPreview: buildMappingPreview(mappings, sourceValues, mappingLimit),
    repairPreview,
  };
}

function buildMappingPreview(mappings, sourceValues, limit) {
  if (limit <= 0) return [];
  const preview = [];
  for (const [sourceKey, targets] of mappings) {
    if (targets.size !== 1) continue;
    const target = [...targets.values()][0];
    preview.push({
      sourceValue: sourceValues.get(sourceKey),
      targetValue: target.value,
      evidenceCount: target.count,
    });
    if (preview.length >= limit) break;
  }
  return preview;
}

async function visitRowsInChunks(rows, visitRow, {
  signal,
  onProgress,
  rowLimit,
  yieldControl,
}) {
  for (let start = 0; start < rows.length; start += rowLimit) {
    throwIfAborted(signal);
    const end = Math.min(rows.length, start + rowLimit);
    for (let index = start; index < end; index += 1) visitRow(rows[index], index);
    onProgress?.(end / rows.length);
    if (end < rows.length) await yieldControl();
  }
  onProgress?.(1);
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  const error = new Error("Operation cancelled");
  error.name = "AbortError";
  throw error;
}

function getCandidateRepairCount(candidate) {
  if (candidate.recommendation === "both") return candidate.forward.counts.safe + candidate.reverse.counts.safe;
  if (candidate.recommendation === "reverse") return candidate.reverse.counts.safe;
  if (candidate.recommendation === "forward") return candidate.forward.counts.safe;
  return Math.max(candidate.forward.counts.safe, candidate.reverse.counts.safe);
}

function getCandidateStrength(candidate) {
  return Math.max(candidate.forward.dependencyStrength, candidate.reverse.dependencyStrength);
}

function getCandidateEvidence(candidate) {
  return Math.max(candidate.forward.evidenceRowCount, candidate.reverse.evidenceRowCount);
}

function isStrongLookupDirection(result) {
  return result.evidenceRowCount >= 3
    && result.mappingCount > 0
    && result.dependencyStrength >= 95;
}
