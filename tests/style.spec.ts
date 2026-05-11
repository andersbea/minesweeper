import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, waitForAnimations } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("level badge and modifier name appear in the playbar", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // The badge text format is two-digit, e.g. "01".
  const badge = page.getByLabel(/Level \d+/)
  await expect(badge).toBeVisible()
  await expect(badge).toHaveText(/^\d{2}$/)
  // Modifier name (Calm / Fog / Twin / etc.) lives next to the badge.
  await expect(
    page.locator("text=/Calm|Fog|Bonus|Twin|Quick|Dense/").first(),
  ).toBeVisible()
})

test("playbar level badge has a gradient background", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  const bg = await page.getByLabel(/Level \d+/).evaluate((el) => getComputedStyle(el).background)
  // Tailwind compiles the inline `linear-gradient(...)` into the background
  // shorthand. We only need to confirm a gradient is actually applied.
  expect(bg).toMatch(/linear-gradient/)
  expect(bg).toMatch(/oklch/)
})

test("revealed numbers use distinct colors per value", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Cell 5,5").click()
  const colors = await page.evaluate(() => {
    const seen: Record<number, string> = {}
    for (const b of Array.from(document.querySelectorAll("button[aria-label^='Cell ']"))) {
      const text = (b.textContent || "").trim()
      const n = Number(text)
      if (!Number.isFinite(n) || n < 1 || n > 8) continue
      if (seen[n]) continue
      const span = b.querySelector("span.cell-pop") as HTMLElement | null
      if (span) seen[n] = getComputedStyle(span).color
    }
    return seen
  })
  // We expect at least two distinct numbers to appear, and their colours to differ.
  const values = Object.values(colors)
  expect(values.length).toBeGreaterThanOrEqual(2)
  const unique = new Set(values)
  expect(unique.size).toBe(values.length)
})

test("menu sheet anchors at the bottom and is horizontally centred", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Open menu").click()
  const dialog = page.getByRole("dialog", { name: "Game menu" })
  await expect(dialog).toBeVisible()
  await waitForAnimations(page)
  const data = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]") as HTMLElement
    const r = d.getBoundingClientRect()
    return {
      bottom: r.bottom,
      width: r.width,
      vw: window.innerWidth,
      vh: window.innerHeight,
      left: r.left,
      right: r.right,
    }
  })
  // Bottom edge sits flush at the viewport bottom.
  expect(Math.abs(data.bottom - data.vh)).toBeLessThan(2)
  // Horizontally centred (within 1px tolerance).
  expect(Math.abs(data.left - (data.vw - data.right))).toBeLessThan(2)
})

test("menu sheet unmounts when closed (no offscreen DOM)", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // Closed by default → dialog should not exist.
  await expect(page.getByRole("dialog", { name: "Game menu" })).toHaveCount(0)
  await page.getByLabel("Open menu").click()
  await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible()
  await page.getByLabel("Close menu").click()
  // Wait past the 320ms unmount delay.
  await page.waitForTimeout(450)
  await expect(page.getByRole("dialog", { name: "Game menu" })).toHaveCount(0)
})

test("flag-mode toggle changes its computed appearance", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  const off = await page
    .getByLabel("Switch to flag mode")
    .evaluate((el) => getComputedStyle(el).borderColor)
  await page.getByLabel("Switch to flag mode").click()
  const on = await page
    .getByLabel("Switch to reveal mode")
    .evaluate((el) => getComputedStyle(el).borderColor)
  expect(on).not.toBe(off)
})

test("body background contains the round's gradient palette", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage)
  expect(bg).toMatch(/radial-gradient/)
  // The CSS uses `oklch(...)` colours, so the computed value should expose
  // some oklch-derived rgba expressions.
  expect(bg.length).toBeGreaterThan(50)
})

test("desktop and mobile both render exactly one playbar above the board", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  // A board grid exists.
  const cellCount = await page.locator("button[aria-label^='Cell ']").count()
  expect(cellCount).toBeGreaterThanOrEqual(81) // at least 9×9
  // Exactly one menu open button visible (i.e. one PlayBar).
  await expect(page.getByLabel("Open menu")).toHaveCount(1)
})
