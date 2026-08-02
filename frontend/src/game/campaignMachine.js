import { BOOT_CHALLENGE_IDS, isBootComplete } from "./progress.js";

const BOOT_WORKSPACE_IDS = BOOT_CHALLENGE_IDS.map((challengeId) => `challenge:${challengeId}`);
export const BOOT_WORKSPACE_ID = BOOT_WORKSPACE_IDS[0];
export const FREE_CLEAN_PREVIEW = [
  "Bring any CSV into the full cleaning workspace without scores, objectives or challenge rules",
  "Nothing is graded and every tool is available so you can experiment or clean a real file",
];

export function getBootMachineState(progress, savedWorkspaceIds = [], sessionInserted = false, sessionEjected = false) {
  const complete = isBootComplete(progress);
  const saved = BOOT_WORKSPACE_IDS.some((workspaceId) => savedWorkspaceIds.includes(workspaceId));
  const phase = sessionEjected
    ? "waiting"
    : complete
      ? "online"
      : saved
        ? "incomplete"
        : sessionInserted
          ? "ready"
          : "waiting";
  return {
    complete,
    saved,
    diskInserted: phase !== "waiting",
    phase,
  };
}

export function getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds = [], pack = "core") {
  const tutorials = getTutorialChallenges(challenges);
  const tutorial = getNextTutorialChallenge(challenges, progress);
  if (!isBootComplete(progress)) {
    const savedIncomplete = tutorials.find((challenge) => (
      isTutorialChallengeUnlocked(challenge, challenges, progress)
      && savedWorkspaceIds.includes(`challenge:${challenge.id}`)
      && !progress.records?.[challenge.id]?.complete
    ));
    return savedIncomplete?.id ?? tutorial?.id ?? tutorials[0]?.id ?? challenges[0]?.id ?? "";
  }

  const missions = getPackChallenges(challenges, pack);
  const savedIncomplete = missions.find((challenge) => (
    savedWorkspaceIds.includes(`challenge:${challenge.id}`)
    && !progress.records[challenge.id]?.complete
  ));
  if (savedIncomplete) return savedIncomplete.id;
  return missions.find((challenge) => !progress.records[challenge.id]?.complete)?.id
    ?? missions[0]?.id
    ?? tutorial?.id
    ?? "";
}

export function getTutorialChallenges(challenges) {
  return challenges
    .filter((challenge) => challenge.tutorial)
    .sort((left, right) => (left.tutorialStage ?? 0) - (right.tutorialStage ?? 0));
}

export function getNextTutorialChallenge(challenges, progress) {
  const tutorials = getTutorialChallenges(challenges);
  return tutorials.find((challenge) => !progress.records?.[challenge.id]?.complete)
    ?? tutorials.at(-1)
    ?? null;
}

export function isTutorialChallengeUnlocked(challenge, challenges, progress) {
  if (!challenge?.tutorial) return true;
  const tutorials = getTutorialChallenges(challenges);
  const challengeIndex = tutorials.findIndex((item) => item.id === challenge.id);
  if (challengeIndex <= 0) return true;
  return tutorials.slice(0, challengeIndex).every((item) => progress.records?.[item.id]?.complete);
}

export function getPackChallenges(challenges, pack = "core") {
  return challenges
    .filter((challenge) => !challenge.tutorial && (challenge.pack ?? "core") === pack)
    .sort((left, right) => (
      (left.packOrder ?? left.number) - (right.packOrder ?? right.number)
    ));
}

export function isCoreCampaignComplete(challenges, progress) {
  const missions = getPackChallenges(challenges, "core");
  return missions.length > 0 && missions.every((challenge) => progress.records?.[challenge.id]?.complete);
}

export function isHellCampaignComplete(challenges, progress) {
  const missions = getPackChallenges(challenges, "hell");
  return missions.length > 0 && missions.every((challenge) => progress.records?.[challenge.id]?.complete);
}

export function getChallengeModuleState(challenge, progress, savedWorkspaceIds, bootComplete) {
  const record = progress.records[challenge.id];
  const saved = savedWorkspaceIds.includes(`challenge:${challenge.id}`);
  const locked = !challenge.tutorial && !bootComplete;
  const status = locked
    ? "NO POWER"
    : record?.complete
      ? `GRADE ${record.grade ?? "C"}`
      : saved
        ? "IN PROGRESS"
        : "UNPLAYED";
  return { locked, saved, record, status };
}

export function buildOrthogonalCablePath(source, target, trunkX) {
  const startX = roundCoordinate(source?.x);
  const startY = roundCoordinate(source?.y);
  const endX = roundCoordinate(target?.x);
  const endY = roundCoordinate(target?.y);
  const bendX = roundCoordinate(trunkX ?? startX + (endX - startX) * 0.45);
  return `M ${startX} ${startY} H ${bendX} V ${endY} H ${endX}`;
}

function roundCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0;
}
