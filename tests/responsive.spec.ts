import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, expectNoOverflow, waitForAnimations } from "./_helpers"

const VIEWPORTS = [
  { name: "small mobile", w: 320, h: 568 }, // iPhone SE 1st gen
  { name: "phone", w: 390, h: 844 }, // iPhone 13/14
  { name: "phone landscape", w: 844, h: 390 },
  { name: "tablet portrait", w: 768, h: 1024 }, // iPad mini
  { name: "tablet landscape", w: 1024, h: 768 },
  { name: "laptop", w: 1280, h: 800 },
  { name: "desktop", w: 1440, h: 900 },
  { name: "large desktop", w: 1920, h: 1080 },
  { name: "ultra-wide", w: 2560, h: 1440 },
]

test.describe("responsive layout", () => {
  test.beforeEach(async ({ page }) => {
    await freshSession(page)
  })

  for (const { name, w, h } of VIEWPORTS) {
    test(`${name} (${w}×${h}): no overflow on initial load`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto("/")
  await dismissIntro(page)
      await page.waitForSelector("button[aria-label='Cell 1,1']")
      await expectNoOverflow(page)
    })

    test(`${name} (${w}×${h}): no overflow with menu open`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto("/")
  await dismissIntro(page)
      await page.getByLabel("Open menu").click()
      await waitForAnimations(page)
      await expectNoOverflow(page)
    })

    test(`${name} (${w}×${h}): board renders ≥ 9×9 grid and fits inside viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto("/")
  await dismissIntro(page)
      await page.waitForSelector("button[aria-label='Cell 1,1']")

      const data = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll("button[aria-label^='Cell ']"))
        const sizes = cells.map((b) => {
          const r = b.getBoundingClientRect()
          return { w: r.width, h: r.height }
        })
        return { count: cells.length, sizes }
      })

      expect(data.count).toBeGreaterThanOrEqual(9 * 9)
      // All cells should be square within rounding.
      for (const s of data.sizes) {
        expect(Math.abs(s.w - s.h)).toBeLessThanOrEqual(1)
        expect(s.w).toBeGreaterThanOrEqual(18)
        expect(s.w).toBeLessThanOrEqual(48)
      }
    })

    test(`${name} (${w}×${h}): playbar stays a single row`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto("/")
  await dismissIntro(page)
      const playbarHeight = await page
        .getByLabel("Open menu")
        .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]")
        .evaluate((el) => el.getBoundingClientRect().height)
      // Single-row PlayBar should never exceed ~56px (28px icon + padding).
      expect(playbarHeight).toBeLessThan(72)
    })

    test(`${name} (${w}×${h}): menu sheet anchors at the bottom and centers`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h })
      await page.goto("/")
  await dismissIntro(page)
      await page.getByLabel("Open menu").click()
      await waitForAnimations(page)
      const data = await page.evaluate(() => {
        const d = document.querySelector("[role=dialog]")!
        const r = d.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          vw: window.innerWidth,
          vh: window.innerHeight,
        }
      })
      // Bottom edge flush with viewport bottom.
      expect(Math.abs(data.bottom - data.vh)).toBeLessThan(2)
      // Horizontally centered (within 1px tolerance).
      expect(Math.abs(data.left - (data.vw - data.right))).toBeLessThan(2)
      // On large viewports the sheet must respect max-w-2xl (= 672px).
      if (data.vw > 700) {
        expect(data.width).toBeLessThanOrEqual(672 + 1)
      } else {
        // On small screens the sheet should span (almost) the full width.
        expect(data.width).toBeGreaterThan(data.vw * 0.9)
      }
    })
  }
})

test.describe("menu animation", () => {
  test.beforeEach(async ({ page }) => {
    await freshSession(page)
  })

  test("sheet slides up from the bottom on open", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()

    // Confirm via the Web Animations API that a slide-up keyframe is running.
    const info = await page.waitForFunction(() => {
      const d = document.querySelector("[role=dialog]")
      if (!d) return null
      const anims = (d as Element).getAnimations()
      if (anims.length === 0) return null
      const a = anims[0]
      const kf = (a as { animationName?: string }).animationName
      return { name: kf, hasKeyframes: typeof a.effect?.getKeyframes === "function" }
    })
    const data = await info.evaluate((v) => v as { name: string; hasKeyframes: boolean })
    expect(data.name).toBe("sheet-slide-up")

    // After it finishes, the sheet must be at translate-y-0 (bottom flush).
    await waitForAnimations(page)
    const final = await page.evaluate(() => {
      const d = document.querySelector("[role=dialog]") as HTMLElement
      return { bottom: d.getBoundingClientRect().bottom, vh: window.innerHeight }
    })
    expect(Math.abs(final.bottom - final.vh)).toBeLessThan(2)
  })

  test("sheet slides down on close", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page) // fully open

    await page.getByLabel("Close menu").click()
    // After close, the dialog flips to the `sheet-exit` class, which applies
    // the slide-down keyframe.
    await expect(page.getByRole("dialog", { name: "Game menu" })).toHaveClass(/sheet-exit/, {
      timeout: 1000,
    })
  })
})
