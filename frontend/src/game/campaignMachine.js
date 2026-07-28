import { isBootComplete } from "./progress.js";

export const BOOT_CHALLENGE_ID = "boot-sequence";
export const BOOT_WORKSPACE_ID = `challenge:${BOOT_CHALLENGE_ID}`;
export const FREE_CLEAN_PREVIEW = [
  "Bring any CSV into the full cleaning workspace without scores, objectives or challenge rules",
  "Nothing is graded and every tool is available so you can experiment or clean a real file",
];

export function getBootMachineState(progress, savedWorkspaceIds = [], sessionInserted = false, sessionEjected = false) {
  const complete = isBootComplete(progress);
  const saved = savedWorkspaceIds.includes(BOOT_WORKSPACE_ID);
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

export function getInitialMachineChallengeId(challenges, progress, savedWorkspaceIds = []) {
  const tutorial = challenges.find((challenge) => challenge.tutorial);
  if (!isBootComplete(progress)) return tutorial?.id ?? challenges[0]?.id ?? "";

  const missions = challenges
    .filter((challenge) => !challenge.tutorial)
    .sort((left, right) => left.number - right.number);
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
