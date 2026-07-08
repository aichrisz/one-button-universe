import { describe, it, expect } from 'vitest'
import { MISSIONS, nextMission } from './missions'
import { EMPTY_PROGRESS } from './progress'

describe('missions', () => {
  it('has six missions', () => {
    expect(MISSIONS.length).toBe(6)
  })
  it('starts at tap mission', () => {
    expect(nextMission(EMPTY_PROGRESS)?.id).toBe('m-tap')
  })
  it('advances in order', () => {
    const p = { ...EMPTY_PROGRESS, taps: 5 }
    expect(nextMission(p)?.id).toBe('m-star')
  })
  it('returns null when all done', () => {
    const p = {
      ...EMPTY_PROGRESS,
      taps: 5,
      starsFormed: 1,
      planetsCaptured: 1,
      supernovae: 1,
      holesFormed: 1,
      endingsSeen: ['chaos' as const],
    }
    expect(nextMission(p)).toBeNull()
  })
})
