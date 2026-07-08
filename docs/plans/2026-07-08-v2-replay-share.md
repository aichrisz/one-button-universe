# One Button Universe v2: Replay + Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give v1 universe replay value: achievements, codex, PNG share card, tutorial missions, sound, three modes, visual polish.

**Architecture:** Engine (`src/universe.ts`) gains an event queue (`drainEvents()`), a `ModeConfig` param, and small render polish. All meta systems (achievements, codex, missions) are pure functions over one shared `Progress` object, fed by drained events, persisted via a thin `storage.ts` wrapper. Audio is a self-contained WebAudio synth (no assets). Share card renders offscreen canvas from live game canvas plus stats text.

**Tech Stack:** Existing Vite + React + TypeScript. Add `vitest` (dev only) for pure-logic tests. No runtime deps. No backend.

**Style rules (from CLAUDE.md):** no em-dashes in visible copy, restrained palette (off-black, starlight white, cyan `121,223,230`, amber `240,182,97`), reduced motion honored, mobile friendly.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/storage.ts` | Create | Namespaced localStorage load/save, safe on quota/parse errors |
| `src/universe.ts` | Modify | Emit `UniverseEvent`s, accept `ModeConfig`, chaos random events, render polish |
| `src/modes.ts` | Create | `ModeConfig` definitions: classic, zen, challenge, chaos |
| `src/progress.ts` | Create | `Progress` type + `applyEvents()` pure reducer |
| `src/achievements.ts` | Create | Achievement defs + `newlyUnlocked()` |
| `src/codex.ts` | Create | Codex entry defs + `unlockCodex()` |
| `src/missions.ts` | Create | Tutorial mission defs + `nextMission()` |
| `src/sound.ts` | Create | WebAudio synth engine, hum loop, mute persisted |
| `src/share.ts` | Create | PNG card render + Web Share / download fallback |
| `src/App.tsx` | Modify | Wire events to systems, mode select, mute button, toasts, codex panel, mission banner, share button |
| `src/styles.css` | Modify | Styles for all new UI + polish |
| `src/progress.test.ts` | Create | Reducer tests |
| `src/achievements.test.ts` | Create | Unlock tests |
| `src/codex.test.ts` | Create | Codex unlock tests |
| `src/missions.test.ts` | Create | Mission order tests |
| `src/storage.test.ts` | Create | Round-trip + corrupt-data tests |
| `package.json` | Modify | Add `vitest`, `test` script |
| `tsconfig.app.json` | Modify | Exclude `src/**/*.test.ts` from build |

Dependency order: Task 1 (test infra) → 2 (events) → 3 (progress) → 4 (achievements) → 5 (codex) → 6 (missions) → 7 (wire UI) → 8 (sound) → 9 (modes) → 10 (share) → 11 (polish) → 12 (verify).

---

### Task 1: Test infra + storage helper

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.app.json`
- Create: `src/storage.ts`
- Test: `src/storage.test.ts`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add test script to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 3: Exclude tests from build tsconfig**

In `tsconfig.app.json` add (merge with existing keys if present):

```json
"exclude": ["src/**/*.test.ts"]
```

- [ ] **Step 4: Write failing test `src/storage.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { load, save } from './storage'

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
})
```

- [ ] **Step 5: Run test, verify fails**

Run: `npx vitest run src/storage.test.ts`
Expected: FAIL, cannot resolve `./storage`

- [ ] **Step 6: Implement `src/storage.ts`**

```typescript
// Thin namespaced localStorage wrapper. Never throws: quota errors and
// corrupt JSON fall back silently so the game keeps running.
const NS = 'obu.v2.'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    // storage full or unavailable: skip, meta progress is best-effort
  }
}
```

- [ ] **Step 7: Run tests, verify pass**

Run: `npx vitest run src/storage.test.ts`
Expected: 4 passed

- [ ] **Step 8: Verify build still clean**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.app.json src/storage.ts src/storage.test.ts
git commit -m "feat: add vitest and namespaced storage helper"
```

---

### Task 2: Engine event queue

**Files:**
- Modify: `src/universe.ts`

Engine emits events at each notable moment. UI drains once per stats tick. No behavior change to physics.

- [ ] **Step 1: Add event types near top of `src/universe.ts` (after `Ending` interface, ~line 10)**

```typescript
export type UniverseEventKind =
  | 'tap'
  | 'star-formed'
  | 'planet-captured'
  | 'supernova'
  | 'star-split'
  | 'black-hole-formed'
  | 'black-hole-merged'
  | 'black-hole-evaporated'
  | 'star-swallowed'
  | 'ending'

export interface UniverseEvent {
  kind: UniverseEventKind
  x?: number
  y?: number
  ending?: EndingKind
}
```

- [ ] **Step 2: Add queue field + emit + drain to `Universe` class (near `private fx: Fx[] = []`, ~line 124)**

```typescript
private events: UniverseEvent[] = []

private emit(kind: UniverseEventKind, x?: number, y?: number, ending?: EndingKind) {
  if (this.events.length < 64) this.events.push({ kind, x, y, ending })
}

drainEvents(): UniverseEvent[] {
  const out = this.events
  this.events = []
  return out
}
```

- [ ] **Step 3: Emit at each site.** Exact insert points in current `src/universe.ts`:

| Site | Location | Emit |
|---|---|---|
| `tap()` | after `this.entropy = ...` (~line 275) | `this.emit('tap', this.pointer.x, this.pointer.y)` |
| `supernova(star)` | start of method body (~line 298) | `this.emit(star.mass > 55 ? 'star-split' : 'supernova', star.x, star.y)` |
| `formBlackHole(x, y)` | after `this.holes.push(...)` (~line 339) | `this.emit('black-hole-formed', x, y)` |
| star swallowed by hole | inside `if (dist < 10 + ...)` block after `this.stars.splice(i, 1)` (~line 450) | `this.emit('star-swallowed', s.x, s.y)` |
| overweight star collapse | inside `if (s.mass > 120)` after `this.holes.push(...)` (~line 480) | `this.emit('black-hole-formed', s.x, s.y)` |
| hole merge | inside merge block after `this.holes.splice(k, 1)` (~line 503) | `this.emit('black-hole-merged', hle.x, hle.y)` |
| hole evaporate | inside `if (hle.mass < 6)` after `this.holes.splice(i, 1)` (~line 513) | `this.emit('black-hole-evaporated', hle.x, hle.y)` |
| planet captured | inside `if (taken >= 4)` after `s.planets.push(...)` (~line 548) | `this.emit('planet-captured', s.x, s.y)` |
| star formed | in `tryFormStars()` after `this.stars.push(...)` (~line 610) | `this.emit('star-formed', x, y)` |
| ending | in `checkEndings()`: every `this.ending = ENDINGS.X` assignment (5 sites, lines ~621, 625, 629, 633, 637-642) | add `this.emit('ending', undefined, undefined, this.ending.kind)` right after each assignment (for the final if/else chain, emit once after the chain: `if (this.ending) this.emit('ending', undefined, undefined, this.ending.kind)`) |

Also clear the queue in `reset()` (~line 189): `this.events = []`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 5: Smoke check in dev.** Run `npm run dev`, open console, temporarily `window.u = engine` not needed: instead verify by Task 7 wiring later. For now build passing is the gate.

- [ ] **Step 6: Commit**

```bash
git add src/universe.ts
git commit -m "feat: emit universe events from engine"
```

---

### Task 3: Progress reducer

**Files:**
- Create: `src/progress.ts`
- Test: `src/progress.test.ts`

One lifetime `Progress` object drives achievements AND missions. Pure reducer, no storage inside.

- [ ] **Step 1: Write failing test `src/progress.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx vitest run src/progress.test.ts`
Expected: FAIL, cannot resolve `./progress`

- [ ] **Step 3: Implement `src/progress.ts`**

```typescript
import type { EndingKind, UniverseEvent } from './universe'

export interface Progress {
  taps: number
  starsFormed: number
  planetsCaptured: number
  supernovae: number
  splits: number
  holesFormed: number
  holesMerged: number
  starsSwallowed: number
  evaporations: number
  endingsSeen: EndingKind[]
  universes: number
}

export const EMPTY_PROGRESS: Progress = {
  taps: 0,
  starsFormed: 0,
  planetsCaptured: 0,
  supernovae: 0,
  splits: 0,
  holesFormed: 0,
  holesMerged: 0,
  starsSwallowed: 0,
  evaporations: 0,
  endingsSeen: [],
  universes: 1,
}

export function applyEvents(prev: Progress, events: UniverseEvent[]): Progress {
  if (events.length === 0) return prev
  const p: Progress = { ...prev, endingsSeen: [...prev.endingsSeen] }
  for (const e of events) {
    switch (e.kind) {
      case 'tap': p.taps++; break
      case 'star-formed': p.starsFormed++; break
      case 'planet-captured': p.planetsCaptured++; break
      case 'supernova': p.supernovae++; break
      case 'star-split': p.supernovae++; p.splits++; break
      case 'black-hole-formed': p.holesFormed++; break
      case 'black-hole-merged': p.holesMerged++; break
      case 'black-hole-evaporated': p.evaporations++; break
      case 'star-swallowed': p.starsSwallowed++; break
      case 'ending':
        if (e.ending && !p.endingsSeen.includes(e.ending)) p.endingsSeen.push(e.ending)
        break
    }
  }
  return p
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/progress.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/progress.ts src/progress.test.ts
git commit -m "feat: progress reducer over universe events"
```

---

### Task 4: Achievements

**Files:**
- Create: `src/achievements.ts`
- Test: `src/achievements.test.ts`

- [ ] **Step 1: Write failing test `src/achievements.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx vitest run src/achievements.test.ts`
Expected: FAIL, cannot resolve `./achievements`

- [ ] **Step 3: Implement `src/achievements.ts`**

```typescript
import type { EndingKind } from './universe'
import type { Progress } from './progress'

export interface AchievementDef {
  id: string
  title: string
  desc: string
  test: (p: Progress) => boolean
}

const ALL_ENDINGS: EndingKind[] = ['stable', 'collapse', 'heat', 'chaos']

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-light', title: 'First Light', desc: 'Form your first star.', test: (p) => p.starsFormed >= 1 },
  { id: 'stellar-nursery', title: 'Stellar Nursery', desc: 'Form 10 stars across all universes.', test: (p) => p.starsFormed >= 10 },
  { id: 'gardener', title: 'Gardener of Worlds', desc: 'Stars capture 5 planets.', test: (p) => p.planetsCaptured >= 5 },
  { id: 'nova', title: 'Nova', desc: 'Trigger a supernova.', test: (p) => p.supernovae >= 1 },
  { id: 'binary', title: 'Binary', desc: 'Split a massive star in two.', test: (p) => p.splits >= 1 },
  { id: 'event-horizon', title: 'Event Horizon', desc: 'Compress matter into a black hole.', test: (p) => p.holesFormed >= 1 },
  { id: 'devourer', title: 'Devourer', desc: 'Feed a star to a black hole.', test: (p) => p.starsSwallowed >= 1 },
  { id: 'hawking', title: 'Hawking Whisper', desc: 'Watch a black hole evaporate.', test: (p) => p.evaporations >= 1 },
  { id: 'coalescence', title: 'Coalescence', desc: 'Merge two black holes.', test: (p) => p.holesMerged >= 1 },
  { id: 'end-stable', title: 'Architect', desc: 'Reach the Stable Galaxy ending.', test: (p) => p.endingsSeen.includes('stable') },
  { id: 'end-collapse', title: 'Abyss', desc: 'Reach the Black Hole Collapse ending.', test: (p) => p.endingsSeen.includes('collapse') },
  { id: 'end-heat', title: 'Last Ember', desc: 'Reach the Heat Death ending.', test: (p) => p.endingsSeen.includes('heat') },
  { id: 'end-chaos', title: 'Wild Sky', desc: 'Reach the Chaotic Beauty ending.', test: (p) => p.endingsSeen.includes('chaos') },
  { id: 'omniverse', title: 'Omniverse', desc: 'Witness all four endings.', test: (p) => ALL_ENDINGS.every((k) => p.endingsSeen.includes(k)) },
  { id: 'prolific', title: 'Prolific Creator', desc: 'Begin 5 universes.', test: (p) => p.universes >= 5 },
]

export function newlyUnlocked(unlocked: Set<string>, p: Progress): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.test(p))
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/achievements.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/achievements.ts src/achievements.test.ts
git commit -m "feat: achievement definitions and unlock check"
```

---

### Task 5: Universe codex

**Files:**
- Create: `src/codex.ts`
- Test: `src/codex.test.ts`

Codex = lore entries unlocked by first witnessing each phenomenon. Driven by same events.

- [ ] **Step 1: Write failing test `src/codex.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx vitest run src/codex.test.ts`
Expected: FAIL, cannot resolve `./codex`

- [ ] **Step 3: Implement `src/codex.ts`**

```typescript
import type { UniverseEvent } from './universe'

export interface CodexEntry {
  id: string
  title: string
  body: string
  match: (e: UniverseEvent) => boolean
}

export const CODEX: CodexEntry[] = [
  {
    id: 'cx-star',
    title: 'Star',
    body: 'Dust falls inward until pressure ignites fusion. A furnace that will burn for eons, or until you decide otherwise.',
    match: (e) => e.kind === 'star-formed',
  },
  {
    id: 'cx-planet',
    title: 'Planet',
    body: 'Leftover dust settles into orbit around a young star. Small, patient worlds tracing quiet circles.',
    match: (e) => e.kind === 'planet-captured',
  },
  {
    id: 'cx-nova',
    title: 'Supernova',
    body: 'A star ends in a single violent exhale, seeding the void with the ingredients of the next generation.',
    match: (e) => e.kind === 'supernova',
  },
  {
    id: 'cx-split',
    title: 'Binary Split',
    body: 'A massive star torn in two. Twin remnants fly apart, each carrying half a legacy.',
    match: (e) => e.kind === 'star-split',
  },
  {
    id: 'cx-hole',
    title: 'Black Hole',
    body: 'Matter compressed past the point of return. It does not shine. It only takes.',
    match: (e) => e.kind === 'black-hole-formed',
  },
  {
    id: 'cx-merge',
    title: 'Merger',
    body: 'Two horizons meet and become one. Spacetime itself rings like a struck bell.',
    match: (e) => e.kind === 'black-hole-merged',
  },
  {
    id: 'cx-evap',
    title: 'Hawking Fade',
    body: 'Even black holes are mortal. Given enough silence, they leak away into faint light.',
    match: (e) => e.kind === 'black-hole-evaporated',
  },
  {
    id: 'cx-swallow',
    title: 'Devoured Star',
    body: 'A star strays too close. Its light stretches, reddens, and is gone.',
    match: (e) => e.kind === 'star-swallowed',
  },
  {
    id: 'cx-end-stable',
    title: 'Ending: Stable Galaxy',
    body: 'Order won. Stars keep their planets in quiet, patient orbits.',
    match: (e) => e.kind === 'ending' && e.ending === 'stable',
  },
  {
    id: 'cx-end-collapse',
    title: 'Ending: Black Hole Collapse',
    body: 'Gravity claimed everything. Even light surrendered.',
    match: (e) => e.kind === 'ending' && e.ending === 'collapse',
  },
  {
    id: 'cx-end-heat',
    title: 'Ending: Heat Death',
    body: 'The last spark faded. Perfect stillness. Perfect cold.',
    match: (e) => e.kind === 'ending' && e.ending === 'heat',
  },
  {
    id: 'cx-end-chaos',
    title: 'Ending: Chaotic Beauty',
    body: 'No order, no rest. A universe that refuses to settle, and shines anyway.',
    match: (e) => e.kind === 'ending' && e.ending === 'chaos',
  },
]

export function unlockCodex(
  seenIds: string[],
  events: UniverseEvent[],
): { seen: string[]; fresh: CodexEntry[] } {
  const fresh: CodexEntry[] = []
  for (const entry of CODEX) {
    if (seenIds.includes(entry.id) || fresh.includes(entry)) continue
    if (events.some(entry.match)) fresh.push(entry)
  }
  return { seen: fresh.length ? [...seenIds, ...fresh.map((c) => c.id)] : seenIds, fresh }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/codex.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/codex.ts src/codex.test.ts
git commit -m "feat: universe codex entries and unlock logic"
```

---

### Task 6: Tutorial missions

**Files:**
- Create: `src/missions.ts`
- Test: `src/missions.test.ts`

Missions teach the controls in order. Driven by lifetime `Progress`. Completing all six hides the banner forever (persisted).

- [ ] **Step 1: Write failing test `src/missions.test.ts`**

```typescript
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
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx vitest run src/missions.test.ts`
Expected: FAIL, cannot resolve `./missions`

- [ ] **Step 3: Implement `src/missions.ts`**

```typescript
import type { Progress } from './progress'

export interface Mission {
  id: string
  text: string
  done: (p: Progress) => boolean
}

export const MISSIONS: Mission[] = [
  { id: 'm-tap', text: 'Tap 5 times to seed matter', done: (p) => p.taps >= 5 },
  { id: 'm-star', text: 'Hold to pull dust together until a star ignites', done: (p) => p.starsFormed >= 1 },
  { id: 'm-planet', text: 'Wait near a star. Let it capture a planet', done: (p) => p.planetsCaptured >= 1 },
  { id: 'm-nova', text: 'Double tap near a star to trigger a supernova', done: (p) => p.supernovae >= 1 },
  { id: 'm-hole', text: 'Hold long enough to compress a black hole', done: (p) => p.holesFormed >= 1 },
  { id: 'm-end', text: 'Guide your universe to any ending', done: (p) => p.endingsSeen.length >= 1 },
]

export function nextMission(p: Progress): Mission | null {
  return MISSIONS.find((m) => !m.done(p)) ?? null
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/missions.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/missions.ts src/missions.test.ts
git commit -m "feat: tutorial mission definitions"
```

---

### Task 7: Wire meta systems into UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

One 200ms tick already exists (stats interval). Extend it: drain events, update progress, detect unlocks, persist, queue toasts. Add mission banner, achievement toast, codex panel button.

- [ ] **Step 1: Add imports and persistent state to `src/App.tsx`**

At top:

```typescript
import { load, save } from './storage'
import { EMPTY_PROGRESS, applyEvents, type Progress } from './progress'
import { ACHIEVEMENTS, newlyUnlocked, type AchievementDef } from './achievements'
import { CODEX, unlockCodex, type CodexEntry } from './codex'
import { nextMission, MISSIONS } from './missions'
```

Inside `App()` component, add state and refs:

```typescript
const progressRef = useRef<Progress>(load('progress', EMPTY_PROGRESS))
const unlockedRef = useRef<Set<string>>(new Set(load<string[]>('unlocked', [])))
const codexSeenRef = useRef<string[]>(load<string[]>('codex', []))
const [toast, setToast] = useState<{ kind: 'achievement' | 'codex'; title: string; desc: string } | null>(null)
const [mission, setMission] = useState(() => nextMission(progressRef.current))
const [codexOpen, setCodexOpen] = useState(false)
const [codexSeen, setCodexSeen] = useState<string[]>(codexSeenRef.current)
const toastTimer = useRef(0)
```

- [ ] **Step 2: Extend the stats interval.** Replace existing `statsTimer` body (App.tsx:54) with:

```typescript
const statsTimer = window.setInterval(() => {
  setStats(engine.getStats())
  const events = engine.drainEvents()
  if (events.length === 0) return
  const next = applyEvents(progressRef.current, events)
  if (next !== progressRef.current) {
    progressRef.current = next
    save('progress', next)
    setMission(nextMission(next))
    const fresh = newlyUnlocked(unlockedRef.current, next)
    for (const a of fresh) unlockedRef.current.add(a.id)
    if (fresh.length) save('unlocked', [...unlockedRef.current])
    const cx = unlockCodex(codexSeenRef.current, events)
    if (cx.fresh.length) {
      codexSeenRef.current = cx.seen
      save('codex', cx.seen)
      setCodexSeen(cx.seen)
    }
    const t = fresh[0]
      ? { kind: 'achievement' as const, title: fresh[0].title, desc: fresh[0].desc }
      : cx.fresh[0]
        ? { kind: 'codex' as const, title: `Codex: ${cx.fresh[0].title}`, desc: 'New entry recorded' }
        : null
    if (t) {
      setToast(t)
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(null), 3500)
    }
  }
}, 200)
```

Also clear `toastTimer.current` in the effect cleanup.

- [ ] **Step 3: Count new universes in `reset`:**

```typescript
const reset = () => {
  engineRef.current?.reset()
  setStats(EMPTY)
  const next = { ...progressRef.current, universes: progressRef.current.universes + 1 }
  progressRef.current = next
  save('progress', next)
}
```

- [ ] **Step 4: Add JSX.** Mission banner below the hint (replace nothing, insert after `{!e && <p className="hint" ...>}` block):

```tsx
{mission && !e && (
  <div className="mission">
    <span className="mission-label">Mission</span> {mission.text}
    <span className="mission-count">
      {MISSIONS.findIndex((m) => m.id === mission.id) + 1}/{MISSIONS.length}
    </span>
  </div>
)}
```

Toast (top level, sibling of `.dock`):

```tsx
{toast && (
  <div className={`toast toast-${toast.kind}`} key={toast.title}>
    <b>{toast.kind === 'achievement' ? 'Achievement' : 'Discovery'}</b>
    <span>{toast.title}</span>
    <small>{toast.desc}</small>
  </div>
)}
```

Codex button in `.hud-top` next to reset button:

```tsx
<button className="codex-btn" onClick={() => setCodexOpen((o) => !o)} aria-label="Open codex">
  Codex {codexSeen.length}/{CODEX.length}
</button>
```

Codex panel (sibling of ending overlay):

```tsx
{codexOpen && (
  <div className="codex-panel" role="dialog" aria-label="Universe codex">
    <div className="codex-head">
      <h2>Codex</h2>
      <button onClick={() => setCodexOpen(false)} aria-label="Close codex">Close</button>
    </div>
    <div className="codex-grid">
      {CODEX.map((c) => {
        const open = codexSeen.includes(c.id)
        return (
          <div key={c.id} className={`codex-entry${open ? '' : ' locked'}`}>
            <h3>{open ? c.title : 'Undiscovered'}</h3>
            <p>{open ? c.body : 'Keep shaping the universe.'}</p>
          </div>
        )
      })}
    </div>
    <div className="codex-ach">
      <h3>Achievements {unlockedRef.current.size}/{ACHIEVEMENTS.length}</h3>
      <ul>
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} className={unlockedRef.current.has(a.id) ? 'done' : ''}>
            <b>{a.title}</b> <span>{a.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add styles to `src/styles.css`.** Match existing palette variables/conventions in the file. Core rules:

```css
.mission {
  position: absolute;
  left: 50%;
  bottom: 132px;
  transform: translateX(-50%);
  padding: 6px 14px;
  border: 1px solid rgba(121, 223, 230, 0.25);
  border-radius: 999px;
  background: rgba(4, 6, 10, 0.72);
  color: rgba(230, 237, 243, 0.85);
  font-size: 13px;
  white-space: nowrap;
}
.mission-label { color: rgb(121, 223, 230); letter-spacing: 0.08em; text-transform: uppercase; font-size: 11px; margin-right: 6px; }
.mission-count { color: rgba(230, 237, 243, 0.45); margin-left: 8px; }

.toast {
  position: absolute;
  top: 86px;
  right: 16px;
  display: grid;
  gap: 2px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(240, 182, 97, 0.4);
  background: rgba(8, 11, 16, 0.9);
  color: #f4f6fa;
  animation: toast-in 0.3s ease;
  max-width: 260px;
}
.toast-codex { border-color: rgba(121, 223, 230, 0.4); }
.toast b { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgb(240, 182, 97); }
.toast-codex b { color: rgb(121, 223, 230); }
.toast small { color: rgba(230, 237, 243, 0.6); }
@keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

.codex-panel {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  background: rgba(4, 6, 10, 0.94);
  padding: 24px;
  z-index: 30;
}
.codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin: 16px 0; }
.codex-entry { border: 1px solid rgba(121, 223, 230, 0.2); border-radius: 10px; padding: 12px; }
.codex-entry.locked { opacity: 0.4; border-style: dashed; }
.codex-ach li.done b { color: rgb(240, 182, 97); }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
```

Adjust `bottom`/`top` offsets against the live layout in dev.

- [ ] **Step 6: Manual verify.** Run `npm run dev`:
- Mission banner shows "Tap 5 times to seed matter", advances after 5 taps.
- Forming a star pops achievement toast "First Light" and codex toast on next event.
- Codex button opens panel, locked entries dashed, unlocked readable.
- Refresh page: progress, unlocks, codex persist.
- `npm run build` exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/styles.css
git commit -m "feat: wire achievements, codex, missions into UI"
```

---

### Task 8: Sound design with mute

**Files:**
- Create: `src/sound.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

Pure WebAudio synth, no asset files. AudioContext created lazily on first pointer down (autoplay policy). Mute persisted. Gravity hold gets a looping low hum.

- [ ] **Step 1: Implement `src/sound.ts`**

```typescript
// WebAudio synth. No samples: everything generated from oscillators and noise.
import { load, save } from './storage'

export type SoundKind =
  | 'tap'
  | 'star'
  | 'planet'
  | 'nova'
  | 'hole'
  | 'merge'
  | 'evaporate'
  | 'ending'

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  muted: boolean = load('muted', false)

  // Call from a user gesture (pointer down) so the context is allowed to start.
  ensure(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.4
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
    save('muted', m)
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.4, this.ctx.currentTime, 0.05)
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t)
    osc.stop(t + dur)
  }

  private noise(dur: number, gain: number, cutoffFrom: number, cutoffTo: number): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    const len = Math.ceil(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(cutoffFrom, t)
    filter.frequency.exponentialRampToValueAtTime(cutoffTo, t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(filter)
    filter.connect(g)
    g.connect(this.master)
    src.start(t)
  }

  play(kind: SoundKind): void {
    if (!this.ctx) return
    switch (kind) {
      case 'tap': this.tone(520, 0.12, 'sine', 0.25, 700); break
      case 'star':
        this.tone(392, 0.5, 'triangle', 0.2)
        this.tone(587, 0.6, 'triangle', 0.15)
        break
      case 'planet': this.tone(880, 0.25, 'sine', 0.12, 660); break
      case 'nova':
        this.noise(0.9, 0.5, 3200, 120)
        this.tone(180, 0.7, 'sawtooth', 0.15, 40)
        break
      case 'hole': this.tone(120, 1.1, 'sine', 0.35, 28); break
      case 'merge': this.tone(60, 1.4, 'sine', 0.3, 24); break
      case 'evaporate': this.tone(300, 0.8, 'sine', 0.1, 1400); break
      case 'ending':
        this.tone(262, 2.2, 'sine', 0.15)
        this.tone(330, 2.2, 'sine', 0.12)
        this.tone(392, 2.4, 'sine', 0.1)
        break
    }
  }

  startHum(): void {
    if (!this.ctx || !this.master || this.humOsc) return
    this.humOsc = this.ctx.createOscillator()
    this.humGain = this.ctx.createGain()
    this.humOsc.type = 'sine'
    this.humOsc.frequency.value = 55
    this.humGain.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    this.humGain.gain.exponentialRampToValueAtTime(0.18, this.ctx.currentTime + 0.4)
    this.humOsc.connect(this.humGain)
    this.humGain.connect(this.master)
    this.humOsc.start()
  }

  stopHum(): void {
    if (!this.ctx || !this.humOsc || !this.humGain) return
    this.humGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1)
    const osc = this.humOsc
    window.setTimeout(() => osc.stop(), 500)
    this.humOsc = null
    this.humGain = null
  }
}
```

- [ ] **Step 2: Wire in `src/App.tsx`.**

```typescript
import { Sound } from './sound'
```

Component:

```typescript
const soundRef = useRef<Sound>(new Sound())
const [muted, setMuted] = useState(soundRef.current.muted)
```

In `pressDown`: `soundRef.current.ensure()` first line.

Event-to-sound map inside the stats interval, after `drainEvents()`:

```typescript
const SOUND_FOR: Partial<Record<UniverseEvent['kind'], SoundKind>> = {
  'tap': 'tap',
  'star-formed': 'star',
  'planet-captured': 'planet',
  'supernova': 'nova',
  'star-split': 'nova',
  'black-hole-formed': 'hole',
  'black-hole-merged': 'merge',
  'black-hole-evaporated': 'evaporate',
  'ending': 'ending',
}
for (const ev of events) {
  const s = SOUND_FOR[ev.kind]
  if (s) soundRef.current.play(s)
}
```

(Hoist `SOUND_FOR` to module scope, import `SoundKind` and `UniverseEvent` types.)

Hum: `stats.holding` already tracks gravity hold. Add effect:

```typescript
useEffect(() => {
  if (stats.holding) soundRef.current.startHum()
  else soundRef.current.stopHum()
}, [stats.holding])
```

Mute button in `.hud-top`:

```tsx
<button
  className="mute"
  onClick={() => {
    const m = !muted
    setMuted(m)
    soundRef.current.setMuted(m)
  }}
  aria-label={muted ? 'Unmute sound' : 'Mute sound'}
  aria-pressed={muted}
>
  {muted ? 'Sound off' : 'Sound on'}
</button>
```

- [ ] **Step 3: Style mute button in `src/styles.css`** to match existing `.reset` button styles (copy its rule block, adjust selector to `.mute, .codex-btn` shared with Task 7 button).

- [ ] **Step 4: Manual verify.** `npm run dev`:
- First tap makes blip (after gesture unlock).
- Hold plays low hum, stops on release.
- Supernova rumbles, black hole deep drop, ending plays chord.
- Mute silences everything immediately, persists across refresh.
- No console errors before first gesture (context lazy).

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/sound.ts src/App.tsx src/styles.css
git commit -m "feat: webaudio sound design with persisted mute"
```

---

### Task 9: Modes: Zen, Challenge, Chaos

**Files:**
- Create: `src/modes.ts`
- Modify: `src/universe.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

Classic stays default. Zen: no endings, calmer, endless. Challenge: reach Stable Galaxy before the deadline. Chaos: random cosmic events, hotter entropy.

- [ ] **Step 1: Implement `src/modes.ts`**

```typescript
export type ModeId = 'classic' | 'zen' | 'challenge' | 'chaos'

export interface ModeConfig {
  id: ModeId
  label: string
  blurb: string
  endingsEnabled: boolean
  naturalEnd: number | null // sim seconds; null = never concludes on its own
  entropyMul: number
  chaosEventEvery: number | null // seconds between random events; null = off
  deadline: number | null // challenge: must reach stable ending before this
}

export const MODES: ModeConfig[] = [
  {
    id: 'classic',
    label: 'Classic',
    blurb: 'The full arc. Shape it, then let it conclude.',
    endingsEnabled: true,
    naturalEnd: 132,
    entropyMul: 1,
    chaosEventEvery: null,
    deadline: null,
  },
  {
    id: 'zen',
    label: 'Zen',
    blurb: 'No endings, no clock. Just you and the dust.',
    endingsEnabled: false,
    naturalEnd: null,
    entropyMul: 0.6,
    chaosEventEvery: null,
    deadline: null,
  },
  {
    id: 'challenge',
    label: 'Challenge',
    blurb: 'Build a Stable Galaxy before 34 Gyr.',
    endingsEnabled: true,
    naturalEnd: 100,
    entropyMul: 1.2,
    chaosEventEvery: null,
    deadline: 100,
  },
  {
    id: 'chaos',
    label: 'Chaos',
    blurb: 'The universe fights back. Random cosmic events.',
    endingsEnabled: true,
    naturalEnd: 132,
    entropyMul: 1.4,
    chaosEventEvery: 7,
  deadline: null,
  },
]

export function modeById(id: ModeId): ModeConfig {
  return MODES.find((m) => m.id === id) ?? MODES[0]
}
```

- [ ] **Step 2: Engine accepts mode.** In `src/universe.ts`:

Import: `import type { ModeConfig } from './modes'` and add field + param:

```typescript
private mode: ModeConfig

constructor(canvas: HTMLCanvasElement, reduced: boolean, mode: ModeConfig) {
  // ...existing body...
  this.mode = mode
  this.reset()
}

setMode(mode: ModeConfig) {
  this.mode = mode
  this.reset()
}
```

(Set `this.mode = mode` BEFORE the existing `this.reset()` call.)

- [ ] **Step 3: Apply mode in engine logic.**

In `checkEndings()` (universe.ts:618), first line becomes:

```typescript
if (!this.mode.endingsEnabled || this.ending || this.time < 18) return
```

Replace both `NATURAL_END` uses (line 636) with `this.mode.naturalEnd`, guarding null:

```typescript
if (this.mode.naturalEnd !== null && this.time >= this.mode.naturalEnd) {
```

Entropy: every `this.entropy = Math.min(100, this.entropy + N)` becomes `+ N * this.mode.entropyMul`. Sites: tap (~275), nova miss (~293), supernova (~320, ~323), formBlackHole (~341), star swallowed (~452), star collapse (~482).

Chaos events: add field `private chaosTimer = 0` (reset it in `reset()`), and in `update()` after the evolve block (~line 551):

```typescript
if (this.mode.chaosEventEvery !== null && !this.ending) {
  this.chaosTimer += dt
  if (this.chaosTimer > this.mode.chaosEventEvery) {
    this.chaosTimer = 0
    const roll = Math.random()
    const x = Math.random() * this.w
    const y = Math.random() * this.h
    if (roll < 0.5) {
      // rogue dust burst
      this.spawnDust(x, y, this.reduced ? 10 : 18, 110, 0.6)
      this.fx.push({ kind: 'ring', x, y, age: 0, life: 0.6, max: 80, warm: 0.6 })
    } else if (roll < 0.8 && this.stars.length > 0) {
      // spontaneous nova on a random star
      this.supernova(this.stars[Math.floor(Math.random() * this.stars.length)])
    } else {
      // gravity ripple: shove all dust
      for (const d of this.dust) {
        d.vx += (Math.random() - 0.5) * 60
        d.vy += (Math.random() - 0.5) * 60
      }
      this.fx.push({ kind: 'darkring', x: this.w / 2, y: this.h / 2, age: 0, life: 0.9, max: Math.min(this.w, this.h) * 0.4, warm: 0 })
    }
  }
}
```

Challenge outcome: in `checkEndings`, before the naturalEnd block:

```typescript
if (this.mode.deadline !== null && this.time >= this.mode.deadline && !this.ending) {
  // deadline hit without stable: judge what exists now
  if (this.stars.length >= 4 && this.stability > 75 && this.entropy < 40) {
    this.ending = ENDINGS.stable
  } else if (t.total >= 110 || this.entropy >= 55) {
    this.ending = ENDINGS.chaos
  } else {
    this.ending = ENDINGS.heat
  }
  this.emit('ending', undefined, undefined, this.ending.kind)
  return
}
```

- [ ] **Step 4: Mode select UI in `src/App.tsx`.**

```typescript
import { MODES, modeById, type ModeId } from './modes'
```

State:

```typescript
const [modeId, setModeId] = useState<ModeId>(load('mode', 'classic'))
```

Engine construction (App.tsx:36) becomes:

```typescript
const engine = new Universe(canvas, reduced, modeById(loadedModeId))
```

Note: the effect runs once; read the initial mode from a ref or pass `modeById(modeIdRef.current)`. Simplest: keep a `modeIdRef` synced with state, and add a `changeMode` handler:

```typescript
const modeIdRef = useRef<ModeId>(modeId)

const changeMode = (id: ModeId) => {
  setModeId(id)
  modeIdRef.current = id
  save('mode', id)
  engineRef.current?.setMode(modeById(id))
  setStats(EMPTY)
}
```

`reset` becomes `engineRef.current?.setMode(modeById(modeIdRef.current))` OR keep `engine.reset()` (mode already set). Keep `reset()` as-is plus universe counter.

Mode picker JSX in `.hud-top` (or a second hud row):

```tsx
<div className="modes" role="radiogroup" aria-label="Game mode">
  {MODES.map((m) => (
    <button
      key={m.id}
      className={`mode-btn${m.id === modeId ? ' active' : ''}`}
      onClick={() => changeMode(m.id)}
      role="radio"
      aria-checked={m.id === modeId}
      title={m.blurb}
    >
      {m.label}
    </button>
  ))}
</div>
```

Challenge countdown, near mission banner:

```tsx
{modeId === 'challenge' && !e && (
  <div className="deadline">Goal: Stable Galaxy before 34.0 Gyr. Now {stats.age} Gyr</div>
)}
```

- [ ] **Step 5: Styles.** `.modes` pill group, `.mode-btn.active` cyan border, `.deadline` amber text. Match existing HUD look. On narrow screens let `.modes` wrap or scroll horizontally (`overflow-x: auto`).

- [ ] **Step 6: Manual verify.** `npm run dev`:
- Classic behaves as v1.
- Zen: no ending even after long idle, calmer entropy bar.
- Challenge: countdown visible, ending fires at 34 Gyr (100 sim seconds, ~1.7 min), stable if built well.
- Chaos: random bursts/novae every ~7s, screen ripples.
- Mode persists across refresh.

- [ ] **Step 7: Run all tests + build**

Run: `npm run test && npm run build`
Expected: all pass, build exit 0

- [ ] **Step 8: Commit**

```bash
git add src/modes.ts src/universe.ts src/App.tsx src/styles.css
git commit -m "feat: zen, challenge and chaos modes"
```

---

### Task 10: Save/share PNG card

**Files:**
- Create: `src/share.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

Renders a 1080x1350 card: cropped game canvas snapshot, dark gradient, ending title, stats, footer. Web Share API with file when available, else download.

- [ ] **Step 1: Implement `src/share.ts`**

```typescript
import type { Stats } from './universe'

const W = 1080
const H = 1350

function drawCard(game: HTMLCanvasElement, stats: Stats, modeLabel: string): HTMLCanvasElement {
  const card = document.createElement('canvas')
  card.width = W
  card.height = H
  const ctx = card.getContext('2d')!

  // background: cover-crop the live game canvas
  ctx.fillStyle = '#04060a'
  ctx.fillRect(0, 0, W, H)
  const scale = Math.max(W / game.width, H / game.height)
  const dw = game.width * scale
  const dh = game.height * scale
  ctx.drawImage(game, (W - dw) / 2, (H - dh) / 2, dw, dh)

  // legibility gradients top and bottom
  const top = ctx.createLinearGradient(0, 0, 0, 400)
  top.addColorStop(0, 'rgba(4,6,10,0.9)')
  top.addColorStop(1, 'rgba(4,6,10,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 400)
  const bot = ctx.createLinearGradient(0, H - 560, 0, H)
  bot.addColorStop(0, 'rgba(4,6,10,0)')
  bot.addColorStop(1, 'rgba(4,6,10,0.95)')
  ctx.fillStyle = bot
  ctx.fillRect(0, H - 560, W, 560)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(230,237,243,0.7)'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText('ONE BUTTON UNIVERSE', W / 2, 96)

  const title = stats.ending ? stats.ending.title : `${stats.phase}`
  ctx.fillStyle = '#f4f6fa'
  ctx.font = '700 84px Georgia, serif'
  ctx.fillText(title, W / 2, H - 400)

  if (stats.ending) {
    ctx.fillStyle = 'rgba(230,237,243,0.75)'
    ctx.font = '400 36px Georgia, serif'
    ctx.fillText(stats.ending.line, W / 2, H - 330, W - 120)
  }

  const cells: Array<[string, string]> = [
    ['AGE', `${stats.age} Gyr`],
    ['STARS', String(stats.stars)],
    ['BLACK HOLES', String(stats.holes)],
    ['ENTROPY', String(stats.entropy)],
  ]
  const cw = (W - 160) / cells.length
  cells.forEach(([label, value], i) => {
    const x = 80 + cw * i + cw / 2
    ctx.fillStyle = 'rgb(121,223,230)'
    ctx.font = '600 24px system-ui, sans-serif'
    ctx.fillText(label, x, H - 220)
    ctx.fillStyle = '#f4f6fa'
    ctx.font = '700 48px system-ui, sans-serif'
    ctx.fillText(value, x, H - 160)
  })

  ctx.fillStyle = 'rgba(240,182,97,0.85)'
  ctx.font = '500 28px system-ui, sans-serif'
  ctx.fillText(`${modeLabel} mode`, W / 2, H - 72)

  return card
}

export async function shareCard(game: HTMLCanvasElement, stats: Stats, modeLabel: string): Promise<'shared' | 'downloaded'> {
  const card = drawCard(game, stats, modeLabel)
  const blob = await new Promise<Blob | null>((res) => card.toBlob(res, 'image/png'))
  if (!blob) throw new Error('card render failed')
  const file = new File([blob], 'one-button-universe.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'One Button Universe' })
      return 'shared'
    } catch {
      // user cancelled or share failed: fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'one-button-universe.png'
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
```

- [ ] **Step 2: Wire buttons in `src/App.tsx`.**

```typescript
import { shareCard } from './share'
```

Handler:

```typescript
const [shareBusy, setShareBusy] = useState(false)
const share = async () => {
  const canvas = canvasRef.current
  if (!canvas || shareBusy) return
  setShareBusy(true)
  try {
    await shareCard(canvas, engineRef.current!.getStats(), modeById(modeId).label)
  } finally {
    setShareBusy(false)
  }
}
```

Button on ending card (next to "Begin a new universe"):

```tsx
<button className="share" onClick={share} disabled={shareBusy}>
  {shareBusy ? 'Rendering' : 'Save universe card'}
</button>
```

Also small share button in HUD so Zen mode (no endings) can share too:

```tsx
<button className="share-mini" onClick={share} aria-label="Save a snapshot card">Snapshot</button>
```

- [ ] **Step 3: Styles.** `.share` mirrors `.again` button but amber accent. `.share-mini` matches `.reset`/`.codex-btn` group.

- [ ] **Step 4: Manual verify.** `npm run dev`:
- Reach any ending, click "Save universe card": PNG downloads (desktop), 1080x1350, shows scene, ending title, stats, mode footer.
- Snapshot button works mid-game in Zen mode.
- Mobile (or devtools device emulation with share stub): share sheet opens where supported.
- Open the PNG, check text legible, no clipped copy, no em-dashes.

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/share.ts src/App.tsx src/styles.css
git commit -m "feat: shareable png universe card"
```

---

### Task 11: Visual polish

**Files:**
- Modify: `src/universe.ts`
- Modify: `src/styles.css`
- Modify: `src/App.tsx` (class hooks only if needed)

Restrained upgrades. Palette unchanged: off-black, starlight white, cyan, amber.

- [ ] **Step 1: Nebula wash in starfield.** In `buildStarfield()` (universe.ts:167), after the star dots loop, add 3 soft nebula blobs:

```typescript
for (let i = 0; i < 3; i++) {
  const x = this.w * (0.2 + Math.random() * 0.6)
  const y = this.h * (0.2 + Math.random() * 0.6)
  const r = Math.min(this.w, this.h) * (0.25 + Math.random() * 0.2)
  const warm = i === 1
  const grad = g.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, `rgba(${warm ? '240,182,97' : '121,223,230'},0.05)`)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}
```

- [ ] **Step 2: Star cross flare for heavy stars.** In `render()` star loop (after core circle, ~line 689), add:

```typescript
if (s.mass > 30 && !this.reduced) {
  ctx.strokeStyle = `rgba(244,246,250,${0.25 * flick})`
  ctx.lineWidth = 1
  const fl = r * 3.2
  ctx.beginPath()
  ctx.moveTo(s.x - fl, s.y)
  ctx.lineTo(s.x + fl, s.y)
  ctx.moveTo(s.x, s.y - fl)
  ctx.lineTo(s.x, s.y + fl)
  ctx.stroke()
}
```

- [ ] **Step 3: CSS polish in `src/styles.css`:**
- Vignette: on `.stage::after`, `position: absolute; inset: 0; pointer-events: none; box-shadow: inset 0 0 18vmin rgba(0,0,0,0.55); border-radius: inherit;`
- Ending card accents per kind (classes already emitted as `ending-stable` etc. on the overlay): `.ending-stable .ending-card { border-color: rgba(121,223,230,0.5); }`, `.ending-collapse .ending-card { border-color: rgba(240,182,97,0.5); }`, `.ending-heat .ending-card { border-color: rgba(230,237,243,0.3); }`, `.ending-chaos .ending-card { border-color: rgba(240,182,97,0.7); }` (adapt to how `.ending-card` border is currently defined).
- Button idle breathing: `@keyframes breathe { 0%,100% { box-shadow: 0 0 24px rgba(121,223,230,0.15); } 50% { box-shadow: 0 0 40px rgba(121,223,230,0.3); } }` applied to `.the-button`, duration 4s; disabled under `@media (prefers-reduced-motion: reduce)`.
- Toast/mission/panel transitions already added in Task 7; verify consistent radii and borders across all new chrome.

- [ ] **Step 4: Manual verify.** `npm run dev`:
- Faint cyan and amber nebula patches visible behind dust.
- Heavy stars show subtle cross flare.
- Vignette present, edges darker.
- Each ending kind shows distinct card accent.
- With OS reduced-motion enabled: no breathing, no flare, no shake (v1 behavior kept).
- Frame rate still smooth on mobile viewport with ~1300 dust.

- [ ] **Step 5: Build check + commit**

```bash
npm run test && npm run build
git add src/universe.ts src/styles.css src/App.tsx
git commit -m "feat: nebula wash, star flares, vignette, ending accents"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all suites pass (storage, progress, achievements, codex, missions)

- [ ] **Step 2: Clean build**

Run: `npm run build`
Expected: exit 0, no TS errors, test files excluded from bundle

- [ ] **Step 3: Manual checklist in `npm run dev`** (desktop + mobile viewport):

| # | Check | Pass |
|---|---|---|
| 1 | v1 controls unchanged: tap, hold, double tap, long hold, idle evolution | [ ] |
| 2 | Missions appear in order, advance, disappear after all six done, stay done after refresh | [ ] |
| 3 | Achievement toast on first star; codex toast on new discovery | [ ] |
| 4 | Codex panel opens, shows locked/unlocked entries and achievement list with counts | [ ] |
| 5 | localStorage survives refresh: progress, unlocked, codex, mode, mute | [ ] |
| 6 | Corrupt localStorage (set `obu.v2.progress` to `garbage` in devtools) does not crash, falls back clean | [ ] |
| 7 | Sound: tap blip, hold hum, nova boom, hole drop, ending chord; mute kills all, persists | [ ] |
| 8 | No audio errors before first user gesture | [ ] |
| 9 | Zen: never ends, calmer | [ ] |
| 10 | Challenge: countdown, verdict at deadline | [ ] |
| 11 | Chaos: random events roughly every 7s | [ ] |
| 12 | PNG card: downloads, correct stats, legible, works from ending card and snapshot button | [ ] |
| 13 | Reduced motion: no shake, no flares, no breathing button, animations off | [ ] |
| 14 | Touch: all new buttons tappable, mode pills usable on 375px width | [ ] |
| 15 | No em-dashes anywhere in visible copy (grep `—` in src) | [ ] |
| 16 | All four endings still reachable | [ ] |

- [ ] **Step 4: Grep gate**

```bash
grep -rn "—" src/ && echo "FAIL: em-dash found" || echo "OK"
```

- [ ] **Step 5: Final commit if any fixes made**

```bash
git add -A
git commit -m "chore: v2 verification fixes"
```

---

## Self-Review Notes

- Spec coverage: achievements (Task 4+7), codex (5+7), PNG card (10), missions (6+7), sound + mute (8), modes (9), polish (11). All persisted state via `storage.ts` (1). Verification (12).
- Type consistency: `UniverseEvent`/`drainEvents` defined Task 2, consumed 3/7/8. `Progress`/`applyEvents`/`EMPTY_PROGRESS` defined 3, consumed 4/6/7. `ModeConfig`/`modeById` defined 9 before engine use. `Stats` unchanged from v1.
- Known judgment calls: missions and achievements share lifetime `Progress` (DRY, means missions persist across universes, intended). Engine constructor signature changes in Task 9; Tasks 2-8 keep old 2-arg constructor, Task 9 updates the single call site. Chaos `supernova()` reuse emits events, so chaos mode feeds achievements too, intended.
