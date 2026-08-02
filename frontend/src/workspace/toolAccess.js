import { CLEANING_TOOLS } from "./cleaningTools.js";

const OBJECTIVE_TOOL_RULES = {
  fillIssues: new Set(["scanClean", "patternMatch", "allowedValues", "noMissing", "groupMedianFill"]),
  findReplace: new Set(["patternMatch", "scanClean"]),
  missingValues: new Set(["missingPolicy", "noMissing", "groupMedianFill"]),
  duplicates: new Set(["unique"]),
  textCleanup: new Set(["allowedValues", "textNormalized"]),
  manageColumns: new Set(["calculatedColumn", "transformedColumns", "columnsAbsent", "columnsPresent", "exportSchema"]),
  dataBin: new Set(["guidedRowCleanup", "rowsInBin"]),
};

export function getChallengeCleaningTools(challenge) {
  const configuredTools = challenge?.toolAccess?.cleaningTools;
  if (Array.isArray(configuredTools)) {
    return CLEANING_TOOLS
      .map((tool) => tool.id)
      .filter((toolId) => configuredTools.includes(toolId));
  }

  const objectiveKinds = new Set([
    ...(challenge?.objectives ?? []),
    ...(challenge?.rules ?? []),
  ].map((objective) => objective.kind));

  return CLEANING_TOOLS
    .filter((tool) => OBJECTIVE_TOOL_RULES[tool.id]?.size)
    .filter((tool) => (
      [...OBJECTIVE_TOOL_RULES[tool.id]].some((kind) => objectiveKinds.has(kind))
      || (tool.id === "missingValues" && challengeUsesMissingRules(challenge))
    ))
    .map((tool) => tool.id);
}

export function getCleaningToolAccess({
  activeChallenge = null,
  challenges = [],
  progress = {},
  freeClean = false,
} = {}) {
  const allToolIds = CLEANING_TOOLS.map((tool) => tool.id);
  if (freeClean || !activeChallenge) {
    return {
      activeIds: [],
      earnedIds: [...allToolIds],
      lockedIds: [],
      unlockedIds: [...allToolIds],
    };
  }

  const activeIds = getChallengeCleaningTools(activeChallenge);
  const earnedIds = uniqueToolIds(challenges.flatMap((challenge) => (
    isCurrentCompletedRecord(progress.records?.[challenge.id], challenge)
      ? getChallengeCleaningTools(challenge)
      : []
  )));
  const unlockedIds = uniqueToolIds([...activeIds, ...earnedIds]);

  return {
    activeIds,
    earnedIds,
    lockedIds: allToolIds.filter((toolId) => !unlockedIds.includes(toolId)),
    unlockedIds,
  };
}

export function isCleaningToolUnlocked(access, toolId) {
  return toolId === "home" || access.unlockedIds.includes(toolId);
}

function challengeUsesMissingRules(challenge) {
  return (challenge?.objectives ?? []).some((objective) => (
    objective.allowBlank
    || objective.requireAllowedMissingWhenBlank
    || objective.kind === "missingPolicy"
  ));
}

function uniqueToolIds(toolIds) {
  const allowedToolIds = new Set(CLEANING_TOOLS.map((tool) => tool.id));
  return [...new Set(toolIds)].filter((toolId) => allowedToolIds.has(toolId));
}

function isCurrentCompletedRecord(record, challenge) {
  return Boolean(
    record?.complete
    && (challenge.revision === undefined || record.revision === challenge.revision),
  );
}
