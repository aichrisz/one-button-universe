import { describe, it, expect } from 'vitest'
import { ACHIEVEMENTS, newlyUnlocked } from './achievements'
import { EMPTY_PROGRESS } from './progress'

describe('achievements', () => {
  it('has unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('unlocks first-light at one star', () => {
    const fresh = newlyUnlocked(new Set(), { ...EMPTY_PROGRESS, starsFormed: 1 })
    expect(fresh.map((a) => a.id)).toContain('first-light')
  })
  it('does not re-unlock', () => {
    const fresh = newlyUnlocked(new Set(['first-light']), { ...EMPTY_PROGRESS, starsFormed: 1 })
    expect(fresh.map((a) => a.id)).not.toContain('first-light')
  })
  it('omniverse needs all four endings', () => {
    const three = newlyUnlocked(new Set(), { ...EMPTY_PROGRESS, endingsSeen: ['stable', 'collapse', 'heat'] })
    expect(three.map((a) => a.id)).not.toContain('omniverse')
    const four = newlyUnlocked(new Set(), { ...EMPTY_PROGRESS, endingsSeen: ['stable', 'collapse', 'heat', 'chaos'] })
    expect(four.map((a) => a.id)).toContain('omniverse')
  })
})
