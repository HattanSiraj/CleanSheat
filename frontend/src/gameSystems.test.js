import test from "node:test";
import assert from "node:assert/strict";
import { findNewAchievements } from "./game/achievements.js";
import {
  calculateChallengeScore,
  createRunStats,
  getActionChangeSize,
  getDeletedRowCount,
  isBetterResult,
  isScoreableAction,
} from "./game/scoring.js";
import {
  createGameProgress,
  getBestGrade,
  isBootComplete,
  readGameProgress,
  recordChallengeResult,
  writeGameProgress,
} from "./game/progress.js";
import {
  clampThrowVelocity,
  createDesktopFiles,
  ejectFileFromTarget,
  getDesktopObjectMetrics,
  hasMovingDesktopFiles,
  isFileInRecycleBin,
  isFileNearTarget,
  resizeDesktopFiles,
  stepDesktopPhysics,
} from "./game/desktopPhysics.js";
import {
  BOOT_WORKSPACE_ID,
  FREE_CLEAN_PREVIEW,
  buildOrthogonalCablePath,
  getBootMachineState,
  getChallengeModuleState,
  getInitialMachineChallengeId,
} from "./game/campaignMachine.js";

test("challenge grades reward clean complete runs without a move limit", () => {
  const challenge = {};
  const evaluation = {
    complete: true,
    objectives: [{ complete: true }, { complete: true }],
    rules: [{ complete: true }],
  };
  const perfect = calculateChallengeScore(challenge, evaluation, { moves: 8, hintsUsed: 0, maxCombo: 3 });
  assert.equal(perfect.total, 100);
  assert.equal(perfect.grade, "S");
  assert.equal(perfect.corruption, 0);

  const slow = calculateChallengeScore(challenge, evaluation, { moves: 80, hintsUsed: 0, maxCombo: 3 });
  assert.equal(slow.total, 100);
  assert.equal(slow.grade, "S");

  const hinted = calculateChallengeScore(challenge, evaluation, { moves: 80, hintsUsed: 1, maxCombo: 3 });
  assert.equal(hinted.total, 95);
  assert.equal(hinted.grade, "A");

  const unfinished = calculateChallengeScore(challenge, { ...evaluation, complete: false }, { moves: 8 });
  assert.equal(unfinished.grade, "");
});

test("campaign records keep the strongest result and track repeat clears", () => {
  const challenge = { id: "cafe", revision: 3 };
  const first = recordChallengeResult(createGameProgress(), challenge, {
    complete: true,
    grade: "A",
    total: 92,
    moves: 9,
    maxCombo: 3,
    hintsUsed: 0,
  });
  const second = recordChallengeResult(first, challenge, {
    complete: true,
    grade: "B",
    total: 84,
    moves: 7,
    maxCombo: 1,
    hintsUsed: 2,
  });
  assert.equal(second.records.cafe.grade, "A");
  assert.equal(second.records.cafe.score, 92);
  assert.equal(second.records.cafe.bestMoves, 7);
  assert.equal(second.records.cafe.completions, 2);
  assert.equal(isBetterResult({ grade: "S", total: 98, moves: 12 }, second.records.cafe), true);
});

test("game progress ignores old versions and unlocks missions after Boot Sequence", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  values.set("cleansheet.game-progress", JSON.stringify({ version: 0, records: { old: { complete: true } } }));
  assert.deepEqual(readGameProgress(storage), createGameProgress());

  const progress = {
    ...createGameProgress(),
    records: {
      "boot-sequence": { complete: true, grade: "B" },
      cafe: { complete: true, grade: "A" },
    },
  };
  writeGameProgress(progress, storage);
  const restored = readGameProgress(storage);
  assert.equal(isBootComplete(restored), true);
  assert.equal(getBestGrade(restored), "A");
});

test("boot machine state follows the tutorial save and completion record", () => {
  const empty = createGameProgress();
  assert.deepEqual(getBootMachineState(empty), {
    complete: false,
    saved: false,
    diskInserted: false,
    phase: "waiting",
  });
  assert.equal(getBootMachineState(empty, [], true).phase, "ready");
  assert.equal(getBootMachineState(empty, [BOOT_WORKSPACE_ID]).phase, "incomplete");
  const complete = {
    ...empty,
    records: { "boot-sequence": { complete: true, grade: "A" } },
  };
  assert.equal(getBootMachineState(complete).phase, "online");
});

test("Free Clean has a two line hover preview", () => {
  assert.equal(FREE_CLEAN_PREVIEW.length, 2);
  assert.ok(FREE_CLEAN_PREVIEW.every((line) => line.trim()));
});

test("repair console selects saved work before the next unfinished challenge", () => {
  const challenges = [
    { id: "boot-sequence", number: 0, tutorial: true },
    { id: "one", number: 1 },
    { id: "two", number: 2 },
    { id: "three", number: 3 },
  ];
  const empty = createGameProgress();
  assert.equal(getInitialMachineChallengeId(challenges, empty), "boot-sequence");
  const booted = {
    ...empty,
    records: {
      "boot-sequence": { complete: true },
      one: { complete: true },
    },
  };
  assert.equal(getInitialMachineChallengeId(challenges, booted), "two");
  assert.equal(getInitialMachineChallengeId(challenges, booted, ["challenge:three"]), "three");
  const finished = {
    ...booted,
    records: {
      ...booted.records,
      two: { complete: true },
      three: { complete: true },
    },
  };
  assert.equal(getInitialMachineChallengeId(challenges, finished), "one");
});

test("challenge modules report locked saved and completed states", () => {
  const challenge = { id: "one" };
  const progress = createGameProgress();
  assert.equal(getChallengeModuleState(challenge, progress, [], false).status, "NO POWER");
  assert.equal(getChallengeModuleState(challenge, progress, ["challenge:one"], true).status, "IN PROGRESS");
  const complete = { ...progress, records: { one: { complete: true, grade: "S" } } };
  assert.equal(getChallengeModuleState(challenge, complete, [], true).status, "GRADE S");
});

test("machine cables use one square angled trunk", () => {
  assert.equal(
    buildOrthogonalCablePath({ x: 100, y: 80 }, { x: 420, y: 230 }, 240),
    "M 100 80 H 240 V 230 H 420",
  );
});

test("achievements unlock once and keep secret achievements hidden until earned", () => {
  const challenge = {
    id: "dataset-from-hell",
    objectives: [
      { id: "regex", kind: "patternMatch", column: "Email" },
      { id: "formula-one", kind: "calculatedColumn" },
      { id: "formula-two", kind: "calculatedColumn" },
      { id: "formula-three", kind: "calculatedColumn" },
    ],
  };
  const context = {
    challenge,
    evaluation: {
      complete: true,
      objectives: challenge.objectives.map((objective) => ({ ...objective, complete: true })),
    },
    runStats: { maxCombo: 3, deletedRows: 0, undoCount: 0, largestChange: 0, clipbitClicks: 0 },
    score: { grade: "S", moves: 8 },
    columnRules: { Email: { mode: "customRegex" } },
  };
  const first = findNewAchievements(createGameProgress(), context);
  const earnedIds = first.earned.map((achievement) => achievement.id);
  assert.ok(earnedIds.includes("regex-wizard"));
  assert.ok(earnedIds.includes("formula-goblin"));
  assert.ok(earnedIds.includes("dataset-exorcist"));
  assert.ok(!earnedIds.includes("undo-addict"));
  assert.equal(findNewAchievements(first.progress, context).earned.length, 0);
});

test("Regex Wizard needs Custom Regex on the completed objective column", () => {
  const challenge = {
    id: "tutorial",
    objectives: [{ id: "date-pattern", kind: "patternMatch", column: "Date" }],
  };
  const baseContext = {
    challenge,
    evaluation: {
      complete: true,
      objectives: [{ id: "date-pattern", complete: true }],
    },
    runStats: createRunStats(),
    score: { grade: "A", moves: 4 },
  };
  const presetResult = findNewAchievements(createGameProgress(), {
    ...baseContext,
    columnRules: { Date: { mode: "preset" } },
  });
  assert.ok(!presetResult.earned.some((achievement) => achievement.id === "regex-wizard"));

  const customResult = findNewAchievements(createGameProgress(), {
    ...baseContext,
    columnRules: { Date: { mode: "customRegex" } },
  });
  assert.ok(customResult.earned.some((achievement) => achievement.id === "regex-wizard"));
});

test("achievement rule migration removes only retired or unreliable unlocks", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  values.set("cleansheet.game-progress", JSON.stringify({
    version: 1,
    records: { cafe: { complete: true } },
    achievements: {
      "first-boot": { unlockedAt: "now" },
      "under-par": { unlockedAt: "now" },
      "regex-wizard": { unlockedAt: "now" },
    },
  }));
  const migrated = readGameProgress(storage);
  assert.deepEqual(Object.keys(migrated.achievements), ["first-boot"]);
  assert.equal(migrated.records.cafe.complete, true);
});

test("move helpers ignore column placement and count bulk row changes", () => {
  assert.equal(isScoreableAction({ kind: "columnOrder" }), false);
  assert.equal(isScoreableAction({ kind: "cells" }), true);
  const action = {
    kind: "compound",
    actions: [
      { kind: "cells", changes: [{}, {}, {}] },
      { kind: "deleteRows", rows: [{}, {}] },
    ],
  };
  assert.equal(getActionChangeSize(action), 5);
  assert.equal(getDeletedRowCount(action), 2);
});

test("desktop files spawn inside the play area and restore to rest", () => {
  const files = createDesktopFiles(
    Array.from({ length: 5 }, (_, index) => ({ id: `file-${index}` })),
    { width: 900, height: 500 },
  );
  assert.equal(files.length, 5);
  assert.ok(files.every((file) => file.x >= 0 && file.x + file.width <= 900));
  assert.ok(files.every((file) => file.y >= 0 && file.y + file.height <= 500));
  assert.ok(files.every((file) => file.pinned && file.x < 30));
  assert.equal(hasMovingDesktopFiles(files), false);
});

test("desktop object metrics stay readable and stop growing after the large screen limit", () => {
  const minimum = getDesktopObjectMetrics(1280, 720);
  const base = getDesktopObjectMetrics(1920, 1080);
  const large = getDesktopObjectMetrics(2560, 1600);
  const fourK = getDesktopObjectMetrics(3840, 2160);
  assert.equal(minimum.scale, 0.82);
  assert.equal(base.scale, 1);
  assert.equal(large.scale, 1.2);
  assert.deepEqual(fourK, large);
  assert.equal(large.fileWidth, 69.6);
  assert.equal(large.fileHeight, 84);
});

test("desktop physics applies gravity and bounces off boundaries", () => {
  const [file] = createDesktopFiles([{ id: "falling" }], { width: 300, height: 200 });
  const falling = { ...file, y: 125, vy: 500, pinned: false, sleeping: false };
  const result = stepDesktopPhysics([falling], { width: 300, height: 200 }, 0.032);
  assert.equal(result.files[0].y, 130);
  assert.ok(result.files[0].vy < 0);
  assert.ok(result.collisions > 0);
});

test("desktop files separate and exchange movement when they collide", () => {
  const files = createDesktopFiles([{ id: "left" }, { id: "right" }], { width: 400, height: 240 });
  const left = { ...files[0], x: 100, y: 80, vx: 300, pinned: false, sleeping: false };
  const right = { ...files[1], x: 150, y: 80, vx: -100, pinned: false, sleeping: false };
  const result = stepDesktopPhysics([left, right], { width: 400, height: 240 }, 0);
  assert.ok(result.files[0].x + result.files[0].width <= result.files[1].x + 0.001);
  assert.ok(result.files[0].vx < result.files[1].vx);
  assert.equal(result.collisions, 1);
});

test("a dragged desktop file pushes a sleeping file without moving itself", () => {
  const files = createDesktopFiles([{ id: "dragged" }, { id: "sleeping" }], { width: 400, height: 240 });
  const dragged = { ...files[0], x: 100, y: 80, vx: 420, pinned: false, dragging: true, sleeping: false };
  const sleeping = { ...files[1], x: 150, y: 80, vx: 0, pinned: false, sleeping: true };
  const result = stepDesktopPhysics([dragged, sleeping], { width: 400, height: 240 }, 0, { draggedId: "dragged" });
  assert.equal(result.files[0].x, 100);
  assert.ok(result.files[1].x > 150);
  assert.ok(result.files[1].vx > 0);
  assert.equal(result.files[1].sleeping, false);
});

test("a loose file bounces off a pinned file without moving its pin", () => {
  const files = createDesktopFiles([{ id: "pinned" }, { id: "loose" }], { width: 400, height: 240 });
  const pinned = { ...files[0], x: 100, y: 80 };
  const loose = { ...files[1], x: 145, y: 80, vx: -300, pinned: false, sleeping: false };
  const result = stepDesktopPhysics([pinned, loose], { width: 400, height: 240 }, 0);
  assert.equal(result.files[0].x, 100);
  assert.equal(result.files[0].y, 80);
  assert.ok(result.files[1].x >= 158);
  assert.ok(result.files[1].vx > 0);
});

test("desktop throw speed is clamped without changing its direction", () => {
  const velocity = clampThrowVelocity(3000, 4000, 1000);
  assert.equal(Math.round(Math.hypot(velocity.vx, velocity.vy)), 1000);
  assert.equal(velocity.vx / velocity.vy, 0.75);
});

test("recycle hit testing uses the file center and ignores removed files", () => {
  const file = { id: "junk", x: 20, y: 20, width: 40, height: 50, discarded: false, discarding: false };
  const bin = { x: 30, y: 30, width: 60, height: 70 };
  assert.equal(isFileInRecycleBin(file, bin), true);
  assert.equal(isFileInRecycleBin({ ...file, discarded: true }, bin), false);
  assert.equal(isFileInRecycleBin({ ...file, x: 120 }, bin), false);
});

test("boot drive hit testing gives thrown files a forgiving target", () => {
  const disk = { id: "boot", x: 76, y: 30, width: 40, height: 50, discarded: false, discarding: false };
  const drive = { x: 120, y: 40, width: 80, height: 24 };
  assert.equal(isFileNearTarget(disk, drive), false);
  assert.equal(isFileNearTarget(disk, drive, 24), true);
  assert.equal(isFileNearTarget({ ...disk, discarded: true }, drive, 24), false);
});

test("wrong files are kicked away from the boot drive", () => {
  const file = {
    id: "wrong",
    x: 100,
    y: 60,
    width: 40,
    height: 50,
    vx: 120,
    vy: 90,
    pinned: false,
    dragging: false,
    sleeping: false,
  };
  const drive = { x: 130, y: 70, width: 80, height: 24 };
  const ejected = ejectFileFromTarget(file, drive);
  assert.ok(ejected.vx < -500);
  assert.ok(ejected.vy < -400);
  assert.equal(Math.abs(ejected.angularVelocity), 240);
  assert.equal(file.vx, 120);
});

test("desktop resize keeps every loose file inside the new bounds", () => {
  const files = createDesktopFiles([{ id: "one" }, { id: "two" }], { width: 1000, height: 600 });
  const resized = resizeDesktopFiles(files, { width: 1000, height: 600 }, { width: 320, height: 180 });
  assert.ok(resized.every((file) => file.x >= 0 && file.x + file.width <= 320));
  assert.ok(resized.every((file) => file.y >= 0 && file.y + file.height <= 180));
  assert.ok(resized.every((file) => file.sleeping));
});

test("desktop resize updates file dimensions and collision bounds at large scale", () => {
  const normalMetrics = getDesktopObjectMetrics(1920, 1080);
  const largeMetrics = getDesktopObjectMetrics(2560, 1600);
  const files = createDesktopFiles([{ id: "one" }, { id: "two" }], { width: 1000, height: 600 }, normalMetrics);
  const resized = resizeDesktopFiles(files, { width: 1000, height: 600 }, { width: 1400, height: 900 }, largeMetrics);
  assert.ok(resized.every((file) => file.width === largeMetrics.fileWidth));
  assert.ok(resized.every((file) => file.height === largeMetrics.fileHeight));
  assert.ok(resized.every((file) => file.x + file.width <= 1400));
  assert.ok(resized.every((file) => file.y + file.height <= 900));
});
