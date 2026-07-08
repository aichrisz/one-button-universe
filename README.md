# One Button Universe

A polished mobile-friendly one-button cosmic sandbox game. Tap, hold, double tap, and wait to shape a tiny universe from dust into stars, planets, black holes, or one of several cosmic endings.

## Live preview

Permanent GitHub Pages deployment:

https://aichrisz.github.io/one-button-universe/

## Features

- One-button controls:
  - tap to create matter
  - hold to pull with gravity
  - double tap to trigger a supernova
  - long hold to risk black hole compression
  - idle evolution over time
- Real-time canvas simulation with particles, stars, orbits, black holes, and supernova effects
- Four endings:
  - Stable Galaxy
  - Black Hole Collapse
  - Heat Death
  - Chaotic Beauty
- Replay systems:
  - achievements
  - universe codex
  - tutorial missions
  - persistent progress via localStorage
- Game modes:
  - Classic
  - Zen
  - Challenge
  - Chaos
- Sound design with mute toggle
- Save/share PNG universe card
- Mobile and desktop friendly
- Reduced-motion support

## Tech stack

- Vite
- React
- TypeScript
- Canvas 2D
- Web Audio API
- Vitest

No backend and no runtime dependencies beyond React.

## Getting started

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173
```

## Scripts

```bash
npm run dev      # start development server
npm run build    # type-check and build production assets
npm run preview  # preview production build
npm test         # run Vitest tests
```

## Verification

Latest local verification:

```text
npm test
5 test files passed
20 tests passed

npm run build
40 modules transformed
built successfully
```

## Project structure

```text
src/
  App.tsx              # UI shell, panels, mode controls, share flow
  universe.ts          # canvas simulation engine and event queue
  modes.ts             # Classic, Zen, Challenge, Chaos configs
  progress.ts          # persistent progress reducer
  achievements.ts      # achievement definitions and unlock logic
  codex.ts             # codex entries and unlock logic
  missions.ts          # tutorial mission progression
  sound.ts             # Web Audio synth and mute persistence
  share.ts             # PNG share card renderer
  storage.ts           # safe namespaced localStorage wrapper
```

## Notes

The current online link is a temporary quick tunnel. For a permanent public URL, deploy the `dist/` build to GitHub Pages, Vercel, Netlify, or Cloudflare Pages.
