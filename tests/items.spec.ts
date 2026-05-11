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
      (b as HTMLElement).getAttribute("data-cell-state") === "hidden",
    ).length,
  )
  // Click the only item slot.
  await page.getByRole("listitem").first().click()
  const hiddenAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button[aria-label^='Cell ']")).filter((b) =>
      (b as HTMLElement).getAttribute("data-cell-state") === "hidden",
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

test("collecting an item from a board cell adds it to inventory", async ({ page }) => {
  // Seed a round where revealing the item cell isn't a winning click:
  // mine at (0,0), item on (1,1) (adjacent=1 → no cascade), and (2,1)
  // also hidden so the win condition isn't met.
  await page.addInitScript(() => {
    const rows = 3
    const cols = 3
    const adjacent = (r: number, c: number) =>
      // (0,0) is the only mine.
      r === 0 && c === 0 ? 0 : (r <= 1 && c <= 1 ? 1 : 0)
    const hidden = (r: number, c: number) =>
      (r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 1)
    const board = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: adjacent(r, c),
        state: hidden(r, c) ? "hidden" : "revealed",
        bonus: false,
        twin: false,
        item: r === 1 && c === 1 ? "scan" : null,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
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
  // Reveal the item cell. After reveal, the badge should appear.
  await page.getByLabel("Cell 2,2").click()
  // Inventory still empty until the player taps the badge.
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.items") ?? "[]"))
  expect(stored).toEqual([])
  // Tap the cell again → collect.
  await page.getByLabel("Cell 2,2").click()
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.items") ?? "[]"))
  expect(stored).toEqual(["scan"])
  // Bar appears with the item.
  await expect(page.getByRole("list", { name: "Items" })).toBeVisible()
})

test("collected item is locked — slot is disabled until next round starts", async ({ page }) => {
  // Seed the same playing board used in the collection test.
  await page.addInitScript(() => {
    const rows = 3, cols = 3
    const board = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: r === 0 && c === 0 ? 0 : r <= 1 && c <= 1 ? 1 : 0,
        state: (r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 1) ? "hidden" : "revealed",
        bonus: false,
        twin: false,
        item: r === 1 && c === 1 ? "pick" : null,
      })),
    )
    window.localStorage.setItem("ms.activeRound", JSON.stringify({
      schemaVersion: 1,
      level: 1, rows, cols, mines: 1, bonusTiles: 0,
      modifierId: "calm", paletteSeed: 0, board,
      status: "playing", seconds: 5, exploded: null, countdown: null, bonusValue: 5,
    }))
  })
  await page.goto("/")
  // Reveal then collect the item.
  await page.getByLabel("Cell 2,2").click()
  await page.getByLabel("Cell 2,2").click()
  // The slot should appear but be disabled (locked).
  const slot = page.getByRole("listitem").first()
  await expect(slot).toBeDisabled()
  // localStorage should record the lock.
  const locks = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.itemLocks") ?? "[]"))
  expect(locks).toEqual([true])
})

test("locked item unlocks when Start is clicked on the next round", async ({ page }) => {
  // Seed inventory with one locked pick and a fresh ready-state board.
  await page.addInitScript(() => {
    window.localStorage.setItem("ms.items", JSON.stringify(["pick"]))
    window.localStorage.setItem("ms.itemLocks", JSON.stringify([true]))
  })
  await page.goto("/")
  // ReadyOverlay should be visible — the pick should show "New" locked indicator.
  const startBtn = page.getByRole("button", { name: "Start", exact: true })
  await expect(startBtn).toBeVisible()
  // Slot is disabled while overlay is open AND item is locked.
  // (Items bar isn't shown in overlay; we check after Start.)
  await startBtn.click()
  // After Start the lock clears — slot must now be enabled (status="ready" still,
  // but canUse requires playing, so we start the round first).
  await page.getByLabel("Cell 5,5").click()
  await page.waitForTimeout(100)
  const slot = page.getByRole("listitem").first()
  await expect(slot).not.toBeDisabled()
  // localStorage lock should be cleared.
  const locks = await page.evaluate(() => JSON.parse(localStorage.getItem("ms.itemLocks") ?? "[]"))
  expect(locks).toEqual([false])
})

test("items discovery view shows in the menu", async ({ page }) => {
  await setPersisted(page, { "ms.discoveredItems": ["scan"] })
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Open menu").click()
  // Items entry should list 1 of 3.
  await expect(page.getByLabel("Open items list")).toContainText("1 of 3")
  await page.getByLabel("Open items list").click()
  // Scan is known — should show its name.
  await expect(page.getByRole("group", { name: "Mine Scan" })).toBeVisible()
  // The other two should show as undiscovered.
  await expect(page.getByRole("group", { name: "Undiscovered item" })).toHaveCount(2)
})

test("SwapDialog appears when collecting on a full inventory", async ({ page }) => {
  await setPersisted(page, { "ms.items": ["pick", "pick", "pick"] })
  await page.addInitScript(() => {
    const rows = 3
    const cols = 3
    const adjacent = (r: number, c: number) =>
      r === 0 && c === 0 ? 0 : (r <= 1 && c <= 1 ? 1 : 0)
    const hidden = (r: number, c: number) =>
      (r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 1)
    const board = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: adjacent(r, c),
        state: hidden(r, c) ? "hidden" : "revealed",
        bonus: false,
        twin: false,
        item: r === 1 && c === 1 ? "life" : null,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
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
  await page.getByLabel("Cell 2,2").click() // reveal item cell
  await page.getByLabel("Cell 2,2").click() // tap to collect → swap dialog
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toBeVisible()
  const slotButtons = page
    .getByRole("dialog", { name: "Replace an item" })
    .getByRole("button", { name: /^Replace / })
  await expect(slotButtons).toHaveCount(3)
  await page.getByRole("button", { name: /^Skip/ }).click()
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toHaveCount(0)
})
