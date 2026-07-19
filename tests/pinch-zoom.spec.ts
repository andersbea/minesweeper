import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

/**
 * Dispatch a two-finger gesture on the board scroll container.
 * Simulates touchstart with 2 touches, then a touchmove changing the
 * distance between them (and optionally the centroid). Pinches around the
 * given focal point, defaulting to the scroll container's own center.
 */
async function pinch(
  page: import("@playwright/test").Page,
  mode: "in" | "out",
  focal?: { x: number; y: number },
) {
  await page.evaluate(
    ({ mode, focal }: { mode: "in" | "out"; focal?: { x: number; y: number } }) => {
      const el = document.querySelector(".overflow-auto") as HTMLElement
      if (!el) throw new Error("scroll container not found")
      const rect = el.getBoundingClientRect()
      const cx = focal?.x ?? rect.left + rect.width / 2
      const cy = focal?.y ?? rect.top + rect.height / 2

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
    },
    { mode, focal },
  )
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

test("pinch anchors the zoom at the pinch center — the same cell stays under the fingers", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)

  // Pinch focused on a specific cell's own center (level 1 is a 9x9 board,
  // so this is roughly the middle) rather than the scroll container's raw
  // geometric center — the latter can land exactly on a hairline gap
  // between cells depending on viewport/cell-size rounding, which isn't a
  // real bug, just an unlucky pixel for this assertion to rely on.
  const target = page.getByLabel("Cell 5,5")
  const box = await target.boundingBox()
  if (!box) throw new Error("Cell 5,5 not found")
  const focal = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  const cellAtFocal = async () =>
    page.evaluate(
      (p) => document.elementFromPoint(p.x, p.y)?.closest("button[data-row]")?.getAttribute("aria-label") ?? null,
      focal,
    )

  const before = await cellAtFocal()
  expect(before).toBe("Cell 5,5")
  await pinch(page, "in", focal)
  // The pinch is centered on the same point, so whichever cell was under
  // it before should still be under it after — that's the whole point of
  // anchoring the zoom to the pinch center rather than, say, the board's
  // top-left corner.
  const after = await cellAtFocal()
  expect(after).toBe(before)
})
