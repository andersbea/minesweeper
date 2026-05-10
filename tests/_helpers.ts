import { type Page, expect } from "@playwright/test"

export interface CellState {
  hidden: number
  flagged: number
  revealedNumber: number
  revealedEmpty: number
  revealedMine: number
  total: number
}

/**
 * Pin Math.random so palette/modifier/mine placement are stable across runs.
 * Each Playwright test gets a fresh browser context with empty localStorage,
 * so we don't need to wipe it ourselves — and we shouldn't, since
 * `addInitScript` runs on every navigation (which would defeat persistence
 * tests that rely on state surviving a reload).
 */
export async function freshSession(page: Page) {
  await page.addInitScript(() => {
    let seed = 1
    Math.random = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
  })
}

export async function setPersisted(page: Page, kv: Record<string, unknown>) {
  await page.addInitScript((entries) => {
    for (const [k, v] of entries) {
      window.localStorage.setItem(k, JSON.stringify(v))
    }
  }, Object.entries(kv))
}

export async function readBoard(page: Page) {
  return await page.evaluate(() => {
    const rows = []
    let r = 1
    while (true) {
      const row: { r: number; c: number; state: string; n?: number }[] = []
      let c = 1
      while (true) {
        const b = document.querySelector(`button[aria-label='Cell ${r},${c}']`)
        if (!b) break
        const cls = (b as HTMLElement).className
        const txt = (b.textContent || "").trim()
        const hasFlag = !!b.querySelector("svg.lucide-flag")
        const hasMine = !!b.querySelector("svg.lucide-bomb")
        let state: string
        if (hasFlag) state = "flag"
        else if (hasMine) state = "mine"
        else if (cls.includes("color-surface-2")) state = "hidden"
        else if (txt) state = "number"
        else state = "empty"
        row.push({ r, c, state, n: txt ? Number(txt) : undefined })
        c++
      }
      if (row.length === 0) break
      rows.push(row)
      r++
    }
    return rows
  })
}

export function summarize(board: Awaited<ReturnType<typeof readBoard>>): CellState {
  const out: CellState = {
    hidden: 0,
    flagged: 0,
    revealedNumber: 0,
    revealedEmpty: 0,
    revealedMine: 0,
    total: 0,
  }
  for (const row of board) {
    for (const cell of row) {
      out.total++
      if (cell.state === "hidden") out.hidden++
      else if (cell.state === "flag") out.flagged++
      else if (cell.state === "number") out.revealedNumber++
      else if (cell.state === "empty") out.revealedEmpty++
      else if (cell.state === "mine") out.revealedMine++
    }
  }
  return out
}

/**
 * Wait for all CSS animations on `selector` (and its descendants) to finish.
 * Used after triggering enter/exit animations so geometry is measured at rest.
 */
export async function waitForAnimations(page: Page, selector = "[role=dialog]") {
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel)
    if (!el) return false
    const anims = (el as Element).getAnimations({ subtree: true })
    return anims.length > 0 && anims.every((a) => a.playState === "finished")
  }, selector, { timeout: 2000 })
}

export async function expectNoOverflow(page: Page) {
  // Poll: ResizeObserver-driven layouts can take a couple of frames to settle
  // after a viewport change. Retry briefly before declaring overflow.
  await expect(async () => {
    const data = await page.evaluate(() => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const offenders: { tag: string; cls: string; w: number; h: number }[] = []
      // Children of scrollable containers (e.g. the menu sheet's
      // overflow-y-auto body) can sit beyond the viewport because the
      // scroll-clip hides them; that's not a layout bug.
      const isInsideScrollContainer = (el: Element) => {
        let p: Element | null = el.parentElement
        while (p) {
          const cs = getComputedStyle(p)
          if (
            cs.overflowY === "auto" ||
            cs.overflowY === "scroll" ||
            cs.overflowX === "auto" ||
            cs.overflowX === "scroll"
          )
            return true
          p = p.parentElement
        }
        return false
      }
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 || r.bottom > vh + 1) {
          if (isInsideScrollContainer(el)) continue
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: ((el as HTMLElement).className?.toString?.() ?? "").slice(0, 80),
            w: Math.round(r.width),
            h: Math.round(r.height),
          })
        }
      }
      return {
        vw,
        vh,
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        offenders,
      }
    })
    expect(data.offenders, `${data.offenders.length} elements overflow viewport`).toEqual([])
    expect(data.docW).toBeLessThanOrEqual(data.vw)
    expect(data.docH).toBeLessThanOrEqual(data.vh)
  }).toPass({ timeout: 2000 })
}
