import { test, expect } from "@playwright/test"
import { freshSession, setPersisted } from "./_helpers"

// Helper: inject a minimal 3×3 playing board (mine at (0,0)) where only the
// cell at (2,2) remains hidden. Clicking Cell 3,3 reveals the last safe cell
// and triggers a win. Level is configurable.
function seedOneClickWin(level: number) {
  return (page: Parameters<typeof freshSession>[0]) =>
    page.addInitScript((lvl: number) => {
      const board = Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => ({
          mine: r === 0 && c === 0,
          // Only cells adjacent to (0,0) have a count > 0.
          adjacent: r === 0 && c === 0 ? 0 : r <= 1 && c <= 1 ? 1 : 0,
          // Mine and last safe cell are hidden; everything else is already revealed.
          state: (r === 0 && c === 0) || (r === 2 && c === 2) ? "hidden" : "revealed",
          bonus: false,
          twin: false,
          item: null,
        })),
      )
      window.localStorage.setItem(
        "ms.activeRound",
        JSON.stringify({
          schemaVersion: 1,
          level: lvl,
          rows: 3,
          cols: 3,
          mines: 1,
          bonusTiles: 0,
          modifierId: "calm",
          paletteSeed: 0,
          board,
          status: "playing",
          seconds: 10,
          exploded: null,
          countdown: null,
          bonusValue: 5,
        }),
      )
    }, level)
}

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

// ─── Win overlay ───────────────────────────────────────────────────────────────

test("win overlay shows 'Level complete' when the last safe cell is revealed", async ({
  page,
}) => {
  await seedOneClickWin(3)(page)
  await page.goto("/")
  // Cell 3,3 is the only remaining hidden safe cell.
  await page.getByLabel("Cell 3,3").click()
  await expect(page.getByText("Level complete")).toBeVisible({ timeout: 2000 })
  await expect(page.getByRole("button", { name: /Next level/ })).toBeVisible()
})

// ─── Level advancement ─────────────────────────────────────────────────────────

test("Next level button advances the level counter by one", async ({ page }) => {
  await seedOneClickWin(5)(page)
  await page.goto("/")
  await page.getByLabel("Cell 3,3").click()
  await expect(page.getByText("Level complete")).toBeVisible({ timeout: 2000 })
  await page.getByRole("button", { name: /Next level/ }).click()
  // The ReadyOverlay for the next round must reference level 6.
  await expect(page.getByText(/Level 6/)).toBeVisible({ timeout: 2000 })
})

// ─── Countdown expiry ──────────────────────────────────────────────────────────

test("countdown expiry shows 'Time's up' overlay", async ({ page }) => {
  await page.addInitScript(() => {
    // A playing board with only 1 second left on the countdown clock.
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: 0,
        state: "hidden",
        bonus: false,
        twin: false,
        item: null,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
        level: 1,
        rows: 3,
        cols: 3,
        mines: 1,
        bonusTiles: 0,
        modifierId: "quick",
        paletteSeed: 0,
        board,
        status: "playing",
        // seconds is the current countdown value — 1 means one tick until zero.
        seconds: 1,
        exploded: null,
        countdown: 30,
        bonusValue: 5,
      }),
    )
  })
  await page.goto("/")
  // Timer fires almost immediately (≤1 s to reach 0) then the 1.8 s delay
  // kicks in before the overlay appears. Give it 5 s total to be safe.
  await expect(page.getByText("Time's up")).toBeVisible({ timeout: 5000 })
  await expect(page.getByRole("button", { name: /Retry level/ })).toBeVisible()
})

// ─── Countdown debrief ────────────────────────────────────────────────────────

test("countdown expiry reveals unfound mines and exposes wrongly-placed flags", async ({
  page,
}) => {
  // 3×3 board with 1 second left on the clock.
  // Mine at (0,0). Two hidden safe cells: (0,1) and (2,2).
  // One correctly placed flag at (0,0) (the mine).
  // One wrongly placed flag at (1,1) (safe cell).
  // All other cells are already revealed.
  //
  // At countdown expiry we expect:
  //   (0,0) — mine + flagged    → stays flagged  (correct, keep as positive feedback)
  //   (1,1) — safe  + flagged   → becomes revealed (exposes the wrong flag)
  //   (0,1) — mine-adjacent + hidden → becomes revealed (bomb icon on cell? no, it's safe)
  //           wait — (0,1) is safe and hidden, not a mine → revealed as number
  //   (2,2) — safe  + hidden    → stays hidden (revealAtCountdownLoss only touches
  //           flagged-non-mines and hidden-mines)
  await page.addInitScript(() => {
    const adjacentTo00 = (r: number, c: number) =>
      Math.abs(r) <= 1 && Math.abs(c) <= 1 && !(r === 0 && c === 0)
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => {
        const isMine = r === 0 && c === 0
        const isWrongFlag = r === 1 && c === 1
        const isHidden = isMine || isWrongFlag || (r === 0 && c === 1) || (r === 2 && c === 2)
        return {
          mine: isMine,
          adjacent: !isMine && adjacentTo00(r, c) ? 1 : 0,
          state: isMine
            ? "flagged"         // correctly flagged mine
            : isWrongFlag
              ? "flagged"       // wrongly flagged safe cell
              : isHidden
                ? "hidden"
                : "revealed",
          bonus: false,
          twin: false,
          item: null,
        }
      }),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
        level: 1,
        rows: 3,
        cols: 3,
        mines: 1,
        bonusTiles: 0,
        modifierId: "quick",
        paletteSeed: 0,
        board,
        status: "playing",
        seconds: 1,
        exploded: null,
        countdown: 30,
        bonusValue: 5,
        lossReason: null,
      }),
    )
  })
  await page.goto("/")

  // Wait for the countdown to fire (≤1 s) and the debrief to apply.
  await page.waitForTimeout(1500)

  // Correctly flagged mine at (0,0) = Cell 1,1 must STAY flagged.
  await expect(page.locator("button[aria-label='Cell 1,1']")).toHaveAttribute(
    "data-cell-state",
    "flagged",
  )

  // Wrongly flagged safe cell at (1,1) = Cell 2,2 must now be REVEALED.
  await expect(page.locator("button[aria-label='Cell 2,2']")).toHaveAttribute(
    "data-cell-state",
    "revealed",
  )

  // The Time's up overlay must eventually appear.
  await expect(page.getByText("Time's up")).toBeVisible({ timeout: 5000 })
})

// ─── Extra Life ────────────────────────────────────────────────────────────────

test("Extra Life defuses a mine on direct reveal — no explosion", async ({ page }) => {
  await page.addInitScript(() => {
    // 3×3 board in "playing" state. Mine at (0,0) = Cell 1,1.
    // All cells hidden so we can click the mine directly.
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent:
          r === 0 && c === 0
            ? 0
            : (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 1 && c === 1)
              ? 1
              : 0,
        state: "hidden",
        bonus: false,
        twin: false,
        item: null,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
        level: 2,
        rows: 3,
        cols: 3,
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
    // One unlocked Extra Life in inventory.
    window.localStorage.setItem("ms.items", JSON.stringify(["life"]))
    window.localStorage.setItem("ms.itemLocks", JSON.stringify([false]))
  })
  await page.goto("/")

  // Click Cell 1,1 — that's the mine. Extra Life should intercept.
  await page.getByLabel("Cell 1,1").click()

  // The mine was defused — Cell 1,1 must show a flag, NOT a bomb.
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toBeVisible()
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-bomb")).toHaveCount(0)

  // "Extra Life used" toast must appear.
  await expect(page.getByRole("status")).toContainText("Extra Life", { timeout: 2000 })

  // The round must NOT be lost.
  await expect(page.getByText("You hit a mine")).toHaveCount(0)

  // Extra Life must be consumed from inventory.
  const items = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("ms.items") ?? "[]"),
  )
  expect(items).not.toContain("life")
})

// ─── Retry inventory restoration ───────────────────────────────────────────────

test("Retry level restores inventory from the round-start snapshot", async ({ page }) => {
  await page.addInitScript(() => {
    // Seed a "lost" round — mine at (0,0) was triggered.
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
        mine: r === 0 && c === 0,
        adjacent: r === 0 && c === 0 ? 0 : r <= 1 && c <= 1 ? 1 : 0,
        // Mine revealed (exploded); everything else hidden.
        state: r === 0 && c === 0 ? "revealed" : "hidden",
        bonus: false,
        twin: false,
        item: null,
      })),
    )
    window.localStorage.setItem(
      "ms.activeRound",
      JSON.stringify({
        schemaVersion: 1,
        level: 2,
        rows: 3,
        cols: 3,
        mines: 1,
        bonusTiles: 0,
        modifierId: "calm",
        paletteSeed: 0,
        board,
        status: "lost",
        seconds: 5,
        exploded: [0, 0],
        countdown: null,
        bonusValue: 5,
        lossReason: "mine",
      }),
    )
    // Current inventory was depleted during the round (only "scan" remains).
    window.localStorage.setItem("ms.items", JSON.stringify(["scan"]))
    window.localStorage.setItem("ms.itemLocks", JSON.stringify([false]))
    // The round-start snapshot had both items.
    window.localStorage.setItem("ms.roundStartItems", JSON.stringify(["pick", "scan"]))
    window.localStorage.setItem("ms.roundStartItemLocks", JSON.stringify([false, false]))
  })
  await page.goto("/")

  // Wait for the loss overlay to appear (1.8 s delay after status=lost).
  await expect(page.getByText("You hit a mine")).toBeVisible({ timeout: 4000 })
  await page.getByRole("button", { name: /Retry level/ }).click()

  // After retry, inventory must be restored to the round-start snapshot.
  const items = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("ms.items") ?? "[]"),
  )
  expect(items).toEqual(["pick", "scan"])
})

// ─── SwapDialog replace slot ────────────────────────────────────────────────────

test("SwapDialog replace slot swaps the item, closes the dialog, and shows a toast", async ({
  page,
}) => {
  // Full inventory of 3 Lucky Picks.
  await setPersisted(page, { "ms.items": ["pick", "pick", "pick"] })
  await page.addInitScript(() => {
    // Same 3×3 board pattern as in items.spec.ts — Extra Life on Cell 2,2.
    const adjacent = (r: number, c: number) =>
      r === 0 && c === 0 ? 0 : r <= 1 && c <= 1 ? 1 : 0
    const hidden = (r: number, c: number) =>
      (r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 1)
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({
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
        rows: 3,
        cols: 3,
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

  // Reveal Cell 2,2 (the Extra Life cell).
  await page.getByLabel("Cell 2,2").click()

  // Collect it — inventory is full so the SwapDialog opens.
  await page.getByLabel("Cell 2,2 — collect Extra Life").click()
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toBeVisible()

  // Replace the first Lucky Pick slot with the Extra Life.
  await page
    .getByRole("dialog", { name: "Replace an item" })
    .getByRole("button", { name: "Replace Lucky Pick" })
    .first()
    .click()

  // Dialog must close.
  await expect(page.getByRole("dialog", { name: "Replace an item" })).toHaveCount(0)

  // Toast confirms the swap.
  await expect(page.getByRole("status")).toContainText("Extra Life", { timeout: 2000 })

  // Slot 0 should now hold "life" in localStorage.
  const items = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("ms.items") ?? "[]"),
  )
  expect(items[0]).toBe("life")
})
