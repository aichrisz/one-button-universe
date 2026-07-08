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
