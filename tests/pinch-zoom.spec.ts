import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

/**
 * Dispatch a two-finger gesture on the board scroll container.
 * Simulates touchstart with 2 touches, then a touchmove changing the
 * distance between them (and optionally the centroid).
 */
async function pinch(page: import("@playwright/test").Page, mode: "in" | "out") {
  await page.evaluate((mode: string) => {
    const el = document.querySelector(".overflow-auto") as HTMLElement
    if (!el) throw new Error("scroll container not found")
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2

    const make = (x: number, y: number, id: number) =>
      new Touch({
        identifier: id,
        target: el,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
        pageX: x,
        pageY: y,
        radiusX: 5,
        radiusY: 5,
        rotationAngle: 0,
        force: 1,
      })

    const startA = make(cx - 30, cy, 1)
    const startB = make(cx + 30, cy, 2)
    el.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [startA, startB],
        targetTouches: [startA, startB],
        changedTouches: [startA, startB],
      }),
    )

    const dist = mode === "in" ? 200 : 5 // zoom in by spreading, zoom out by pinching
    const moveA = make(cx - dist / 2, cy, 1)
    const moveB = make(cx + dist / 2, cy, 2)
    el.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [moveA, moveB],
        targetTouches: [moveA, moveB],
        changedTouches: [moveA, moveB],
      }),
    )

    el.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: [moveA, moveB],
      }),
    )
  }, mode)
}

test("pinch-out scales the board larger", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // Capture the board card's transform before pinch.
  const before = await page.evaluate(() => {
    const card = document.querySelector(".origin-top-left") as HTMLElement
    return card?.style.transform || ""
  })
  await pinch(page, "in")
  const after = await page.evaluate(() => {
    const card = document.querySelector(".origin-top-left") as HTMLElement
    return card?.style.transform || ""
  })
  // Transform string changed and now indicates a larger scale.
  expect(after).not.toBe(before)
  expect(after).toMatch(/scale\(/)
  // Parse out the number — pinch-out should make it > 1.
  const m = after.match(/scale\(([\d.]+)\)/)
  expect(m).not.toBeNull()
  expect(Number(m![1])).toBeGreaterThan(1.2)
})

test("reset-zoom chip appears after pinch and snaps back to scale 1", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // No chip at neutral zoom.
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveCount(0)
  await pinch(page, "in")
  const reset = page.getByRole("button", { name: "Reset zoom" })
  await expect(reset).toBeVisible()
  await reset.click()
  await expect(reset).toHaveCount(0)
  const scale = await page.evaluate(() => {
    const card = document.querySelector(".origin-top-left") as HTMLElement
    const m = card?.style.transform.match(/scale\(([\d.]+)\)/)
    return m ? Number(m[1]) : 0
  })
  expect(scale).toBeCloseTo(1, 2)
})
