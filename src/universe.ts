// One Button Universe simulation engine.
// Self-contained: owns the canvas 2d context, physics, effects and ending logic.

import { modeById, type ModeConfig } from './modes'

export type EndingKind = 'stable' | 'collapse' | 'heat' | 'chaos'

export interface Ending {
  kind: EndingKind
  title: string
  line: string
}

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

export interface Stats {
  matter: number
  stars: number
  holes: number
  age: string
  entropy: number
  stability: number
  phase: string
  risk: number
  holding: boolean
  ending: Ending | null
}

interface Dust {
  x: number
  y: number
  vx: number
  vy: number
  s: number
  warm: number
}

interface Planet {
  dist: number
  angle: number
  speed: number
  size: number
  warm: number
}

interface Star {
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  born: number
  seed: number
  planets: Planet[]
}

interface Hole {
  x: number
  y: number
  vx: number
  vy: number
  mass: number
  spin: number
}

interface Fx {
  kind: 'ring' | 'flash' | 'darkring'
  x: number
  y: number
  age: number
  life: number
  max: number
  warm: number
}

const ENDINGS: Record<EndingKind, Ending> = {
  stable: {
    kind: 'stable',
    title: 'Stable Galaxy',
    line: 'Order won. Stars keep their planets in quiet, patient orbits.',
  },
  collapse: {
    kind: 'collapse',
    title: 'Black Hole Collapse',
    line: 'Gravity claimed everything. Even light surrendered.',
  },
  heat: {
    kind: 'heat',
    title: 'Heat Death',
    line: 'The last spark faded. Perfect stillness. Perfect cold.',
  },
  chaos: {
    kind: 'chaos',
    title: 'Chaotic Beauty',
    line: 'No order, no rest. A universe that refuses to settle, and shines anyway.',
  },
}

const CYAN = [121, 223, 230]
const AMBER = [240, 182, 97]

const HOLD_START = 0.26 // seconds before a press becomes gravity
const COMPRESS_START = 1.5 // seconds before a hold becomes compression
const COMPRESS_FULL = 1.3 // seconds of compression until a black hole forms
const DOUBLE_TAP = 0.3 // max gap between taps for a double tap
export const GYR_PER_SEC = 0.34

function mix(a: number[], b: number[], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t)
  const g = Math.round(a[1] + (b[1] - a[1]) * t)
  const bl = Math.round(a[2] + (b[2] - a[2]) * t)
  return `${r},${g},${bl}`
}

export class Universe {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private starfield: HTMLCanvasElement | null = null
  private w = 1
  private h = 1
  private dpr = 1
  reduced = false

  private dust: Dust[] = []
  private stars: Star[] = []
  private holes: Hole[] = []
  private fx: Fx[] = []
  private events: UniverseEvent[] = []

  private pointer = { x: 0, y: 0 }
  private pressed = false
  private pressAt = 0
  private lastTapUp = -10
  private suppressTap = false
  private compress = 0
  private shake = 0
  private clumpTimer = 0
  private evolveTimer = 0
  private chaosTimer = 0
  private mode: ModeConfig = modeById('classic')

  private time = 0
  private entropy = 26
  private stability = 50
  private ending: Ending | null = null
  private lastFrame = 0

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d unavailable')
    this.ctx = ctx
    this.reduced = reduced
    this.reset()
  }

  private emit(kind: UniverseEventKind, x?: number, y?: number, ending?: EndingKind) {
    if (this.events.length < 64) this.events.push({ kind, x, y, ending })
  }

  drainEvents(): UniverseEvent[] {
    const out = this.events
    this.events = []
    return out
  }

  setMode(m: ModeConfig) {
    this.mode = m
  }

  private addEntropy(n: number) {
    this.entropy = Math.min(100, this.entropy + n * this.mode.entropyMul)
  }

  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.dpr = Math.min(dpr, 2)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.buildStarfield()
    if (this.pointer.x === 0 && this.pointer.y === 0) {
      this.pointer.x = this.w / 2
      this.pointer.y = this.h / 2
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.ctx.fillStyle = '#04060a'
    this.ctx.fillRect(0, 0, this.w, this.h)
  }

  private buildStarfield() {
    const c = document.createElement('canvas')
    c.width = Math.round(this.w * this.dpr)
    c.height = Math.round(this.h * this.dpr)
    const g = c.getContext('2d')
    if (!g) return
    g.scale(this.dpr, this.dpr)
    const n = Math.round((this.w * this.h) / 5200)
    for (let i = 0; i < n; i++) {
      const x = Math.random() * this.w
      const y = Math.random() * this.h
      const r = Math.random()
      g.fillStyle = `rgba(${r > 0.8 ? mix(CYAN, [255, 255, 255], 0.6) : '210,220,232'},${0.15 + Math.random() * 0.4})`
      g.fillRect(x, y, r > 0.93 ? 1.6 : 1, r > 0.93 ? 1.6 : 1)
    }
    this.starfield = c
  }

  reset() {
    this.dust = []
    this.stars = []
    this.holes = []
    this.fx = []
    this.time = 0
    this.entropy = 26
    this.stability = 50
    this.ending = null
    this.compress = 0
    this.shake = 0
    this.chaosTimer = 0
    this.pressed = false
    this.suppressTap = false
    this.events = []
    const seedCount = this.reduced ? 90 : 150
    const cx = this.w / 2
    const cy = this.h / 2
    for (let i = 0; i < seedCount; i++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.pow(Math.random(), 0.6) * Math.min(this.w, this.h) * 0.42
      const x = cx + Math.cos(a) * d
      const y = cy + Math.sin(a) * d
      this.dust.push({
        x,
        y,
        vx: -Math.sin(a) * d * 0.05 + (Math.random() - 0.5) * 6,
        vy: Math.cos(a) * d * 0.05 + (Math.random() - 0.5) * 6,
        s: 1 + Math.random() * 1.6,
        warm: Math.random() * 0.5,
      })
    }
  }

  setPointer(x: number, y: number) {
    this.pointer.x = Math.max(0, Math.min(this.w, x))
    this.pointer.y = Math.max(0, Math.min(this.h, y))
  }

  pressDown() {
    if (this.ending) return
    const now = performance.now() / 1000
    this.suppressTap = false
    if (now - this.lastTapUp < DOUBLE_TAP) {
      this.nova()
      this.suppressTap = true
      this.lastTapUp = -10
    }
    this.pressed = true
    this.pressAt = now
  }

  pressUp() {
    if (!this.pressed) return
    this.pressed = false
    const now = performance.now() / 1000
    const dur = now - this.pressAt
    this.compress = 0
    if (dur < HOLD_START) {
      if (!this.suppressTap) {
        this.tap()
        this.lastTapUp = now
      }
    }
    this.suppressTap = false
  }

  private holdDuration(): number {
    if (!this.pressed || this.ending) return 0
    return performance.now() / 1000 - this.pressAt
  }

  private spawnDust(x: number, y: number, count: number, speed: number, warm: number) {
    const cap = this.reduced ? 700 : 1300
    for (let i = 0; i < count; i++) {
      if (this.dust.length >= cap) return
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random())
      this.dust.push({
        x: x + Math.cos(a) * 4,
        y: y + Math.sin(a) * 4,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        s: 1 + Math.random() * 1.8,
        warm: warm + (Math.random() - 0.5) * 0.3,
      })
    }
  }

  private tap() {
    this.spawnDust(this.pointer.x, this.pointer.y, this.reduced ? 9 : 14, 42, 0.15)
    this.fx.push({ kind: 'flash', x: this.pointer.x, y: this.pointer.y, age: 0, life: 0.35, max: 26, warm: 0.1 })
    this.addEntropy(0.8)
    this.emit('tap', this.pointer.x, this.pointer.y)
  }

  private nova() {
    let target: Star | null = null
    let best = 150
    for (const s of this.stars) {
      const d = Math.hypot(s.x - this.pointer.x, s.y - this.pointer.y)
      if (d < best) {
        best = d
        target = s
      }
    }
    if (target) {
      this.supernova(target)
    } else {
      this.spawnDust(this.pointer.x, this.pointer.y, this.reduced ? 12 : 20, 90, 0.4)
      this.fx.push({ kind: 'ring', x: this.pointer.x, y: this.pointer.y, age: 0, life: 0.6, max: 90, warm: 0.5 })
      this.addEntropy(3)
    }
  }

  private supernova(star: Star) {
    const i = this.stars.indexOf(star)
    if (i === -1) return
    this.stars.splice(i, 1)
    this.emit(star.mass > 55 ? 'star-split' : 'supernova', star.x, star.y)
    for (const p of star.planets) {
      this.spawnDust(star.x + Math.cos(p.angle) * p.dist, star.y + Math.sin(p.angle) * p.dist, 5, 60, p.warm)
    }
    if (star.mass > 55) {
      // massive star splits in two
      const a = Math.random() * Math.PI * 2
      for (const dir of [1, -1]) {
        this.stars.push({
          x: star.x + Math.cos(a) * 14 * dir,
          y: star.y + Math.sin(a) * 14 * dir,
          vx: star.vx + Math.cos(a) * 46 * dir,
          vy: star.vy + Math.sin(a) * 46 * dir,
          mass: star.mass * 0.38,
          born: this.time,
          seed: Math.random() * 10,
          planets: [],
        })
      }
      this.spawnDust(star.x, star.y, this.reduced ? 14 : 26, 130, 0.7)
      this.addEntropy(7)
    } else {
      this.spawnDust(star.x, star.y, Math.min(90, Math.round(star.mass * 1.1 + 18)), 150, 0.75)
      this.addEntropy(11)
    }
    this.fx.push({ kind: 'ring', x: star.x, y: star.y, age: 0, life: 0.9, max: 190, warm: 0.85 })
    this.fx.push({ kind: 'flash', x: star.x, y: star.y, age: 0, life: 0.5, max: 70, warm: 0.7 })
    if (!this.reduced) this.shake = Math.min(10, this.shake + 6)
  }

  private formBlackHole(x: number, y: number) {
    let consumed = 0
    this.dust = this.dust.filter((d) => {
      if (Math.hypot(d.x - x, d.y - y) < 90) {
        consumed++
        return false
      }
      return true
    })
    this.holes.push({ x, y, vx: 0, vy: 0, mass: 18 + consumed * 0.7, spin: Math.random() * Math.PI * 2 })
    this.emit('black-hole-formed', x, y)
    this.fx.push({ kind: 'darkring', x, y, age: 0, life: 1.0, max: 150, warm: 0.2 })
    this.addEntropy(14)
    if (!this.reduced) this.shake = Math.min(12, this.shake + 8)
  }

  private totals() {
    let starMass = 0
    let planetMass = 0
    for (const s of this.stars) {
      starMass += s.mass
      planetMass += s.planets.length * 4
    }
    let holeMass = 0
    for (const hle of this.holes) holeMass += hle.mass
    const dustMass = this.dust.length
    return { starMass, planetMass, holeMass, dustMass, total: starMass + planetMass + holeMass + dustMass }
  }

  frame(now: number) {
    if (this.lastFrame === 0) this.lastFrame = now
    let dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    if (this.ending) dt *= 0.25
    this.update(dt)
    this.render()
  }

  private update(dt: number) {
    if (!this.ending) this.time += dt
    const hold = this.holdDuration()
    const gravityOn = hold > HOLD_START
    const compressing = hold > COMPRESS_START
    this.compress = compressing ? Math.min(1, (hold - COMPRESS_START) / COMPRESS_FULL) : 0
    if (this.compress >= 1) {
      this.formBlackHole(this.pointer.x, this.pointer.y)
      this.pressed = false
      this.compress = 0
      this.suppressTap = true
    }

    const cx = this.w / 2
    const cy = this.h / 2
    const bound = Math.min(this.w, this.h) * 0.5
    const px = this.pointer.x
    const py = this.pointer.y
    const pull = compressing ? 900 : 340

    // dust physics
    for (const d of this.dust) {
      if (gravityOn) {
        const dx = px - d.x
        const dy = py - d.y
        const dist = Math.hypot(dx, dy) + 20
        const f = (pull / dist) * dt
        d.vx += (dx / dist) * f * 60
        d.vy += (dy / dist) * f * 60
      }
      for (const s of this.stars) {
        const dx = s.x - d.x
        const dy = s.y - d.y
        const dist = Math.hypot(dx, dy) + 12
        if (dist < 240) {
          const f = ((s.mass * 5.5) / (dist * dist)) * dt * 60
          d.vx += (dx / dist) * f
          d.vy += (dy / dist) * f
        }
      }
      for (const hle of this.holes) {
        const dx = hle.x - d.x
        const dy = hle.y - d.y
        const dist = Math.hypot(dx, dy) + 8
        const f = ((hle.mass * 16) / (dist * dist)) * dt * 60
        d.vx += (dx / dist) * f
        d.vy += (dy / dist) * f
      }
      // soft containment
      const ddx = d.x - cx
      const ddy = d.y - cy
      const dd = Math.hypot(ddx, ddy)
      if (dd > bound) {
        d.vx -= (ddx / dd) * (dd - bound) * 0.9 * dt
        d.vy -= (ddy / dd) * (dd - bound) * 0.9 * dt
      }
      const damp = Math.pow(0.9985, dt * 60 * (gravityOn ? 0.4 : 1))
      d.vx *= damp
      d.vy *= damp
      d.x += d.vx * dt
      d.y += d.vy * dt
    }

    // stars drift, absorb dust, may collapse
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i]
      if (gravityOn) {
        const dx = px - s.x
        const dy = py - s.y
        const dist = Math.hypot(dx, dy) + 40
        const f = ((pull * 0.35) / dist) * dt * 60
        s.vx += (dx / dist) * f
        s.vy += (dy / dist) * f
      }
      for (const hle of this.holes) {
        const dx = hle.x - s.x
        const dy = hle.y - s.y
        const dist = Math.hypot(dx, dy) + 10
        const f = ((hle.mass * 10) / (dist * dist)) * dt * 60
        s.vx += (dx / dist) * f
        s.vy += (dy / dist) * f
        if (dist < 10 + Math.sqrt(hle.mass) * 2 + Math.sqrt(s.mass)) {
          hle.mass += s.mass * 0.9
          this.stars.splice(i, 1)
          this.emit('star-swallowed', s.x, s.y)
          this.fx.push({ kind: 'flash', x: s.x, y: s.y, age: 0, life: 0.4, max: 40, warm: 0.3 })
          this.addEntropy(4)
        }
      }
      if (!this.stars.includes(s)) continue
      const sdx = s.x - cx
      const sdy = s.y - cy
      const sd = Math.hypot(sdx, sdy)
      if (sd > bound * 0.92) {
        s.vx -= (sdx / sd) * (sd - bound * 0.92) * 0.5 * dt
        s.vy -= (sdy / sd) * (sd - bound * 0.92) * 0.5 * dt
      }
      s.vx *= Math.pow(0.997, dt * 60)
      s.vy *= Math.pow(0.997, dt * 60)
      s.x += s.vx * dt
      s.y += s.vy * dt
      // absorb nearby dust
      const rr = 6 + Math.sqrt(s.mass) * 1.6
      for (let j = this.dust.length - 1; j >= 0; j--) {
        const d = this.dust[j]
        if (Math.abs(d.x - s.x) < rr && Math.abs(d.y - s.y) < rr) {
          s.mass += 0.45
          this.dust.splice(j, 1)
        }
      }
      for (const p of s.planets) p.angle += p.speed * dt
      // overweight star collapses into a black hole
      if (s.mass > 120) {
        this.stars.splice(i, 1)
        this.holes.push({ x: s.x, y: s.y, vx: s.vx * 0.4, vy: s.vy * 0.4, mass: s.mass * 0.8, spin: 0 })
        this.emit('black-hole-formed', s.x, s.y)
        this.fx.push({ kind: 'darkring', x: s.x, y: s.y, age: 0, life: 1.1, max: 170, warm: 0.1 })
        this.addEntropy(9)
        if (!this.reduced) this.shake = Math.min(12, this.shake + 7)
      }
    }

    // black holes: eat dust, merge, slowly evaporate
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const hle = this.holes[i]
      hle.spin += dt * 2.4
      const horizon = 7 + Math.sqrt(hle.mass) * 1.8
      for (let j = this.dust.length - 1; j >= 0; j--) {
        const d = this.dust[j]
        if (Math.hypot(d.x - hle.x, d.y - hle.y) < horizon) {
          hle.mass += 0.8
          this.dust.splice(j, 1)
        }
      }
      for (let k = this.holes.length - 1; k > i; k--) {
        const o = this.holes[k]
        if (Math.hypot(o.x - hle.x, o.y - hle.y) < horizon + Math.sqrt(o.mass) * 1.8) {
          hle.mass += o.mass
          this.holes.splice(k, 1)
          this.emit('black-hole-merged', hle.x, hle.y)
          this.fx.push({ kind: 'darkring', x: hle.x, y: hle.y, age: 0, life: 0.8, max: 120, warm: 0 })
        }
      }
      hle.x += hle.vx * dt
      hle.y += hle.vy * dt
      hle.vx *= Math.pow(0.995, dt * 60)
      hle.vy *= Math.pow(0.995, dt * 60)
      hle.mass -= dt * (hle.mass < 24 ? 0.9 : 0.15)
      if (hle.mass < 6) {
        this.holes.splice(i, 1)
        this.emit('black-hole-evaporated', hle.x, hle.y)
        this.fx.push({ kind: 'flash', x: hle.x, y: hle.y, age: 0, life: 0.6, max: 60, warm: 0.2 })
        this.spawnDust(hle.x, hle.y, 8, 70, 0.2)
      }
    }

    // idle evolution: dust clumps into stars
    this.clumpTimer += dt
    if (this.clumpTimer > 0.45 && this.stars.length < 14) {
      this.clumpTimer = 0
      this.tryFormStars()
    }

    // idle evolution: stars capture planets
    this.evolveTimer += dt
    if (this.evolveTimer > 2.2) {
      this.evolveTimer = 0
      for (const s of this.stars) {
        if (this.time - s.born > 5 && s.planets.length < 3 && s.mass > 14 && Math.random() < 0.45) {
          let taken = 0
          for (let j = this.dust.length - 1; j >= 0 && taken < 6; j--) {
            const d = this.dust[j]
            if (Math.hypot(d.x - s.x, d.y - s.y) < 150) {
              taken++
              this.dust.splice(j, 1)
            }
          }
          if (taken >= 4) {
            s.planets.push({
              dist: 18 + Math.sqrt(s.mass) * 2.4 + s.planets.length * 13 + Math.random() * 8,
              angle: Math.random() * Math.PI * 2,
              speed: (0.5 + Math.random() * 0.7) * (Math.random() < 0.5 ? 1 : -1),
              size: 1.8 + Math.random() * 1.8,
              warm: Math.random(),
            })
            this.emit('planet-captured', s.x, s.y)
          }
        }
      }
    }

    // chaos mode: the universe acts on its own
    const every = this.mode.chaosEventEvery
    if (every !== null && !this.ending) {
      this.chaosTimer += dt
      if (this.chaosTimer >= every) {
        this.chaosTimer = 0
        this.chaosEvent()
      }
    }

    // fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].age += dt
      if (this.fx[i].age > this.fx[i].life) this.fx.splice(i, 1)
    }
    this.shake = Math.max(0, this.shake - dt * 18)

    // entropy relaxes toward kinetic energy of the dust
    let sp = 0
    for (const d of this.dust) sp += Math.hypot(d.vx, d.vy)
    const avg = this.dust.length ? sp / this.dust.length : 0
    const target = Math.min(100, avg * 1.15 * this.mode.entropyMul)
    this.entropy += (target - this.entropy) * Math.min(1, dt * 0.35)

    const t = this.totals()
    const ordered = t.starMass + t.planetMass
    const raw = t.total > 0 ? (ordered / t.total) * 100 : 0
    const holePenalty = t.total > 0 ? (t.holeMass / t.total) * 70 : 0
    const targetStab = Math.max(0, Math.min(100, raw - holePenalty - this.entropy * 0.15 + 8))
    this.stability += (targetStab - this.stability) * Math.min(1, dt * 0.8)

    this.checkEndings(t)
  }

  private tryFormStars() {
    const cell = 46
    const cols = Math.ceil(this.w / cell)
    const buckets = new Map<number, Dust[]>()
    for (const d of this.dust) {
      const k = Math.floor(d.x / cell) + Math.floor(d.y / cell) * cols
      let b = buckets.get(k)
      if (!b) {
        b = []
        buckets.set(k, b)
      }
      b.push(d)
    }
    for (const [, b] of buckets) {
      if (b.length >= 16) {
        let x = 0
        let y = 0
        for (const d of b) {
          x += d.x
          y += d.y
        }
        x /= b.length
        y /= b.length
        this.dust = this.dust.filter((d) => !b.includes(d))
        this.stars.push({
          x,
          y,
          vx: 0,
          vy: 0,
          mass: b.length * 0.9,
          born: this.time,
          seed: Math.random() * 10,
          planets: [],
        })
        this.emit('star-formed', x, y)
        this.fx.push({ kind: 'ring', x, y, age: 0, life: 0.7, max: 70, warm: 0.6 })
        this.fx.push({ kind: 'flash', x, y, age: 0, life: 0.45, max: 40, warm: 0.55 })
        return
      }
    }
  }

  // random cosmic events for chaos mode: rogue nova, gravity surge, debris cloud
  private chaosEvent() {
    const x = this.w * (0.15 + Math.random() * 0.7)
    const y = this.h * (0.15 + Math.random() * 0.7)
    const roll = Math.random()
    if (roll < 0.34 && this.stars.length > 0) {
      this.supernova(this.stars[Math.floor(Math.random() * this.stars.length)])
      return
    }
    if (roll < 0.67 && this.dust.length > 0) {
      for (const d of this.dust) {
        const dx = d.x - x
        const dy = d.y - y
        const dist = Math.hypot(dx, dy) + 24
        if (dist < 280) {
          d.vx += (dx / dist) * (5200 / dist)
          d.vy += (dy / dist) * (5200 / dist)
        }
      }
      this.fx.push({ kind: 'ring', x, y, age: 0, life: 0.8, max: 170, warm: 0.3 })
      this.addEntropy(5)
      if (!this.reduced) this.shake = Math.min(8, this.shake + 4)
      return
    }
    this.spawnDust(x, y, this.reduced ? 10 : 18, 85, 0.5)
    this.fx.push({ kind: 'flash', x, y, age: 0, life: 0.5, max: 46, warm: 0.5 })
    this.addEntropy(3)
  }

  private checkEndings(t: { starMass: number; planetMass: number; holeMass: number; dustMass: number; total: number }) {
    if (this.ending || this.time < 18 || !this.mode.endingsEnabled) return
    if (t.total > 40 && t.holeMass / t.total > 0.62) {
      this.ending = ENDINGS.collapse
      this.emit('ending', undefined, undefined, this.ending.kind)
      return
    }
    if (this.holes.length > 0 && this.stars.length === 0 && this.dust.length < 6) {
      this.ending = ENDINGS.collapse
      this.emit('ending', undefined, undefined, this.ending.kind)
      return
    }
    if (this.time > 50 && this.holes.length === 0 && this.stars.length === 0 && this.dust.length < 12) {
      this.ending = ENDINGS.heat
      this.emit('ending', undefined, undefined, this.ending.kind)
      return
    }
    if (this.time > 90 && this.stars.length >= 4 && this.stability > 75 && this.entropy < 40) {
      this.ending = ENDINGS.stable
      this.emit('ending', undefined, undefined, this.ending.kind)
      return
    }
    const naturalEnd = this.mode.naturalEnd
    if (naturalEnd !== null && this.time >= naturalEnd) {
      if (this.stars.length >= 3 && this.stability >= 55 && this.entropy < 60) {
        this.ending = ENDINGS.stable
      } else if (t.total >= 110 || this.entropy >= 55) {
        this.ending = ENDINGS.chaos
      } else {
        this.ending = ENDINGS.heat
      }
      if (this.ending) this.emit('ending', undefined, undefined, this.ending.kind)
    }
  }

  private render() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.shake > 0.2 && !this.reduced) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
    }
    // trails
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = this.reduced ? 'rgba(4,6,10,0.5)' : 'rgba(4,6,10,0.22)'
    ctx.fillRect(-16, -16, this.w + 32, this.h + 32)
    if (this.starfield) {
      ctx.globalAlpha = 0.05
      ctx.drawImage(this.starfield, 0, 0, this.w, this.h)
      ctx.globalAlpha = 1
    }

    ctx.globalCompositeOperation = 'lighter'

    // dust
    for (const d of this.dust) {
      const warm = Math.max(0, Math.min(1, d.warm))
      ctx.fillStyle = `rgba(${mix(CYAN, AMBER, warm)},0.7)`
      ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s)
    }

    // stars with glow and planets
    const now = performance.now() / 1000
    for (const s of this.stars) {
      const r = 4 + Math.sqrt(s.mass) * 1.3
      const flick = 1 + Math.sin(now * 5 + s.seed * 7) * (this.reduced ? 0.02 : 0.07)
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4)
      const heavy = s.mass > 55
      glow.addColorStop(0, `rgba(${heavy ? mix(AMBER, [255, 255, 255], 0.3) : '244,246,250'},0.9)`)
      glow.addColorStop(0.25, `rgba(${mix(AMBER, CYAN, heavy ? 0.1 : 0.5)},0.35)`)
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(s.x, s.y, r * 4 * flick, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(250,251,253,0.95)'
      ctx.beginPath()
      ctx.arc(s.x, s.y, r * flick, 0, Math.PI * 2)
      ctx.fill()
      for (const p of s.planets) {
        if (!this.reduced) {
          ctx.strokeStyle = 'rgba(150,180,195,0.1)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(s.x, s.y, p.dist, 0, Math.PI * 2)
          ctx.stroke()
        }
        const pxp = s.x + Math.cos(p.angle) * p.dist
        const pyp = s.y + Math.sin(p.angle) * p.dist
        ctx.fillStyle = `rgba(${mix(CYAN, AMBER, p.warm)},0.95)`
        ctx.beginPath()
        ctx.arc(pxp, pyp, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // black holes: accretion ring drawn additive, core drawn opaque
    for (const hle of this.holes) {
      const r = 7 + Math.sqrt(hle.mass) * 1.8
      const ring = ctx.createRadialGradient(hle.x, hle.y, r * 0.8, hle.x, hle.y, r * 2.6)
      ring.addColorStop(0, `rgba(${mix(AMBER, CYAN, 0.25)},0.5)`)
      ring.addColorStop(0.5, `rgba(${mix(CYAN, AMBER, 0.5)},0.12)`)
      ring.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = ring
      ctx.beginPath()
      ctx.arc(hle.x, hle.y, r * 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = `rgba(${AMBER.join(',')},0.7)`
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(hle.x, hle.y, r * 1.25, hle.spin, hle.spin + Math.PI * 1.4)
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#010204'
      ctx.beginPath()
      ctx.arc(hle.x, hle.y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(140,200,210,0.25)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.globalCompositeOperation = 'lighter'
    }

    // effects
    for (const f of this.fx) {
      const t = f.age / f.life
      if (f.kind === 'flash') {
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.max * (0.4 + t))
        g.addColorStop(0, `rgba(${mix([255, 255, 255], AMBER, f.warm)},${0.6 * (1 - t)})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.max * (0.4 + t), 0, Math.PI * 2)
        ctx.fill()
      } else {
        const rad = f.max * t
        ctx.strokeStyle =
          f.kind === 'darkring'
            ? `rgba(${CYAN.join(',')},${0.5 * (1 - t)})`
            : `rgba(${mix(CYAN, AMBER, f.warm)},${0.7 * (1 - t)})`
        ctx.lineWidth = f.kind === 'darkring' ? 2.5 : 2
        ctx.beginPath()
        ctx.arc(f.x, f.y, rad, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // pointer focus and hold feedback
    if (!this.ending) {
      const hold = this.holdDuration()
      ctx.strokeStyle = 'rgba(180,210,220,0.28)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(this.pointer.x, this.pointer.y, 10, 0, Math.PI * 2)
      ctx.stroke()
      if (hold > HOLD_START) {
        const spin = now * 3
        const rad = this.compress > 0 ? 44 - this.compress * 26 : 44
        ctx.strokeStyle =
          this.compress > 0
            ? `rgba(${AMBER.join(',')},${0.45 + this.compress * 0.5})`
            : `rgba(${CYAN.join(',')},0.5)`
        ctx.lineWidth = 1.6
        for (let i = 0; i < 3; i++) {
          ctx.beginPath()
          ctx.arc(this.pointer.x, this.pointer.y, rad + i * 12, spin + i, spin + i + Math.PI * 1.2)
          ctx.stroke()
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over'
  }

  getStats(): Stats {
    const t = this.totals()
    let phase = 'Dust Era'
    if (this.holes.length > 0 && t.holeMass > t.starMass) phase = 'Degenerate Era'
    else if (this.stars.length > 0) phase = 'Stelliferous Era'
    else if (this.time > 40 && this.dust.length < 30) phase = 'Fading Era'
    return {
      matter: Math.round(t.total),
      stars: this.stars.length,
      holes: this.holes.length,
      age: (this.time * GYR_PER_SEC).toFixed(1),
      entropy: Math.round(this.entropy),
      stability: Math.round(this.stability),
      phase,
      risk: this.compress,
      holding: this.pressed && this.holdDuration() > HOLD_START,
      ending: this.ending,
    }
  }
}
