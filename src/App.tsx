import { useEffect, useRef, useState } from 'react'
import { Universe, type Stats } from './universe'

const HINTS = [
  'Tap to seed new matter',
  'Hold to pull with gravity',
  'Double tap near a star to trigger a supernova',
  'Hold longer and matter compresses. Black hole risk.',
  'Wait. The universe evolves on its own.',
]

const EMPTY: Stats = {
  matter: 0,
  stars: 0,
  holes: 0,
  age: '0.0',
  entropy: 0,
  stability: 50,
  phase: 'Dust Era',
  risk: 0,
  holding: false,
  ending: null,
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Universe | null>(null)
  const [stats, setStats] = useState<Stats>(EMPTY)
  const [hint, setHint] = useState(0)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = new Universe(canvas, reduced)
    engineRef.current = engine

    const fit = () => {
      const r = canvas.parentElement!.getBoundingClientRect()
      engine.resize(r.width, r.height, window.devicePixelRatio || 1)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas.parentElement!)

    let raf = 0
    const loop = (t: number) => {
      engine.frame(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const statsTimer = window.setInterval(() => setStats(engine.getStats()), 200)
    const hintTimer = window.setInterval(() => setHint((h) => (h + 1) % HINTS.length), 6000)

    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      engine.setPointer(e.clientX - r.left, e.clientY - r.top)
    }
    const onMove = (e: PointerEvent) => toCanvas(e)
    const onUp = () => {
      engine.pressUp()
      setPressed(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(statsTimer)
      clearInterval(hintTimer)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      engineRef.current = null
    }
  }, [])

  const pressDown = () => {
    engineRef.current?.pressDown()
    setPressed(true)
  }

  const onCanvasDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const r = canvas.getBoundingClientRect()
    engineRef.current?.setPointer(e.clientX - r.left, e.clientY - r.top)
    pressDown()
  }

  const reset = () => {
    engineRef.current?.reset()
    setStats(EMPTY)
  }

  const e = stats.ending

  return (
    <div className="app">
      <div className="stage">
        <canvas ref={canvasRef} onPointerDown={onCanvasDown} />
      </div>

      <header className="hud">
        <div className="hud-row hud-top">
          <h1>
            One Button <em>Universe</em>
          </h1>
          <span className="phase">{stats.phase}</span>
          <button className="reset" onClick={reset} aria-label="Start a new universe">
            New universe
          </button>
        </div>
        <div className="hud-row hud-stats">
          <div className="stat">
            <label>Matter</label>
            <b>{stats.matter}</b>
          </div>
          <div className="stat">
            <label>Stars</label>
            <b>{stats.stars}</b>
          </div>
          <div className="stat">
            <label>Black holes</label>
            <b>{stats.holes}</b>
          </div>
          <div className="stat">
            <label>Age</label>
            <b>{stats.age} Gyr</b>
          </div>
          <div className="stat bar-stat">
            <label>Stability</label>
            <div className="bar">
              <i className="bar-fill cyan" style={{ width: `${stats.stability}%` }} />
            </div>
          </div>
          <div className="stat bar-stat">
            <label>Entropy</label>
            <div className="bar">
              <i className="bar-fill amber" style={{ width: `${stats.entropy}%` }} />
            </div>
          </div>
        </div>
      </header>

      {stats.risk > 0 && !e && (
        <div className="risk" style={{ opacity: 0.5 + stats.risk * 0.5 }}>
          Compression critical: {Math.round(stats.risk * 100)}%
        </div>
      )}

      {!e && <p className="hint" key={hint}>{HINTS[hint]}</p>}

      <div className="dock">
        <button
          className={`the-button${pressed ? ' pressed' : ''}${stats.holding ? ' holding' : ''}`}
          onPointerDown={pressDown}
          aria-label="Act on the universe. Tap creates matter, hold pulls with gravity, double tap triggers a supernova, long hold risks a black hole."
        >
          <span className="ring r1" />
          <span className="ring r2" />
          <span className="core">Press</span>
        </button>
      </div>

      {e && (
        <div className={`ending ending-${e.kind}`}>
          <div className="ending-card">
            <span className="ending-kicker">The universe has concluded</span>
            <h2>{e.title}</h2>
            <p>{e.line}</p>
            <dl className="ending-stats">
              <div>
                <dt>Final age</dt>
                <dd>{stats.age} Gyr</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd>{stats.stars}</dd>
              </div>
              <div>
                <dt>Black holes</dt>
                <dd>{stats.holes}</dd>
              </div>
              <div>
                <dt>Entropy</dt>
                <dd>{stats.entropy}</dd>
              </div>
            </dl>
            <button className="again" onClick={reset}>
              Begin a new universe
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
