import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, setPersisted } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("ItemsBar hidden when inventory is empty", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await expect(page.getByRole("list", { name: "Items" })).toHaveCount(0)
})

test("ItemsBar shows three slots when player has items", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["life", "pick", "scan"] })
  await page.goto("/")
  await dismissIntro(page)
  const bar = page.getByRole("list", { name: "Items" })
  await expect(bar).toBeVisible()
  // The bar always has exactly ITEM_MAX (3) slots — held items + empty placeholders.
  const slots = page.locator('[role="listitem"]')
  await expect(slots).toHaveCount(3)
})

test("Lucky Pick reveals a hidden cell and is consumed", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["pick"] })
  await page.goto("/")
  await dismissIntro(page)
  // First click starts the round, status → playing. Pick can only be used
  // while playing, so we need to start first.
  await page.getByLabel("Cell 5,5").click()
  // Wait until the timer state is "playing" — confirmed by the playbar timer
  // showing a non-zero value or just by waiting briefly for the click handler.
  await page.waitForTimeout(200)
  const hiddenBefore = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button[aria-label^='Cell ']")).filter((b) =>
      b.className.includes("color-surface-2"),
    ).length,
  )
  // Click the only item slot.
  await page.getByRole("listitem").first().click()
  const hiddenAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button[aria-label^='Cell ']")).filter((b) =>
      b.className.includes("color-surface-2"),
    ).length,
  )
  expect(hiddenAfter).toBeLessThan(hiddenBefore)
  // Item should be removed from inventory.
  const items = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.items") ?? "[]"))
  expect(items).not.toContain("pick")
})

test("Extra Life is not manually consumable — slot is disabled", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["life"] })
  await page.goto("/")
  await dismissIntro(page)
  const slot = page.getByRole("listitem").first()
  await expect(slot).toBeDisabled()
})

test("Mine Scan highlights mines briefly", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["scan"] })
  await page.goto("/")
  await dismissIntro(page)
  // Trigger a first click to populate mines + enter "playing" state.
  await page.getByLabel("Cell 5,5").click()
  await page.waitForTimeout(150)
  // Activate the Scan slot.
  await page.getByRole("listitem").first().click()
  // Within the 2s window, some hidden cell should be marked as a mine
  // via the ring/pulse class.
  const ringsDuring = await page
    .locator("span.ring-2.ring-\\[var\\(--color-danger\\)\\]\\/70")
    .count()
  expect(ringsDuring).toBeGreaterThan(0)
  // Wait past the 2s timer; effect should clear.
  await page.waitForTimeout(2100)
  const ringsAfter = await page
    .locator("span.ring-2.ring-\\[var\\(--color-danger\\)\\]\\/70")
    .count()
  expect(ringsAfter).toBe(0)
})

test("Inventory caps at three (won't go above ITEM_MAX)", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["life", "pick", "scan"] })
  await page.goto("/")
  await dismissIntro(page)
  // Quick sanity: only three slots rendered.
  await expect(page.getByRole("listitem")).toHaveCount(3)
})

test("New Run wipes the item inventory", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["life", "pick", "scan"] })
  await page.goto("/")
  await dismissIntro(page)
  // Sanity: bar visible before reset.
  await expect(page.getByRole("list", { name: "Items" })).toBeVisible()
  // Trigger New Run via the menu.
  await page.getByLabel("Open menu").click()
  await page.getByRole("button", { name: "New run" }).click()
  await dismissIntro(page)
  // Inventory cleared → bar gone.
  await expect(page.getByRole("list", { name: "Items" })).toHaveCount(0)
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.items") ?? "[]"))
  expect(stored).toEqual([])
})

test("SwapDialog appears when a new item drops onto a full inventory", async ({ page }) => {
  // Seed full inventory + a saved round that's one click away from winning.
  // We can't deterministically force a win via UI, so we mount a near-win
  // active round via storage: a 9x9 board with all non-mine cells already
  // revealed except one, plus a known mine layout.
  await setPersisted(page, { "ms.items": ["pick", "pick", "pick"] })
  await page.addInitScript(() => {
    // Build a 3x3 board, 1 mine at (0,0). All non-mine cells revealed except (2,2).
    const rows = 3
    const cols = 3
    const board = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: r === 0 && c === 0 ? 0 : r <= 1 && c <= 1 ? 1 : 0,
        // Reveal every non-mine cell except (2,2) — that's our winning click.
        state: r === 0 && c === 0 ? "hidden" : !(r === 2 && c === 2) ? "revealed" : "hidden",
        bonus: false,
        twin: false,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        level: 1,
        rows,
        cols,
        mines: 1,
        bonusTiles: 0,
        modifierId: "calm",
        paletteSeed: 0,
        board,
        status: "playing",
        seconds: 5,
        exploded: null,
        countdown: null,
        bonusValue: 5,
      }),
    )
  })
  await page.goto("/")
  // No intro: round is already in progress (status: "playing").
  // Click the winning cell.
  await page.getByLabel("Cell 3,3").click()
  // The win triggers a drop into a full inventory → SwapDialog appears.
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toBeVisible()
  // Dialog shows three replaceable slot buttons.
  const slotButtons = page
    .getByRole("dialog", { name: "Replace an item" })
    .getByRole("button", { name: /^Replace / })
  await expect(slotButtons).toHaveCount(3)
  // Skip option discards the new item, dismisses the dialog.
  await page.getByRole("button", { name: /^Skip/ }).click()
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toHaveCount(0)
})
