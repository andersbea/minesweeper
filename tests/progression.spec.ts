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

test.describe("modifier achievements", () => {
  test("all 6 modifiers are listed but locked by default", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    // Six modifier slots in the achievement grid.
    const slots = page.getByRole("group", { name: /modifier|Locked modifier/ })
    await expect(slots).toHaveCount(6)
    // None unlocked → all should display as "???".
    const lockedCount = await page.locator('[data-unlocked="false"]').count()
    expect(lockedCount).toBe(6)
    await expect(page.getByText("0/6")).toBeVisible()
  })

  test("unlocked modifiers reveal their name and description", async ({ page }) => {
    await setPersisted(page, { "ms.unlockedModifiers": ["calm", "fog"] })
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    await expect(page.getByText("2/6")).toBeVisible()
    // Unlocked tiles show real names.
    await expect(page.getByRole("group", { name: "Calm" })).toBeVisible()
    await expect(page.getByRole("group", { name: "Fog" })).toBeVisible()
    // Locked tiles still show "???".
    const locked = await page.locator('[data-unlocked="false"]').count()
    expect(locked).toBe(4)
  })

  test("locked tiles render with a Lock icon and dashed border", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    const locked = page.locator('[data-unlocked="false"]').first()
    await expect(locked.locator("svg.lucide-lock")).toBeVisible()
    const borderStyle = await locked.evaluate((el) => getComputedStyle(el).borderStyle)
    expect(borderStyle).toContain("dashed")
  })
})
