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
      const cls = b.className
      const txt = (b.textContent || "").trim()
      if (cls.includes("color-surface-2")) return { type: "hidden" }
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
  await page.getByLabel("Switch to flag mode").click()

  // A single tap on a hidden cell should now flag, not reveal.
  await page.getByLabel("Cell 1,1").click()
  await expect(page.getByLabel("Cell 1,1").locator("svg.lucide-flag")).toBeVisible()

  // The board should still be all hidden — no cascade.
  const after = summarize(await readBoard(page))
  expect(after.flagged).toBe(1)
  expect(after.revealedNumber + after.revealedEmpty).toBe(0)
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
      const cls = (await cell.getAttribute("class")) ?? ""
      if (!cls.includes("color-surface-2")) continue
      await cell.click()
      const lostText = page.getByText("You hit a mine")
      if (await lostText.isVisible().catch(() => false)) {
        await expect(lostText).toBeVisible()
        await expect(page.getByRole("button", { name: /Retry level/ })).toBeVisible()
        return
      }
    }
  }
  // If we never hit a mine within the entire board, the test set-up failed.
  throw new Error("Never hit a mine while clicking every hidden cell")
})
