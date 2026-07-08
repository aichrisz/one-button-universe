import { describe, it, expect, beforeEach } from 'vitest'
import { load, loadWithGuard, save } from './storage'

const mem = new Map<string, string>()
beforeEach(() => {
  mem.clear()
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage
})

describe('storage', () => {
  it('returns fallback when key missing', () => {
    expect(load('nope', 42)).toBe(42)
  })
  it('round-trips values', () => {
    save('x', { a: 1 })
    expect(load('x', { a: 0 })).toEqual({ a: 1 })
  })
  it('returns fallback on corrupt json', () => {
    mem.set('obu.v2.bad', '{{{')
    expect(load('bad', 'ok')).toBe('ok')
  })
  it('namespaces keys', () => {
    save('k', 1)
    expect(mem.has('obu.v2.k')).toBe(true)
  })
  it('guards parsed data shape', () => {
    save('ids', 'not an array')
    expect(loadWithGuard('ids', [] as string[], Array.isArray)).toEqual([])
  })
})
