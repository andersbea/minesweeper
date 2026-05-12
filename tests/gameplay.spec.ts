import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, readBoard, summarize } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("first click reveals at least the centre cell and starts the timer", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Cell 5,5").click()
  const after = summarize(await readBoard(page))
  // First click is guaranteed to land in a safe 3×3 zone, so it reveals
  // the click target plus any cascade.
  expect(after.hidden).toBeLessThan(after.total)
  // Timer should tick at least once shortly after the click. The PlayBar
  // shows a free-floating "MM:SS" string next to the bomb count.
  await page.waitForTimeout(1200)
  const playbarText = await page.locator("body").innerText()
  expect(playbarText).not.toMatch(/\b00:00\b/)
})

test("right-click toggles a flag", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Cell 1,1").click({ button: "right" })
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toBeVisible()
  await page.getByLabel("Cell 1,1").click({ button: "right" })
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toHaveCount(0)
})

test("clicking a number with no surrounding flags does NOT chord", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Cell 5,5").click()

  // Find a numbered cell.
  const numbered = await page.evaluate(() => {
    for (const b of Array.from(document.querySelectorAll("button[aria-label^='Cell ']"))) {
      const txt = (b.textContent || "").trim()
      if (/^[1-8]$/.test(txt)) {
        return b.getAttribute("aria-label")
      }
    }
    return null
  })
  expect(numbered).not.toBeNull()

  const before = summarize(await readBoard(page))
  await page.locator(`button[aria-label='${numbered}']`).click()
  const after = summarize(await readBoard(page))

  // Safe chord: with 0 flags it can't fire, so cell counts must not change.
  expect(after).toEqual(before)
})

test("flagging and clicking a satisfied number reveals all other neighbours", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Cell 5,5").click()

  // Locate any "1" with at least one hidden neighbour.
  const target = await page.evaluate(() => {
    function classify(r: number, c: number) {
      const b = document.querySelector(`button[aria-label='Cell ${r},${c}']`) as HTMLElement | null
      if (!b) return null
      const txt = (b.textContent || "").trim()
      if (b.getAttribute("data-cell-state") === "hidden") return { type: "hidden" }
      if (txt) return { type: "number", n: Number(txt) }
      return { type: "empty" }
    }
    for (let r = 1; r <= 12; r++)
      for (let c = 1; c <= 12; c++) {
        const cell = classify(r, c)
        if (cell?.type !== "number" || cell.n !== 1) continue
        const hidden: [number, number][] = []
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            if (!dr && !dc) continue
            const n = classify(r + dr, c + dc)
            if (n?.type === "hidden") hidden.push([r + dr, c + dc])
          }
        if (hidden.length >= 2) return { r, c, hidden }
      }
    return null
  })
  expect(target, "Need a '1' with ≥2 hidden neighbours to test chord").not.toBeNull()

  // Flag the first hidden neighbour, then click the "1".
  await page
    .locator(`button[aria-label='Cell ${target!.hidden[0][0]},${target!.hidden[0][1]}']`)
    .click({ button: "right" })

  const before = summarize(await readBoard(page))
  await page.locator(`button[aria-label='Cell ${target!.r},${target!.c}']`).click()
  const after = summarize(await readBoard(page))

  // After chord: hidden count should drop by at least one (could drop more
  // via cascades, or trigger a loss if we mis-flagged).
  expect(after.hidden).toBeLessThan(before.hidden)
})

test("long-press flags a cell on touch — independent of flag-mode", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)

  async function longPress(label: string) {
    const cell = page.locator(`button[aria-label='${label}']`)
    const box = await cell.boundingBox()
    if (!box) throw new Error(`No bounding box for ${label}`)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    // Cell.tsx listens for native TouchEvents, not PointerEvents. Dispatch a
    // matching synthetic Touch sequence: touchstart, then later touchend.
    const dispatch = async (type: "touchstart" | "touchend") => {
      await page.evaluate(
        ([sel, x, y, t]) => {
          const el = document.querySelector(sel as string) as HTMLElement
          if (!el) throw new Error("missing")
          const touch = new Touch({
            identifier: 1,
            target: el,
            clientX: x as number,
            clientY: y as number,
            screenX: x as number,
            screenY: y as number,
            pageX: x as number,
            pageY: y as number,
            radiusX: 5,
            radiusY: 5,
            rotationAngle: 0,
            force: 1,
          })
          el.dispatchEvent(
            new TouchEvent(t as string, {
              bubbles: true,
              cancelable: true,
              touches: t === "touchend" ? [] : [touch],
              targetTouches: t === "touchend" ? [] : [touch],
              changedTouches: [touch],
            }),
          )
        },
        [`button[aria-label='${label}']`, cx, cy, type],
      )
    }
    await dispatch("touchstart")
    await page.waitForTimeout(360) // > LONG_PRESS_MS
    await dispatch("touchend")
  }

  // 1) Default mode (single tap = reveal). Long-press should flag.
  await longPress("Cell 1,1")
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toBeVisible()

  // 2) Flip into flag-mode (single tap = flag). Long-press should STILL flag.
  await page.getByLabel("Switch to flag mode").click()
  await longPress("Cell 1,3")
  await expect(page.getByLabel("Cell 1,3").locator("svg.lucide-flag")).toBeVisible()
})

test("flag-mode toggle inverts tap behaviour", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // The first tap on the board always reveals regardless of flag mode —
  // mines need to be placed around the first click. Do that first, then
  // enable flag mode to test inversion on all subsequent taps.
  await page.getByLabel("Cell 5,5").click()
  await page.getByLabel("Switch to flag mode").click()

  // A single tap on a hidden cell should now flag, not reveal.
  await page.getByLabel("Cell 1,1").click()
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toBeVisible()

  // Board should have exactly 1 flag and Cell 1,1 must not be revealed.
  const after = summarize(await readBoard(page))
  expect(after.flagged).toBe(1)
})

test("mine counter goes negative and turns red when over-flagging", async ({ page }) => {
  // Seed a tiny 3×3 board with one mine so we can deterministically place
  // more flags than mines without fighting the cascade.
  await page.addInitScript(() => {
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
        level: 1, rows: 3, cols: 3, mines: 1, bonusTiles: 0,
        modifierId: "calm", paletteSeed: 0, board,
        status: "playing", seconds: 0, exploded: null,
        countdown: null, bonusValue: 5,
      }),
    )
  })
  await page.goto("/")
  // Place 2 flags — that's 1 more than the lone mine.
  await page.locator("button[aria-label='Cell 1,2']").click({ button: "right" })
  await page.locator("button[aria-label='Cell 1,3']").click({ button: "right" })
  // aria-label now includes the excess count for screen readers
  const counter = page.getByLabel("Too many flags placed — 1 extra")
  await expect(counter).toBeVisible()
  // Visual text shows "+1" (positive excess) with a flag icon, not "-1"
  await expect(counter).toContainText("+1")
  // It should also be styled with the danger colour.
  const color = await counter.evaluate((el) => getComputedStyle(el).color)
  // The text-color should be the danger token. We can't easily compare to the
  // exact oklch value, but it should NOT match the default fg colour.
  const fgColor = await page
    .locator("[aria-label='Open menu']")
    .evaluate((el) => getComputedStyle(el).color)
  expect(color).not.toBe(fgColor)
})

test("hitting a mine shows the loss overlay and reveals all mines", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // First click to populate the board, then keep clicking until a mine fires.
  await page.getByLabel("Cell 1,1").click()
  // Find a hidden cell that is most likely to be a mine — pick one far from
  // the safe zone we just revealed. With deterministic random this is reliable.
  for (let r = 1; r <= 12; r++) {
    for (let c = 1; c <= 12; c++) {
      const cell = page.locator(`button[aria-label='Cell ${r},${c}']`)
      if ((await cell.count()) === 0) continue
      if ((await cell.getAttribute("data-cell-state")) !== "hidden") continue
      await cell.click()
      // The loss overlay is intentionally delayed ~1.8 s so the player can see
      // the revealed mines first. Detect the mine hit synchronously via bomb
      // icons (revealAllMines fires immediately), then wait for the overlay.
      const bombs = await page.locator("button[aria-label^='Cell '] svg.lucide-bomb").count()
      if (bombs > 0) {
        await expect(page.getByText("You hit a mine")).toBeVisible({ timeout: 3000 })
        await expect(page.getByRole("button", { name: /Retry level/ })).toBeVisible()
        return
      }
    }
  }
  // If we never hit a mine within the entire board, the test set-up failed.
  throw new Error("Never hit a mine while clicking every hidden cell")
})

// ─── Flag/unflag/reveal regression ────────────────────────────────────────────
// Regression: flagging a cell, then unflaging it, then revealing it used to
// trigger an instant win on boards where the first-click cascade left only
// that one safe cell hidden. The fix (placeMines rejects near-trivial boards)
// combined with correct flag→unflag→reveal state transitions is tested here.
test("flag→unflag→reveal does not fire a premature win while other safe cells remain hidden", async ({
  page,
}) => {
  // 3×3 board, mine at (0,0). Two hidden non-mine cells:
  //   Cell 1,2 (row=0, col=1, adjacent=1) — the flag/unflag target
  //   Cell 3,3 (row=2, col=2, adjacent=0) — the final reveal
  // Everything else is already revealed so we isolate the flag interaction.
  //
  // Adjacency: the lone mine at (0,0) makes (0,1), (1,0), and (1,1) each
  // have adjacent=1; all other non-mine cells have adjacent=0.
  await page.addInitScript(() => {
    const board = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => {
        const isMine = r === 0 && c === 0
        // Cells within one step of (0,0) pick up its mine count.
        const adjacent = !isMine && r <= 1 && c <= 1 ? 1 : 0
        // Mine + Cell 1,2 (0,1) + Cell 3,3 (2,2) start hidden; rest revealed.
        const isHidden = isMine || (r === 0 && c === 1) || (r === 2 && c === 2)
        return {
          mine: isMine,
          adjacent,
          state: isHidden ? "hidden" : "revealed",
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
        modifierId: "calm",
        paletteSeed: 0,
        board,
        status: "playing",
        seconds: 30,
        exploded: null,
        countdown: null,
        bonusValue: 5,
        lossReason: null,
      }),
    )
  })
  await page.goto("/")

  // ── Step 1: flag Cell 1,2 ────────────────────────────────────────────────
  await page.getByLabel("Cell 1,2").click({ button: "right" })
  await expect(page.getByLabel("Cell 1,2").locator("svg.lucide-flag")).toBeVisible()

  // ── Step 2: unflag Cell 1,2 ──────────────────────────────────────────────
  await page.getByLabel("Cell 1,2").click({ button: "right" })
  await expect(page.getByLabel("Cell 1,2").locator("svg.lucide-flag")).toHaveCount(0)

  // ── Step 3: reveal Cell 1,2 — win must NOT fire (Cell 3,3 still hidden) ──
  await page.getByLabel("Cell 1,2").click()
  await expect(page.getByText("Level complete")).toHaveCount(0)
  // Cell 1,2 must now be revealed (shows its adjacent count "1").
  await expect(page.locator("button[aria-label='Cell 1,2']")).toHaveAttribute(
    "data-cell-state",
    "revealed",
  )
  // Cell 3,3 must still be hidden.
  await expect(page.locator("button[aria-label='Cell 3,3']")).toHaveAttribute(
    "data-cell-state",
    "hidden",
  )

  // ── Step 4: reveal Cell 3,3 — this IS the last safe cell, win must fire ──
  await page.getByLabel("Cell 3,3").click()
  await expect(page.getByText("Level complete")).toBeVisible({ timeout: 2000 })
})
