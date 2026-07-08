import { describe, it, expect } from 'vitest'
import { CODEX, unlockCodex } from './codex'
import type { UniverseEvent } from './universe'

describe('codex', () => {
  it('has unique ids', () => {
    const ids = CODEX.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('unlocks star entry on star-formed', () => {
    const { seen, fresh } = unlockCodex([], [{ kind: 'star-formed' }])
    expect(seen).toContain('cx-star')
    expect(fresh.map((c) => c.id)).toEqual(['cx-star'])
  })
  it('unlocks ending entries by kind', () => {
    const evs: UniverseEvent[] = [{ kind: 'ending', ending: 'heat' }]
    const { seen } = unlockCodex([], evs)
    expect(seen).toContain('cx-end-heat')
    expect(seen).not.toContain('cx-end-stable')
  })
  it('does not duplicate', () => {
    const { seen, fresh } = unlockCodex(['cx-star'], [{ kind: 'star-formed' }])
    expect(seen).toEqual(['cx-star'])
    expect(fresh).toEqual([])
  })
})
