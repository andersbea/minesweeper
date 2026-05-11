import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, setPersisted, waitForAnimations } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test.describe("modifier achievements subpage", () => {
  test("main menu shows a 'Modifiers' entry with x/y discovered count", async ({ page }) => {
    await setPersisted(page, { "ms.unlockedModifiers": ["calm"] })
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    const entry = page.getByRole("button", { name: "Open modifiers list" })
    await expect(entry).toBeVisible()
    await expect(entry).toContainText("1 of 8 discovered")
    // The grid itself should NOT be visible on the main view.
    await expect(page.getByRole("group", { name: /Locked modifier|Calm/ })).toHaveCount(0)
  })

  test("clicking the entry navigates to the modifiers subpage", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await page.getByRole("button", { name: "Open modifiers list" }).click()
    // Subpage header
    await expect(page.getByRole("heading", { name: "Modifiers" })).toBeVisible()
    await expect(page.getByLabel("Back to menu")).toBeVisible()
    // All 6 modifier slots now visible in the grid.
    await expect(page.getByRole("group", { name: /Locked modifier|Calm|Fog|Bonus|Twin|Quick|Dense|Big|Sniper/ })).toHaveCount(8)
  })

  test("back button returns to main menu view", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()
    await expect(page.getByLabel("Back to menu")).toBeVisible()
    await page.getByLabel("Back to menu").click()
    // Back on the main view: the entry button is visible again, the grid is gone.
    await expect(page.getByRole("button", { name: "Open modifiers list" })).toBeVisible()
    await expect(page.getByRole("group", { name: /Locked modifier|Calm/ })).toHaveCount(0)
  })

  test("re-opening the menu always lands on the main view", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()
    // Close while on the subpage.
    await page.getByLabel("Close menu").click()
    // Wait for unmount.
    await expect(page.getByRole("dialog", { name: "Game menu" })).toHaveCount(0)
    // Re-open.
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    // Should be back on the main view.
    await expect(page.getByRole("button", { name: "Open modifiers list" })).toBeVisible()
  })

  test("all 6 modifiers are locked by default on the subpage", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    const lockedCount = await page.locator('[data-unlocked="false"]').count()
    expect(lockedCount).toBe(8)
    // The Badge in the subpage header shows "0/8".
    await expect(page.getByText("0/8")).toBeVisible()
  })

  test("unlocked modifiers reveal their name and description", async ({ page }) => {
    await setPersisted(page, { "ms.unlockedModifiers": ["calm", "fog"] })
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    await expect(page.getByText("2/8")).toBeVisible()
    await expect(page.getByRole("group", { name: "Calm" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Fog" })).toBeVisible()
    const locked = await page.locator('[data-unlocked="false"]').count()
    expect(locked).toBe(6)
  })

  test("locked tiles render with a Lock icon and dashed border", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    const locked = page.locator('[data-unlocked="false"]').first()
    await expect(locked.locator("svg.lucide-lock")).toBeVisible()
    const borderStyle = await locked.evaluate((el) => getComputedStyle(el).borderStyle)
    expect(borderStyle).toContain("dashed")
  })
})
