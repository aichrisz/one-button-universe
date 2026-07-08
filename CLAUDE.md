# One Button Universe

## Goal
Build a polished, mobile-friendly interactive web game called One Button Universe in one day.

## Concept
The whole game is controlled by one large button plus pointer movement. The same button changes meaning based on timing:
- tap: create matter
- hold: gravity pull
- double tap: supernova/split star
- long hold: compress into black hole risk
- idle: evolution happens automatically

The user shapes a tiny universe from particles to stars, planets, or collapse endings.

## Acceptance Criteria
- Runs locally with `npm run dev` and builds with `npm run build`.
- Single-page polished experience, no backend.
- Real-time canvas animation with visible particles, stars, gravity, orbits, black holes, and supernova effects.
- Clear one-button controls with tap/hold/double-tap behavior.
- Mobile and desktop friendly. Touch interactions work.
- Has live stats: matter, stability, entropy, age, star count, black hole count.
- Has at least 4 endings: Stable Galaxy, Black Hole Collapse, Heat Death, Chaotic Beauty.
- Has reset/new universe action.
- Honors reduced motion by lowering animation intensity if possible.
- Visual direction: dark cosmic, elegant, tactile, not generic AI-purple. Use a restrained palette: off-black, starlight white, cyan/amber accents.
- No em-dashes in visible copy.

## Implementation Preference
Use Vite + React + TypeScript or plain React if easier. Canvas rendering should be self-contained and performant. Avoid unnecessary dependencies.

## Verification Commands
- npm install
- npm run build
- npm run dev

## Reporting
Concise caveman style: changed files, verification output, blockers only.
