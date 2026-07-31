import { expect, test } from "@playwright/test";

const CORE_COMPLETIONS = [
  ["boot-sequence", 2],
  ["cafe-closing-time", 5],
  ["signup-swamp", 3],
  ["warehouse-echoes", 3],
  ["support-night-shift", 3],
  ["dataset-from-hell", 4],
  ["final-final-export", 5],
];

test.beforeEach(async ({ page }, testInfo) => {
  const progressJson = testInfo.title.startsWith("HELL DISK")
    ? JSON.stringify({
        version: 1,
        achievementRulesVersion: 2,
        records: Object.fromEntries(CORE_COMPLETIONS.map(([id, revision]) => [
          id,
          { revision, complete: true, grade: "A" },
        ])),
        achievements: {},
      })
    : "";
  await page.addInitScript((seededProgress) => {
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

test("Free Clean opens through its preview", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
  await expect(page.getByRole("heading", { name: "Free Clean" })).toBeVisible();
  await page.getByRole("button", { name: "Open Free Clean" }).click();

  await expect(page.getByText("Upload CSV", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load Sample Dataset/ })).toBeVisible();
});

test("sample data streams into the Free Clean table", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
  await page.getByRole("button", { name: "Open Free Clean" }).click();
  await page.getByRole("button", { name: /Load Sample Dataset/ }).click();

  await expect(page.getByRole("heading", { name: "sample_sales.csv" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".ag-center-cols-container .ag-row").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("10,000", { exact: true }).first()).toBeVisible();
});

test("a table cell can be edited and undone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
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

test("Fill Issues runs from Cleaning Tools and returns to the table", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
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

test("column conversion menus close after clicking elsewhere", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
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
  await page.getByRole("button", { name: /FREE CLEAN/ }).click();
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
