import { test, expect } from "@playwright/test"
import { freshSession, readBoard, summarize, waitForAnimations } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("mid-round board state survives a refresh", async ({ page }) => {
  await page.goto("/")
  // Reveal a chunk of the board — first click is safe, then cascade.
  await page.getByLabel("Cell 5,5").click()
  // Grab the modifier name + palette text + level number to compare later.
  const before = await page.evaluate(() => ({
    body: document.body.innerText,
  }))
  const beforeBoard = summarize(await readBoard(page))
  expect(beforeBoard.hidden).toBeLessThan(beforeBoard.total)

  // Place a flag on a still-hidden cell so we can confirm flags persist too.
  const flagTarget = await page.evaluate(() => {
    for (const b of Array.from(document.querySelectorAll("button[aria-label^='Cell ']"))) {
      const cls = (b as HTMLElement).className
      if (cls.includes("color-surface-2")) return b.getAttribute("aria-label")
    }
    return null
  })
  expect(flagTarget).not.toBeNull()
  await page.locator(`button[aria-label='${flagTarget}']`).click({ button: "right" })

  await page.waitForTimeout(1100) // let the timer tick at least once
  const beforeBoardWithFlag = summarize(await readBoard(page))

  await page.reload()

  // After reload: same level number, same modifier, same revealed/flagged cells.
  const after = await page.evaluate(() => ({
    body: document.body.innerText,
  }))
  const afterBoard = summarize(await readBoard(page))

  expect(afterBoard).toEqual(beforeBoardWithFlag)
  // Body text should still mention the same modifier name.
  // Pull the modifier word from the playbar (after the palette name).
  const modifierBefore = before.body.match(/(Calm|Fog|Bonus Tiles|Twin Mines|Quick Round|Dense Field)/)?.[0]
  const modifierAfter = after.body.match(/(Calm|Fog|Bonus Tiles|Twin Mines|Quick Round|Dense Field)/)?.[0]
  expect(modifierAfter).toBe(modifierBefore)
})

test("timer value survives a refresh and keeps ticking", async ({ page }) => {
  async function readSec() {
    return await page.evaluate(() => {
      const m = document.body.innerText.match(/\b(\d{2}):(\d{2})\b/)
      return m ? Number(m[1]) * 60 + Number(m[2]) : -1
    })
  }
  await page.goto("/")
  await page.getByLabel("Cell 5,5").click()
  await page.waitForTimeout(2200)
  const before = await readSec()
  expect(before).toBeGreaterThanOrEqual(2)

  await page.reload()
  // Timer should resume at the saved value and continue from there.
  const justAfter = await readSec()
  expect(justAfter, "timer should pick up at or near the saved value").toBeGreaterThanOrEqual(before)
  await page.waitForTimeout(1200)
  const later = await readSec()
  expect(later, "timer should keep ticking after reload").toBeGreaterThan(justAfter)
})

test("a lost round still shows the loss overlay after refresh", async ({ page }) => {
  await page.goto("/")
  // Click cells until one explodes.
  await page.getByLabel("Cell 1,1").click()
  for (let r = 1; r <= 12; r++) {
    for (let c = 1; c <= 12; c++) {
      const cell = page.locator(`button[aria-label='Cell ${r},${c}']`)
      if ((await cell.count()) === 0) continue
      const cls = (await cell.getAttribute("class")) ?? ""
      if (!cls.includes("color-surface-2")) continue
      await cell.click()
      if (await page.getByText("You hit a mine").isVisible().catch(() => false)) {
        // Lost — refresh and verify the overlay returns.
        await page.reload()
        await expect(page.getByText("You hit a mine")).toBeVisible()
        await expect(page.getByRole("button", { name: /Retry level/ })).toBeVisible()
        return
      }
    }
  }
  throw new Error("Never hit a mine while clicking every cell")
})

test("New run wipes the saved round so the next reload starts fresh", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Cell 5,5").click()
  await page.waitForTimeout(1100)
  // Sanity: some cells are revealed.
  const dirty = summarize(await readBoard(page))
  expect(dirty.hidden).toBeLessThan(dirty.total)

  // Trigger New Run via the menu.
  await page.getByLabel("Open menu").click()
  await waitForAnimations(page)
  await page.getByRole("button", { name: "New run" }).click()

  // Reload — board should be all-hidden because the new run's snapshot
  // is "fresh round at level 1".
  await page.reload()
  const fresh = summarize(await readBoard(page))
  expect(fresh.revealedNumber + fresh.revealedEmpty).toBe(0)
  expect(fresh.flagged).toBe(0)
})
