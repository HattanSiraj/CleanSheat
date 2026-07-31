export const ACHIEVEMENTS = [
  { id: "first-boot", name: "First Boot", description: "Complete Boot Sequence" },
  { id: "first-cleanup", name: "First Cleanup", description: "Complete a main challenge" },
  { id: "one-scan-wonder", name: "One Scan Wonder", description: "Complete three objectives in one scan" },
  { id: "regex-wizard", name: "Regex Wizard", description: "Complete a pattern objective using Custom Regex" },
  { id: "formula-goblin", name: "Formula Goblin", description: "Complete three calculated columns in one challenge" },
  { id: "row-guardian", name: "Row Guardian", description: "Complete a challenge without deleting rows" },
  { id: "dataset-exorcist", name: "Dataset Exorcist", description: "Complete Dataset From Hell" },
  { id: "final-export", name: "Final Export", description: "Complete The Final Export" },
  { id: "hell-survivor", name: "Still Here", description: "Contain all six files on HELL_DISK", secret: true },
  { id: "s-rank", name: "S Rank", description: "Earn an S grade" },
  { id: "undo-addict", name: "Undo Addict", description: "Undo ten times in one run", secret: true },
  { id: "bulk-cleaner", name: "Bulk Cleaner", description: "Change one thousand cells in one action", secret: true },
  { id: "clipbit-pester", name: "Personal Space", description: "Bother Clipbit twenty five times", secret: true },
];

export function findNewAchievements(progress, context) {
  const unlocked = new Set(Object.keys(progress.achievements ?? {}));
  const earned = ACHIEVEMENTS.filter((achievement) => (
    !unlocked.has(achievement.id) && isEarned(achievement.id, context, progress)
  ));
  if (!earned.length) return { progress, earned };
  const unlockedAt = new Date().toISOString();
  return {
    earned,
    progress: {
      ...progress,
      achievements: {
        ...progress.achievements,
        ...Object.fromEntries(earned.map((achievement) => [achievement.id, { unlockedAt }])),
      },
    },
  };
}

function isEarned(id, context, progress) {
  const { challenge, evaluation, runStats, score, columnRules = {} } = context;
  const complete = Boolean(evaluation?.complete);
  const objectiveResults = new Map((evaluation?.objectives ?? []).map((objective) => [objective.id, objective]));
  if (id === "first-boot") return complete && challenge?.id === "boot-sequence";
  if (id === "first-cleanup") return complete && challenge?.id !== "boot-sequence";
  if (id === "one-scan-wonder") return runStats.maxCombo >= 3;
  if (id === "regex-wizard") {
    const regexObjectives = (challenge?.objectives ?? []).filter((objective) => objective.kind === "patternMatch");
    return regexObjectives.some((objective) => (
      objectiveResults.get(objective.id)?.complete
      && columnRules[objective.column]?.mode === "customRegex"
    ));
  }
  if (id === "formula-goblin") {
    return (challenge?.objectives ?? []).filter((objective) => (
      objective.kind === "calculatedColumn" && objectiveResults.get(objective.id)?.complete
    )).length >= 3;
  }
  if (id === "row-guardian") return complete && runStats.deletedRows === 0;
  if (id === "dataset-exorcist") return complete && challenge?.id === "dataset-from-hell";
  if (id === "final-export") return complete && challenge?.id === "final-final-export";
  if (id === "hell-survivor") {
    return complete
      && challenge?.pack === "hell"
      && Object.entries(progress.records ?? {}).filter(([challengeId, record]) => (
        challengeId.startsWith("hell-") && record?.complete
      )).length >= 6;
  }
  if (id === "s-rank") return complete && score.grade === "S";
  if (id === "undo-addict") return runStats.undoCount >= 10;
  if (id === "bulk-cleaner") return runStats.largestChange >= 1000;
  if (id === "clipbit-pester") return runStats.clipbitClicks >= 25;
  return false;
}
