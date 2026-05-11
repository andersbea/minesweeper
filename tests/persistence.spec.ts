import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, setPersisted } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test("currentLevel is restored on reload", async ({ page }) => {
  await setPersisted(page, { "ms.currentLevel": 7 })
  await page.goto("/")
  await dismissIntro(page)
  await expect(page.getByLabel("Level 7")).toBeVisible()
})

test("flag-mode toggle persists across reload", async ({ page }) => {
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Switch to flag mode").click()
  await expect(page.getByLabel("Switch to reveal mode")).toBeVisible()
  await page.reload()
  await expect(page.getByLabel("Switch to reveal mode")).toBeVisible()
})

test("best level value persists and shows in HUD", async ({ page }) => {
  await setPersisted(page, { "ms.bestLevel": 12 })
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Open menu").click()
  // The HUD card with "Best Lv." renders the value in a sibling span.
  const card = page.locator("text=Best Lv.").locator("xpath=..")
  await expect(card).toContainText("12")
})

test("streak counter shows in menu and resets on new run", async ({ page }) => {
  await setPersisted(page, { "ms.streak": 3, "ms.totalWins": 5 })
  await page.goto("/")
  await dismissIntro(page)
  await page.getByLabel("Open menu").click()
  await expect(page.getByText("Streak 3")).toBeVisible()
  await expect(page.getByText("5 total wins")).toBeVisible()
  await page.getByRole("button", { name: "New run" }).click()
  // A new round starts → ready overlay reappears.
  await dismissIntro(page)
  // After "New run" the streak resets to 0.
  await page.getByLabel("Open menu").click()
  await expect(page.getByText("Streak 0")).toBeVisible()
})
