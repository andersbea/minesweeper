import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, expectNoOverflow } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("page fills the viewport exactly with no scroll overflow", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.waitForSelector("button[aria-label='Cell 1,1']")
  await expectNoOverflow(page)
})

test("page fills viewport after orientation/resize", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.waitForSelector("button[aria-label='Cell 1,1']")
  await page.setViewportSize({ width: 1024, height: 768 })
  await expectNoOverflow(page)
  await page.setViewportSize({ width: 360, height: 740 })
  await expectNoOverflow(page)
})

test("html, body, root all carry the same height", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  const sizes = await page.evaluate(() => ({
    html: document.documentElement.getBoundingClientRect().height,
    body: document.body.getBoundingClientRect().height,
    root: document.getElementById("root")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
  }))
  expect(sizes.html).toBe(sizes.viewport)
  expect(sizes.body).toBe(sizes.viewport)
  expect(sizes.root).toBe(sizes.viewport)
})

test("playbar shows level, modifier, mines, timer", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await expect(page.getByLabel(/Level \d+/)).toBeVisible()
  // Open menu — should reveal stat cards.
  await page.getByLabel("Open menu").click()
  // Stat labels live in DOM as title-case ("Level", "Mines"…) and are
  // CSS-uppercased visually.
  await expect(page.getByText("Level", { exact: true })).toBeVisible()
  await expect(page.getByText("Mines", { exact: true })).toBeVisible()
  await expect(page.getByText("Time", { exact: true })).toBeVisible()
  await expect(page.getByText("Best Lv.")).toBeVisible()
})

test("PWA manifest is linked and contains the required fields", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  const manifestHref = await page.getAttribute("link[rel=manifest]", "href")
  expect(manifestHref).toBeTruthy()

  const response = await page.request.get(manifestHref!)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest.name).toMatch(/Minesweeper/i)
  expect(manifest.display).toBe("standalone")
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "192x192")).toBe(true)
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true)
})
