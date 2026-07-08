import { describe, it, expect } from 'vitest'
import { EMPTY_PROGRESS, applyEvents } from './progress'
import type { UniverseEvent } from './universe'

describe('applyEvents', () => {
  it('counts events', () => {
    const evs: UniverseEvent[] = [
      { kind: 'tap' },
      { kind: 'tap' },
      { kind: 'star-formed' },
      { kind: 'supernova' },
      { kind: 'star-split' },
      { kind: 'black-hole-formed' },
      { kind: 'black-hole-merged' },
      { kind: 'black-hole-evaporated' },
      { kind: 'star-swallowed' },
      { kind: 'planet-captured' },
    ]
    const p = applyEvents(EMPTY_PROGRESS, evs)
    expect(p.taps).toBe(2)
    expect(p.starsFormed).toBe(1)
    expect(p.supernovae).toBe(2) // star-split counts as supernova too
    expect(p.splits).toBe(1)
    expect(p.holesFormed).toBe(1)
    expect(p.holesMerged).toBe(1)
    expect(p.evaporations).toBe(1)
    expect(p.starsSwallowed).toBe(1)
    expect(p.planetsCaptured).toBe(1)
  })
  it('records endings once each', () => {
    const p = applyEvents(EMPTY_PROGRESS, [
      { kind: 'ending', ending: 'stable' },
      { kind: 'ending', ending: 'stable' },
      { kind: 'ending', ending: 'chaos' },
    ])
    expect(p.endingsSeen).toEqual(['stable', 'chaos'])
  })
  it('does not mutate input', () => {
    const before = { ...EMPTY_PROGRESS }
    applyEvents(EMPTY_PROGRESS, [{ kind: 'tap' }])
    expect(EMPTY_PROGRESS).toEqual(before)
  })
})
