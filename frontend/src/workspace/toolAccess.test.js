import assert from "node:assert/strict";
import test from "node:test";
import { CLEANING_TOOLS } from "./cleaningTools.js";
import {
  getChallengeCleaningTools,
  getCleaningToolAccess,
  isCleaningToolUnlocked,
} from "./toolAccess.js";

const BASIC_CHALLENGE = {
  id: "basic",
  revision: 1,
  objectives: [
    { kind: "patternMatch" },
    { kind: "allowedValues" },
  ],
};

const SCHEMA_CHALLENGE = {
  id: "schema",
  revision: 1,
  objectives: [
    { kind: "unique" },
    { kind: "calculatedColumn" },
  ],
};

test("challenge objectives expose the tools needed to solve them", () => {
  assert.deepEqual(getChallengeCleaningTools(BASIC_CHALLENGE), ["fillIssues", "findReplace", "textCleanup"]);
  assert.deepEqual(getChallengeCleaningTools(SCHEMA_CHALLENGE), ["duplicates", "manageColumns"]);
});

test("explicit challenge tool access overrides inferred tools", () => {
  const challenge = {
    ...BASIC_CHALLENGE,
    toolAccess: { cleaningTools: ["missingValues"] },
  };
  assert.deepEqual(getChallengeCleaningTools(challenge), ["missingValues"]);
});

test("active challenge tools are temporarily unlocked", () => {
  const access = getCleaningToolAccess({
    activeChallenge: SCHEMA_CHALLENGE,
    challenges: [BASIC_CHALLENGE, SCHEMA_CHALLENGE],
    progress: { records: {} },
  });
  assert.deepEqual(access.activeIds, ["duplicates", "manageColumns"]);
  assert.equal(isCleaningToolUnlocked(access, "duplicates"), true);
  assert.equal(isCleaningToolUnlocked(access, "findReplace"), false);
});

test("completed challenge tools stay unlocked", () => {
  const access = getCleaningToolAccess({
    activeChallenge: SCHEMA_CHALLENGE,
    challenges: [BASIC_CHALLENGE, SCHEMA_CHALLENGE],
    progress: { records: { basic: { complete: true, revision: 1 } } },
  });
  assert.deepEqual(access.earnedIds, ["fillIssues", "findReplace", "textCleanup"]);
  assert.deepEqual(access.unlockedIds, ["duplicates", "manageColumns", "fillIssues", "findReplace", "textCleanup"]);
});

test("old challenge revisions do not keep tools unlocked", () => {
  const access = getCleaningToolAccess({
    activeChallenge: SCHEMA_CHALLENGE,
    challenges: [BASIC_CHALLENGE, SCHEMA_CHALLENGE],
    progress: { records: { basic: { complete: true, revision: 0 } } },
  });
  assert.deepEqual(access.earnedIds, []);
});

test("Free Clean unlocks every cleaning tool", () => {
  const access = getCleaningToolAccess({ freeClean: true });
  assert.deepEqual(access.unlockedIds, CLEANING_TOOLS.map((tool) => tool.id));
  assert.deepEqual(access.lockedIds, []);
});
