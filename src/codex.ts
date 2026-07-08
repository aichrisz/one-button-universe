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
