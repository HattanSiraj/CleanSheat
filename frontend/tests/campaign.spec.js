import { expect, test } from "@playwright/test";
import { CHALLENGES } from "../src/challengeData.js";

const CORE_COMPLETION_IDS = [
  "boot-scan-training",
  "boot-category-training",
  "boot-issue-training",
  "boot-recovery-training",
  "boot-sequence",
  "cafe-closing-time",
  "signup-swamp",
  "warehouse-echoes",
  "support-night-shift",
  "dataset-from-hell",
  "final-final-export",
];
const challengeRevisions = new Map(CHALLENGES.map((challenge) => [challenge.id, challenge.revision]));
const CORE_COMPLETIONS = CORE_COMPLETION_IDS.map((id) => [id, challengeRevisions.get(id)]);

test.beforeEach(async ({ page }, testInfo) => {
  let progressJson = "";
  if (testInfo.title.startsWith("HELL DISK")) {
    progressJson = JSON.stringify({
        version: 1,
        achievementRulesVersion: 2,
        bootSequenceVersion: 3,
        records: Object.fromEntries(CORE_COMPLETIONS.map(([id, revision]) => [
          id,
          { revision, complete: true, grade: "A" },
        ])),
        achievements: {},
      });
  }
  if (testInfo.title.startsWith("Stage 2")) {
    progressJson = JSON.stringify({
      version: 1,
      achievementRulesVersion: 2,
      bootSequenceVersion: 3,
      records: { "boot-scan-training": { revision: 2, complete: true, grade: "A" } },
      achievements: {},
    });
  }
  if (testInfo.title.startsWith("Stage 3")) {
    progressJson = JSON.stringify({
      version: 1,
      achievementRulesVersion: 2,
      bootSequenceVersion: 3,
      records: Object.fromEntries(CORE_COMPLETIONS.slice(0, 2).map(([id, revision]) => [id, { revision, complete: true, grade: "A" }])),
      achievements: {},
    });
  }
  if (testInfo.title.startsWith("Stage 4")) {
    progressJson = JSON.stringify({
      version: 1,
      achievementRulesVersion: 2,
      bootSequenceVersion: 3,
      records: Object.fromEntries(CORE_COMPLETIONS.slice(0, 3).map(([id, revision]) => [id, { revision, complete: true, grade: "A" }])),
      achievements: {},
    });
  }
  if (testInfo.title.startsWith("Stage 5")) {
    progressJson = JSON.stringify({
      version: 1,
      achievementRulesVersion: 2,
      bootSequenceVersion: 3,
      records: Object.fromEntries(CORE_COMPLETIONS.slice(0, 4).map(([id, revision]) => [id, { revision, complete: true, grade: "A" }])),
      achievements: {},
    });
  }
  if (testInfo.title.startsWith("Undo survives refresh")) {
    progressJson = JSON.stringify({
      version: 1,
      achievementRulesVersion: 2,
      bootSequenceVersion: 3,
      records: Object.fromEntries(CORE_COMPLETIONS.slice(0, 5).map(([id, revision]) => [
        id,
        { revision, complete: true, grade: "A" },
      ])),
      achievements: {},
    });
  }
  await page.addInitScript((seededProgress) => {
    if (window.sessionStorage.getItem("cleansheet.test-initialized")) return;
    window.sessionStorage.setItem("cleansheet.test-initialized", "true");
    window.localStorage.clear();
    window.indexedDB.deleteDatabase("cleansheet-workspaces");
    if (seededProgress) {
      window.localStorage.setItem("cleansheet.storage-version", "2");
      window.localStorage.setItem("cleansheet.game-progress", seededProgress);
    }
  }, progressJson);
});

test("campaign opens without runtime errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");

  await expect(page.getByText("CLEANSHEET OS")).toBeVisible();
  await expect(page.getByRole("heading", { name: "This machine forgot how to start" })).toBeVisible();
  await expect(page.getByText("INSERT BOOT DISK", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("boot disk reveals five dial positions in order", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");

  const stageOne = page.getByRole("button", { name: /BOOT 1.*SCANNER TRAINING/ });
  const stageTwo = page.getByRole("button", { name: /BOOT 2.*CATEGORY TRAINING/ });
  const stageThree = page.getByRole("button", { name: /BOOT 3.*ISSUE TRAINING/ });
  const stageFour = page.getByRole("button", { name: /BOOT 4.*RECOVERY TRAINING/ });
  const stageFive = page.getByRole("button", { name: /BOOT 5.*BOOT SEQUENCE/ });
  await expect(stageOne).toBeEnabled({ timeout: 5000 });
  await expect(stageTwo).toBeDisabled();
  await expect(stageThree).toBeDisabled();
  await expect(stageFour).toBeDisabled();
  await expect(stageFive).toBeDisabled();
  await expect(stageOne).toHaveAttribute("data-dial-angle", "0");
  await expect(stageTwo).toHaveAttribute("data-dial-angle", "45");
  await expect(stageThree).toHaveAttribute("data-dial-angle", "90");
  await expect(stageFour).toHaveAttribute("data-dial-angle", "135");
  await expect(stageFive).toHaveAttribute("data-dial-angle", "180");
  await expect(page.getByRole("group", { name: "Boot stage selector" })).toBeVisible();
  const knobBox = await page.getByRole("button", { name: /Turn boot stage dial/ }).boundingBox();
  const dialSizes = await page.getByRole("button", { name: /Turn boot stage dial/ }).evaluate((knob) => ({
    knobWidth: getComputedStyle(knob).width,
    pointerHeight: getComputedStyle(knob.querySelector("i")).height,
  }));
  const stageBoxes = await Promise.all([
    stageOne.boundingBox(),
    stageTwo.boundingBox(),
    stageThree.boundingBox(),
    stageFour.boundingBox(),
    stageFive.boundingBox(),
  ]);
  expect(knobBox).not.toBeNull();
  expect(dialSizes).toEqual({ knobWidth: "112px", pointerHeight: "94px" });
  expect(stageBoxes.every(Boolean)).toBe(true);
  const knobCenter = {
    x: knobBox.x + knobBox.width / 2,
    y: knobBox.y + knobBox.height / 2,
  };
  const stageCenters = stageBoxes.map((box) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  }));
  expect(Math.abs(stageCenters[0].y - knobCenter.y)).toBeLessThan(14);
  expect(Math.abs(stageCenters[2].x - knobCenter.x)).toBeLessThan(3);
  expect(Math.abs(stageCenters[4].y - knobCenter.y)).toBeLessThan(14);
  expect(stageCenters[0].x).toBeLessThan(stageCenters[1].x);
  expect(stageCenters[1].x).toBeLessThan(stageCenters[2].x);
  expect(stageCenters[2].x).toBeLessThan(stageCenters[3].x);
  expect(stageCenters[3].x).toBeLessThan(stageCenters[4].x);
  await stageOne.click();
  await expect(page.getByRole("heading", { name: "Scanner Training" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toBeVisible();
});

test("boot dial can preview stages before the disk is inserted", async ({ page }) => {
  await page.goto("/");

  const knob = page.getByRole("button", { name: /Turn boot stage dial/ });
  await expect(knob).toBeEnabled();
  await knob.scrollIntoViewIfNeeded();
  const bounds = await knob.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 290, centerY, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole("button", { name: /BOOT 5.*BOOT SEQUENCE/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("INSERT BOOT DISK", { exact: true })).toBeVisible();
});

test("Stage 3 dial can be grabbed and turned back to Stage 1", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await expect(page.getByRole("heading", { name: "Issue Training" })).toBeVisible({ timeout: 5000 });

  const knob = page.getByRole("button", { name: /Turn boot stage dial/ });
  await knob.scrollIntoViewIfNeeded();
  const bounds = await knob.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX - 150, centerY, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByRole("heading", { name: "Scanner Training" })).toBeVisible();
  await expect(page.getByRole("button", { name: /BOOT 1.*SCANNER TRAINING/ })).toHaveAttribute("aria-pressed", "true");
});

test("dial can preview a blocked Stage 5 without unlocking it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");

  const knob = page.getByRole("button", { name: /Turn boot stage dial/ });
  await expect(knob).toBeEnabled({ timeout: 5000 });
  await knob.scrollIntoViewIfNeeded();
  const bounds = await knob.boundingBox();
  expect(bounds).not.toBeNull();
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 290, centerY, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole("heading", { name: "Boot Sequence" })).toBeVisible();
  await expect(page.getByText("STAGE LOCKED", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /BOOT 5.*BOOT SEQUENCE/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});

test("Stage 1 can be completed from its walkthrough", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The complete tutorial path only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await page.getByRole("button", { name: /BOOT 1.*SCANNER TRAINING/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  await expect(page.getByRole("heading", { name: "Challenge 0: Scanner Training" })).toBeVisible();
  await expect(page.getByText("Data health map", { exact: true })).toHaveCount(0);
  await page.locator('.ag-header-cell[col-id="Tickets Closed"] .grid-header-button').click();
  await page.locator(".column-type-control select").selectOption("Integer");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Scanner Training" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".challenge-result .clipbit.embedded")).toBeVisible();
  await expect(page.getByText(/genuinely impressed/)).toBeVisible();
  await page.getByRole("button", { name: "Back to boot menu" }).click();
  await expect(page.getByRole("button", { name: /BOOT 2.*CATEGORY TRAINING/ })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Scanner Training" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Restart|Replay/ })).toBeVisible();
});

test("Stage 5 introduces the two way Item price relation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The final tutorial walkthrough only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await expect(page.getByRole("heading", { name: "Boot Sequence" })).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  await expect(page.getByRole("heading", { name: "Challenge 0: Boot Sequence" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /Boot 0\.5C Walkthrough/ }).click();
  await expect(page.getByText("Connect Item and price with one Logical relation", { exact: true })).toBeVisible();
  await expect(page.getByText("Item ↔ Price Per Unit", { exact: true })).toBeVisible();
  await expect(page.getByText("Training file loaded", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Recover prices from Item", { exact: true })).toBeVisible();
  await expect(page.getByText("Recover Items from price", { exact: true })).toBeVisible();
});

test("moving every challenge row triggers Clipbit and restarts the level", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The row wipeout scene only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await page.getByRole("button", { name: /BOOT 1.*SCANNER TRAINING/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  const tableRows = page.locator(".ag-center-cols-container .ag-row");
  await expect(tableRows).toHaveCount(12);
  for (let rowIndex = 0; rowIndex < 12; rowIndex += 1) {
    await tableRows.nth(rowIndex).locator(".ag-cell").first().click({
      modifiers: rowIndex ? ["Control"] : [],
    });
  }
  await page.getByRole("button", { name: "Move 12 to Bin", exact: true }).click();
  await page.locator(".confirmation-backdrop").getByRole("button", { name: "Move to Data Bin" }).click();

  await expect(page.locator(".clipbit.row-wipeout-scene")).toBeVisible();
  await expect(page.getByText(/got rid of the problem at its roots/)).toBeVisible();
  await page.waitForTimeout(7000);
  await expect(page.getByText(/got rid of the problem at its roots/)).toBeVisible();
  await page.getByRole("button", { name: "Restart level" }).click();
  await expect(page.getByText(/That was not data cleaning/)).toBeVisible({ timeout: 15000 });
  await expect(tableRows).toHaveCount(12);
});

test("Stage 2 can be completed from its walkthrough", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The complete tutorial path only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await page.getByRole("button", { name: /BOOT 2.*CATEGORY TRAINING/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  await expect(page.getByRole("heading", { name: "Challenge 0: Category Training" })).toBeVisible();
  await page.locator('.ag-header-cell[col-id="Status"] .grid-header-button').click();
  await page.locator(".dataset-control-row").getByRole("button", { name: "Cleaning Tools", exact: true }).click();
  await page.getByRole("button", { name: /Text Cleanup/i }).click();
  await page.getByLabel("Capitalization").selectOption("title");
  await page.getByRole("button", { name: "Apply cleanup" }).click();
  await page.locator(".confirmation-backdrop").getByRole("button", { name: "Apply cleanup" }).click();
  await page.locator(".column-type-control select").selectOption("Category");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Category Training" })).toBeVisible({ timeout: 30000 });
});

test("Stage 3 can be completed with Fill Issues", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The complete tutorial path only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await page.getByRole("button", { name: /BOOT 3.*ISSUE TRAINING/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  await page.locator('.ag-header-cell[col-id="Daily Target"] .grid-header-button').click();
  await page.locator(".column-type-control select").selectOption("Integer");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.locator(".dataset-control-row").getByRole("button", { name: "Cleaning Tools", exact: true }).click();
  await page.getByRole("button", { name: /Fill Issues/i }).click();
  await page.getByRole("radio", { name: /Custom value/i }).check();
  await page.getByLabel("Replacement value").fill("8");
  await page.getByRole("button", { name: "Apply fill" }).click();
  await page.getByRole("button", { name: "Scan Again", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Issue Training" })).toBeVisible({ timeout: 30000 });
});

test("Stage 4 can be completed with one relationship and Data Bin", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The complete tutorial path only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /^BOOT_SEQUENCE\.dsk/ }).press("Enter");
  await page.getByRole("button", { name: /BOOT 4.*RECOVERY TRAINING/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  for (const column of ["Start Reading", "End Reading", "Usage"]) {
    await page.locator(`.ag-header-cell[col-id="${column}"] .grid-header-button`).click();
    await page.locator(".column-type-control select").selectOption("Number");
  }
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByRole("button", { name: /Column Relationships/ }).click();
  await page.getByLabel("Target column").selectOption("Usage");
  await page.getByRole("textbox", { name: "Formula" }).fill("[End Reading] - [Start Reading]");
  await page.getByRole("button", { name: "Add relationship" }).click();
  await page.getByRole("button", { name: "Check all relationships" }).click();
  await page.getByRole("checkbox", { name: /Select all fixable/ }).check();
  await page.getByRole("button", { name: /Apply selected fixes/ }).click();
  const scanAgain = page.getByRole("button", { name: "Scan Again", exact: true });
  await scanAgain.click();
  await expect(page.getByRole("button", { name: "Scanning...", exact: true })).toBeVisible();
  await expect(scanAgain).toBeEnabled();
  await page.getByRole("button", { name: /Validation issues/i }).click();
  await page.getByRole("button", { name: "Move rows to Data Bin (1)" }).click();
  await page.locator(".confirmation-backdrop").getByRole("button", { name: "Move to Data Bin" }).click();
  await page.getByRole("button", { name: "Scan Again", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Recovery Training" })).toBeVisible({ timeout: 30000 });
});

test("development shortcut unlocks the HELL disk", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Achievements" }).click();
  await page.getByRole("button", { name: "Unlock HELL DISK" }).click();

  await expect(page.getByRole("button", { name: /^HELL_DISK\.dsk/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick the next broken module" })).toBeVisible();
});

test("HELL DISK opens six corrupted files with unstable names", async ({ page }) => {
  await page.goto("/");

  const hellDisk = page.getByRole("button", { name: /^HELL_DISK\.dsk/ });
  await expect(hellDisk).toBeVisible();
  await hellDisk.press("Enter");

  await expect(page.locator(".campaign-screen")).toHaveClass(/hell-mode/, { timeout: 5000 });
  await expect(page.getByText("BREACH BUS", { exact: true })).toBeVisible();
  await expect(page.locator(".challenge-module")).toHaveCount(6);

  const firstTitle = page.locator(".challenge-module .corrupted-live-text").first();
  const initialText = await firstTitle.textContent();
  await expect.poll(() => firstTitle.textContent(), { timeout: 1500 }).not.toBe(initialText);
});

test("HELL DISK cooling fans can be boosted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^HELL_DISK\.dsk/ }).press("Enter");
  await expect(page.locator(".campaign-screen")).toHaveClass(/hell-mode/, { timeout: 5000 });

  const coolingBay = page.getByRole("region", { name: "Server cooling bay" });
  await coolingBay.getByRole("button", { name: "Boost cooling fan A" }).click();

  await expect(coolingBay).toHaveClass(/boosted/);
  await expect(coolingBay.getByText("OVERDRIVE", { exact: true })).toBeVisible();
});

test("Free Clean opens through its preview", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Free Clean/i }).click();
  await expect(page.getByRole("heading", { name: "Free Clean" })).toBeVisible();
  await page.getByRole("button", { name: "Open Free Clean" }).click();

  await expect(page.getByText("Upload CSV", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load Sample Dataset/ })).toBeVisible();
});

test("sample data streams into the Free Clean table", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.getByRole("button", { name: /Load Sample Dataset/ }).click();

  await expect(page.getByRole("heading", { name: "sample_sales.csv" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".ag-center-cols-container .ag-row").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("10,000", { exact: true }).first()).toBeVisible();
});

test("a table cell can be edited and undone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.getByRole("button", { name: /Load Sample Dataset/ }).click();
  await expect(page.getByRole("heading", { name: "sample_sales.csv" })).toBeVisible({ timeout: 30000 });

  const firstCell = page.locator(".ag-center-cols-container .ag-row").first().locator(".ag-cell").first();
  const originalValue = await firstCell.textContent();
  await firstCell.dblclick();
  const editor = firstCell.locator("input");
  await editor.fill("PLAYWRIGHT EDIT");
  await editor.press("Enter");
  await expect(firstCell).toHaveText("PLAYWRIGHT EDIT");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(firstCell).toHaveText(originalValue ?? "");
});

test("Undo survives refresh and continuing a challenge", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "Workspace persistence only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /Cafe Closing Time/ }).click();
  await page.getByRole("button", { name: "Start" }).click();

  const story = page.locator(".challenge-story-textbox");
  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    await story.click();
    if (pageIndex < 2) await page.getByRole("button", { name: "Next" }).click();
  }
  await page.getByRole("button", { name: "Begin challenge" }).click();

  const firstCell = page.locator(".ag-center-cols-container .ag-row").first().locator(".ag-cell").first();
  const originalValue = await firstCell.textContent();
  await firstCell.dblclick();
  await firstCell.locator("input").fill("PLAYWRIGHT REFRESH");
  await firstCell.locator("input").press("Enter");
  await expect(firstCell).toHaveText("PLAYWRIGHT REFRESH");
  await expect(page.getByText("Saving...", { exact: true })).toBeVisible();
  await expect(page.getByText("Saved in this browser", { exact: true })).toBeVisible({ timeout: 10000 });

  await page.reload();
  await page.getByRole("button", { name: /Cafe Closing Time/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Challenge 1: Cafe Closing Time" })).toBeVisible({ timeout: 30000 });
  const restoredCell = page.locator(".ag-center-cols-container .ag-row").first().locator(".ag-cell").first();
  await expect(restoredCell).toHaveText("PLAYWRIGHT REFRESH");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(restoredCell).toHaveText(originalValue ?? "");
});

test("Fill Issues runs from Cleaning Tools and returns to the table", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
    name: "fill_test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Amount\n1\nwrong\n3"),
  });

  await expect(page.getByRole("heading", { name: "fill_test.csv" })).toBeVisible();
  await page.locator('.ag-header-cell[col-id="Amount"] .grid-header-button').click();
  await page.locator(".column-type-control select").selectOption("Number");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText("1 issue found", { exact: true })).toBeVisible({ timeout: 30000 });

  const tableActions = page.locator(".dataset-control-row");
  await expect(tableActions.getByRole("button", { name: /Fill Issues/i })).toHaveCount(0);
  await tableActions.getByRole("button", { name: "Cleaning Tools", exact: true }).click();

  const fillCard = page.getByRole("button", { name: /Fill Issues.*1 ISSUES/i });
  await expect(fillCard).toBeVisible();
  await fillCard.click();
  await expect(page.getByRole("heading", { name: "Fill Issues" })).toBeVisible();

  await page.getByLabel("Replacement value").fill("2");
  await page.getByRole("button", { name: "Apply fill" }).click();

  await expect(page.getByRole("heading", { name: "Fill Issues" })).toHaveCount(0);
  await expect(tableActions.getByRole("button", { name: "Undo", exact: true })).toBeEnabled();
});

test("selected rows can move to the Data Bin and return", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The Data Bin interaction only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.getByRole("button", { name: /Load Sample Dataset/ }).click();
  await expect(page.locator(".ag-center-cols-container .ag-row").first()).toBeVisible({ timeout: 30000 });

  await page.locator('.ag-row[row-index="0"] .ag-cell').first().click();
  await expect(page.getByRole("button", { name: "Move 1 to Bin", exact: true })).toBeVisible();
  await page.locator(".table-grid").click({ position: { x: 1, y: 100 } });
  await expect(page.getByRole("button", { name: "Move 1 to Bin", exact: true })).toHaveCount(0);
  await expect(page.locator('.ag-center-cols-container .ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);

  await page.locator('.ag-row[row-index="0"] .ag-cell').first().click();
  await expect(page.getByRole("button", { name: "Move 1 to Bin", exact: true })).toBeVisible();
  await page.locator(".workspace-header h1").click();
  await expect(page.getByRole("button", { name: "Move 1 to Bin", exact: true })).toHaveCount(0);
  await expect(page.locator('.ag-center-cols-container .ag-row[row-index="0"]')).not.toHaveClass(/ag-row-selected/);

  await page.locator('.ag-row[row-index="0"] .ag-cell').first().click();
  await page.getByRole("button", { name: "Move 1 to Bin", exact: true }).click();
  await page.locator(".confirmation-backdrop").getByRole("button", { name: "Move to Data Bin" }).click();

  await page.locator(".dataset-control-row").getByRole("button", { name: "Cleaning Tools", exact: true }).click();
  await page.getByRole("button", { name: /Data Bin.*1 ROW/i }).click();
  await expect(page.getByText("1 row in the Bin", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore all" }).click();
  await page.locator(".confirmation-backdrop").getByRole("button", { name: "Restore rows" }).click();
  await expect(page.getByText("Nothing is in the Data Bin", { exact: true })).toBeVisible();
});

test("two way Logical relation repairs either column and leaves ambiguous rows alone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The Lookup interaction only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "lookup.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Code,Name\nA,Apple\nA,\nB,Banana\nB,Berry\nB,\nC,\n,Apple\n"),
  });
  await expect(page.getByRole("heading", { name: "lookup.csv" })).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: /Column Relationships/ }).click();
  await page.getByLabel("Relationship type").selectOption("lookup");
  await page.getByLabel("Anchor column").selectOption("Code");
  await expect(page.getByRole("button", { name: "Add relationship" })).toBeDisabled();
  await page.getByRole("button", { name: "Find relations" }).click();
  const nameCandidate = page.locator('[data-lookup-candidate="Name"]');
  await expect(nameCandidate).toContainText("Name → Code");
  await nameCandidate.getByRole("button", { name: "Verify Name relation" }).click();
  await expect(page.locator(".lookup-recommendation")).toContainText("Name → Code");
  await expect(page.locator(".lookup-direction-options").getByRole("button", { name: "Name → Code" })).toHaveClass(/selected/);
  const valuePreview = page.getByLabel("Logical relation value preview");
  await expect(valuePreview).toContainText("1 cell");
  await expect(valuePreview).toContainText("Row 7 · Code");
  await expect(valuePreview).toContainText("Matched from Name = Apple");
  await expect(valuePreview).toContainText("3 trusted pairs");
  await page.getByRole("button", { name: "Code ↔ Name" }).click();
  await expect(valuePreview).toContainText("2 cells");
  await page.getByRole("button", { name: "Add relationship" }).click();
  await expect(page.getByText("Code ↔ Name", { exact: true })).toBeVisible();
  await page.locator(".relationship-rule").getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("2 safe", { exact: true })).toBeVisible();
  await expect(page.getByText("1 ambiguous", { exact: true })).toBeVisible();
  await expect(page.getByText("1 no evidence", { exact: true })).toBeVisible();
  await page.locator(".select-all-fixes").click();
  await page.getByRole("button", { name: "Apply selected fixes (2)" }).click();
  await expect(page.locator('.ag-row[row-index="1"] .ag-cell[col-id="Name"]')).toHaveText("Apple");
  await expect(page.locator('.ag-row[row-index="4"] .ag-cell[col-id="Name"]')).toHaveText("");
  await expect(page.locator('.ag-row[row-index="6"] .ag-cell[col-id="Code"]')).toHaveText("A");
});

test("weak Logical relations need an explicit direction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The Logical relation preview only needs one viewport");
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "weak_relation.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Source,Target\nA,X\nA,Y\nB,Z\nC,X\nD,W\n"),
  });
  await expect(page.getByRole("heading", { name: "weak_relation.csv" })).toBeVisible({ timeout: 30000 });

  await page.getByRole("button", { name: /Column Relationships/ }).click();
  await page.getByLabel("Relationship type").selectOption("lookup");
  await page.getByLabel("Anchor column").selectOption("Source");
  await page.getByRole("button", { name: "Find relations" }).click();
  const targetCandidate = page.locator('[data-lookup-candidate="Target"]');
  await expect(targetCandidate).toContainText("No clear direction");
  await targetCandidate.getByRole("button", { name: "Verify Target relation" }).click();

  await expect(page.getByText("80% dependency strength", { exact: true })).toHaveCount(2);
  await expect(page.getByText(/No recommendation/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add relationship" })).toBeDisabled();
  await expect(page.getByText("Choose a direction above to see the values it would learn and change", { exact: true })).toBeVisible();
  await page.locator(".lookup-direction-options").getByRole("button", { name: "Source → Target" }).click();
  await expect(page.getByLabel("Logical relation value preview")).toContainText("3 trusted pairs");
  await expect(page.getByLabel("Logical relation value preview")).toContainText("No fixable cells were found");
  await expect(page.getByRole("button", { name: "Add relationship" })).toBeEnabled();
});

test("column conversion menus close after clicking elsewhere", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
    name: "conversion_test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Order Date\n2026-07-01\n2026-07-02\n2026-07-03"),
  });

  await expect(page.getByRole("heading", { name: "conversion_test.csv" })).toBeVisible();
  await page.locator('.ag-header-cell[col-id="Order Date"] .grid-header-button').click();
  await page.locator(".column-type-control select").selectOption("Date");

  const conversionMenu = page.locator(".column-convert-menu");
  await conversionMenu.getByText("Change date format", { exact: true }).click();
  await expect(conversionMenu).toHaveAttribute("open", "");

  await conversionMenu.locator("select").click();
  await page.locator(".pixel-select-menu").getByRole("option", { name: "MM/DD/YYYY", exact: true }).click();
  await expect(conversionMenu).toHaveAttribute("open", "");

  await page.getByRole("heading", { name: "conversion_test.csv" }).click();
  await expect(conversionMenu).not.toHaveAttribute("open", "");
});

test("Free Clean loads 200,000 rows without losing the workspace", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "The large data check only needs one viewport");
  test.setTimeout(90000);
  const lines = ["id,value"];
  for (let index = 1; index <= 200000; index += 1) lines.push(`${index},Value ${index % 50}`);

  await page.goto("/");
  await page.getByRole("button", { name: /Free Clean/i }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
    name: "large_test.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(lines.join("\n")),
  });

  await expect(page.getByRole("heading", { name: "large_test.csv" })).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("200,000", { exact: true }).first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".ag-center-cols-container .ag-row").first()).toBeVisible();
});
