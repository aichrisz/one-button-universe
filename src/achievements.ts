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
