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
