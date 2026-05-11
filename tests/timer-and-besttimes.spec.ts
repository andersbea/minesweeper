import { test, expect } from "@playwright/test"
import { dismissIntro, freshSession, setPersisted, waitForAnimations } from "./_helpers"

test.beforeEach(async ({ page }) => {
  await freshSession(page)
})

test.describe("timer pause", () => {
  // Read MM:SS off the playbar timer (the only "00:00"-shaped element on the
  // top bar). This is more reliable than role-based locators.
  async function readPlayBarSeconds(page: import("@playwright/test").Page) {
    return await page.evaluate(() => {
      const text = document.body.innerText
      const m = text.match(/\b(\d{2}):(\d{2})\b/)
      if (!m) return -1
      return Number(m[1]) * 60 + Number(m[2])
    })
  }

  test("timer pauses while the menu is open and resumes when closed", async ({ page }) => {
    await page.goto("/")
  await dismissIntro(page)
    // First click → starts the timer.
    await page.getByLabel("Cell 5,5").click()
    await page.waitForTimeout(1100)
    const beforeMenu = await readPlayBarSeconds(page)
    expect(beforeMenu).toBeGreaterThanOrEqual(1)

    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)

    // Wait while the menu is open — the timer must NOT advance.
    await page.waitForTimeout(2200)
    const whileOpen = await readPlayBarSeconds(page)
    expect(whileOpen, "timer should not advance while menu is open").toBeLessThanOrEqual(
      beforeMenu + 1,
    )

    await page.getByLabel("Close menu").click()
    // Wait for slide-down animation + a real second of play.
    await page.waitForTimeout(1300)
    const afterClose = await readPlayBarSeconds(page)
    expect(afterClose, "timer should resume after close").toBeGreaterThan(whileOpen)
  })
})

test.describe("best times", () => {
  test("persisted best times appear next to unlocked modifier tiles", async ({ page }) => {
    await setPersisted(page, {
      "ms.unlockedModifiers": ["calm", "fog"],
      "ms.bestTimes": { calm: 42, fog: 125 }, // 00:42 and 02:05
    })
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    // Calm tile: best 00:42
    const calmTile = page.getByRole("group", { name: "Calm" })
    await expect(calmTile).toContainText("00:42")
    // Fog tile: best 02:05
    const fogTile = page.getByRole("group", { name: "Fog" })
    await expect(fogTile).toContainText("02:05")
  })

  test("locked modifiers never show a best-time chip", async ({ page }) => {
    await setPersisted(page, {
      "ms.unlockedModifiers": [],
      // bestTimes shouldn't be readable because nothing is unlocked.
      "ms.bestTimes": { calm: 30 },
    })
    await page.goto("/")
  await dismissIntro(page)
    await page.getByLabel("Open menu").click()
    await waitForAnimations(page)
    await page.getByRole("button", { name: "Open modifiers list" }).click()

    // No locked tile contains an MM:SS pattern.
    const lockedTiles = page.locator('[data-unlocked="false"]')
    const count = await lockedTiles.count()
    for (let i = 0; i < count; i++) {
      const text = await lockedTiles.nth(i).innerText()
      expect(text).not.toMatch(/\d{2}:\d{2}/)
    }
  })
})
