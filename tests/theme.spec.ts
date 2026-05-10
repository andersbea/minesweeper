import { test, expect } from "@playwright/test"
import { freshSession, setPersisted } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("default theme is dark", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})

test("toggle switches html data-theme between dark and light", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Open menu").click()
  await page.getByLabel("Switch to light mode").click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  await page.getByLabel("Switch to dark mode").click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
})

test("body computed background tracks the theme", async ({ page }) => {
  await page.goto("/")
  // Read html bg (which is solid `--color-bg`) — easier to assert than the
  // body's gradient stack.
  const darkBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  await page.getByLabel("Open menu").click()
  await page.getByLabel("Switch to light mode").click()
  const lightBg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
  expect(darkBg).not.toBe(lightBg)
  // Dark mode lightness should be lower than light mode (rough proxy via R+G+B).
  const lum = (rgb: string) => {
    const m = rgb.match(/(\d+\.?\d*)[,\s]+(\d+\.?\d*)[,\s]+(\d+\.?\d*)/)
    if (!m) return 0
    return Number(m[1]) + Number(m[2]) + Number(m[3])
  }
  expect(lum(lightBg)).toBeGreaterThan(lum(darkBg))
})

test("theme choice survives reload", async ({ page }) => {
  await setPersisted(page, { "ms.theme": "light" })
  await page.goto("/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
})
