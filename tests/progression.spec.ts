import { test, expect } from "@playwright/test"
import { freshSession, setPersisted, waitForAnimations } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test.describe("level picker", () => {
  test("shows only level 1 by default (nothing cleared yet)", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await expect(page.getByLabel("Start at level 1")).toBeVisible()
    await expect(page.getByLabel("Start at level 2")).toHaveCount(0)
    await expect(page.getByText("Clear levels to unlock more")).toBeVisible()
  })

  test("unlocks levels up to maxCleared + 1", async ({ page }) => {
    await setPersisted(page, { "ms.maxClearedLevel": 4 })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    // Levels 1..5 should all be selectable.
    for (let lvl = 1; lvl <= 5; lvl++) {
      await expect(page.getByLabel(`Start at level ${lvl}`)).toBeVisible()
    }
    // Level 6 should NOT be visible — it's still locked.
    await expect(page.getByLabel("Start at level 6")).toHaveCount(0)
    await expect(page.getByText("Cleared up to 4")).toBeVisible()
  })

  test("clicking a level button starts that level", async ({ page }) => {
    await setPersisted(page, { "ms.maxClearedLevel": 5 })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await page.getByLabel("Start at level 4").click()
    // The dialog should close and the playbar should now show level 4.
    await expect(page.getByLabel("Level 4", { exact: true })).toBeVisible()
  })

  test("the current level is highlighted as 'aria-current'", async ({ page }) => {
    await setPersisted(page, { "ms.currentLevel": 3, "ms.maxClearedLevel": 5 })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await expect(page.getByLabel("Start at level 3")).toHaveAttribute("aria-current", "true")
    await expect(page.getByLabel("Start at level 1")).not.toHaveAttribute("aria-current", /.+/)
  })
})

test.describe("modifier achievements subpage", () => {
  test("main menu shows a 'Modifiers' entry with x/y discovered count", async ({ page }) => {
    await setPersisted(page, { "ms.unlockedModifiers": ["calm"] })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    const entry = page.getByRole("button", { name: "Open modifiers list" })
    await expect(entry).toBeVisible()
    await expect(entry).toContainText("1 of 6 discovered")
    // The grid itself should NOT be visible on the main view.
    await expect(page.getByRole("group", { name: /Locked modifier|Calm/ })).toHaveCount(0)
  })

  test("clicking the entry navigates to the modifiers subpage", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await page.getByRole("button", { name: "Open modifiers list" }).click()
    // Subpage header
    await expect(page.getByRole("heading", { name: "Modifiers" })).toBeVisible()
    await expect(page.getByLabel("Back to menu")).toBeVisible()
    // All 6 modifier slots now visible in the grid.
    await expect(page.getByRole("group", { name: /Locked modifier|Calm|Fog|Bonus|Twin|Quick|Dense/ })).toHaveCount(6)
  })

  test("back button returns to main menu view", async ({ page }) => {
    await page.goto("/")
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
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    const lockedCount = await page.locator('[data-unlocked="false"]').count()
    expect(lockedCount).toBe(6)
    // The Badge in the subpage header shows "0/6".
    await expect(page.getByText("0/6")).toBeVisible()
  })

  test("unlocked modifiers reveal their name and description", async ({ page }) => {
    await setPersisted(page, { "ms.unlockedModifiers": ["calm", "fog"] })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    await expect(page.getByText("2/6")).toBeVisible()
    await expect(page.getByRole("group", { name: "Calm" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Fog" })).toBeVisible()
    const locked = await page.locator('[data-unlocked="false"]').count()
    expect(locked).toBe(4)
  })

  test("locked tiles render with a Lock icon and dashed border", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    const locked = page.locator('[data-unlocked="false"]').first()
    await expect(locked.locator("svg.lucide-lock")).toBeVisible()
    const borderStyle = await locked.evaluate((el) => getComputedStyle(el).borderStyle)
    expect(borderStyle).toContain("dashed")
  })
})
