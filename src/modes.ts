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
