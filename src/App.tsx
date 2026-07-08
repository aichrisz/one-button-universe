import { useEffect, useRef, useState } from 'react'
import { Universe, GYR_PER_SEC, type EndingKind, type Stats, type UniverseEventKind } from './universe'
import { MODES, modeById, type ModeId } from './modes'
import { ACHIEVEMENTS, newlyUnlocked } from './achievements'
import { CODEX, unlockCodex } from './codex'
import { nextMission } from './missions'
import { EMPTY_PROGRESS, applyEvents, type Progress } from './progress'
import { Sound, type SoundKind } from './sound'
import { loadWithGuard, save } from './storage'
import { shareCard } from './share'

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

const SOUND_FOR: Partial<Record<UniverseEventKind, SoundKind>> = {
  tap: 'tap',
  'star-formed': 'star',
  'planet-captured': 'planet',
  supernova: 'nova',
  'star-split': 'nova',
  'black-hole-formed': 'hole',
  'black-hole-merged': 'merge',
  'black-hole-evaporated': 'evaporate',
  'star-swallowed': 'merge',
  ending: 'ending',
}

interface Toast {
  id: number
  kind: 'achievement' | 'codex'
  title: string
  desc: string
}

type ShareState = 'idle' | 'busy' | 'shared' | 'downloaded' | 'failed'

const SHARE_LABEL: Record<ShareState, string> = {
  idle: 'Share image',
  busy: 'Rendering',
  shared: 'Shared',
  downloaded: 'Saved as PNG',
  failed: 'Share failed',
}

const ENDING_KINDS: EndingKind[] = ['stable', 'collapse', 'heat', 'chaos']
const MODE_IDS: ModeId[] = ['classic', 'zen', 'challenge', 'chaos']

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === 'string')
}

function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && MODE_IDS.includes(value as ModeId)
}

function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    ['taps', 'starsFormed', 'planetsCaptured', 'supernovae', 'splits', 'holesFormed', 'holesMerged', 'starsSwallowed', 'evaporations', 'universes'].every(
      (key) => typeof p[key] === 'number' && Number.isFinite(p[key]),
    ) &&
    Array.isArray(p.endingsSeen) &&
    p.endingsSeen.every((x) => typeof x === 'string' && ENDING_KINDS.includes(x as EndingKind))
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<Universe | null>(null)
  const soundRef = useRef<Sound | null>(null)
  if (!soundRef.current) soundRef.current = new Sound()
  const sound = soundRef.current

  const progressRef = useRef<Progress>(loadWithGuard('progress', EMPTY_PROGRESS, isProgress))
  const unlockedRef = useRef<string[]>(loadWithGuard('achievements', [], isStringArray))
  const codexRef = useRef<string[]>(loadWithGuard('codex', [], isStringArray))
  const humRef = useRef(false)
  const toastId = useRef(0)

  const [stats, setStats] = useState<Stats>(EMPTY)
  const [hint, setHint] = useState(0)
  const [pressed, setPressed] = useState(false)
  const [modeId, setModeId] = useState<ModeId>(() => loadWithGuard('mode', 'classic' as ModeId, isModeId))
  const [progress, setProgress] = useState<Progress>(progressRef.current)
  const [unlocked, setUnlocked] = useState<string[]>(unlockedRef.current)
  const [codexSeen, setCodexSeen] = useState<string[]>(codexRef.current)
  const [muted, setMuted] = useState(sound.muted)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [panel, setPanel] = useState<'codex' | 'awards' | null>(null)
  const [shareState, setShareState] = useState<ShareState>('idle')

  const pushToasts = (items: Array<Omit<Toast, 'id'>>) => {
    const stamped = items.map((t) => ({ ...t, id: ++toastId.current }))
    setToasts((prev) => [...prev, ...stamped].slice(-3))
    for (const t of stamped) {
      window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4200)
    }
  }

  const commitProgress = (next: Progress) => {
    progressRef.current = next
    save('progress', next)
    setProgress(next)
    const fresh = newlyUnlocked(new Set(unlockedRef.current), next)
    if (fresh.length) {
      unlockedRef.current = [...unlockedRef.current, ...fresh.map((a) => a.id)]
      save('achievements', unlockedRef.current)
      setUnlocked(unlockedRef.current)
      pushToasts(fresh.map((a) => ({ kind: 'achievement' as const, title: a.title, desc: a.desc })))
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = new Universe(canvas, reduced)
    engine.setMode(modeById(modeId))
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

    const statsTimer = window.setInterval(() => {
      const s = engine.getStats()
      setStats(s)
      if (s.holding && !humRef.current) {
        humRef.current = true
        sound.startHum()
      } else if (!s.holding && humRef.current) {
        humRef.current = false
        sound.stopHum()
      }
      const events = engine.drainEvents()
      if (!events.length) return
      commitProgress(applyEvents(progressRef.current, events))
      const { seen, fresh } = unlockCodex(codexRef.current, events)
      if (fresh.length) {
        codexRef.current = seen
        save('codex', seen)
        setCodexSeen(seen)
        pushToasts(fresh.map((c) => ({ kind: 'codex' as const, title: c.title, desc: 'Recorded in the codex' })))
      }
      let played = 0
      for (const e of events) {
        const kind = SOUND_FOR[e.kind]
        if (kind && played < 4) {
          sound.play(kind)
          played++
        }
      }
    }, 200)
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
      sound.stopHum()
      humRef.current = false
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pressDown = () => {
    sound.ensure()
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

  const reset = (countUniverse = true) => {
    engineRef.current?.reset()
    setStats(EMPTY)
    setShareState('idle')
    if (countUniverse) {
      commitProgress({ ...progressRef.current, universes: progressRef.current.universes + 1 })
    }
  }

  const changeMode = (id: ModeId) => {
    if (id === modeId) return
    setModeId(id)
    save('mode', id)
    engineRef.current?.setMode(modeById(id))
    reset(false)
  }

  const toggleMute = () => {
    sound.ensure()
    const m = !muted
    sound.setMuted(m)
    setMuted(m)
  }

  const share = async () => {
    const canvas = canvasRef.current
    const engine = engineRef.current
    if (!canvas || !engine || shareState === 'busy') return
    setShareState('busy')
    try {
      const result = await shareCard(canvas, engine.getStats(), modeById(modeId).label)
      setShareState(result === 'cancelled' ? 'idle' : result)
    } catch {
      setShareState('failed')
    }
  }

  const e = stats.ending
  const cfg = modeById(modeId)
  const mission = nextMission(progress)
  const deadlineLeft =
    cfg.deadline !== null ? Math.max(0, cfg.deadline * GYR_PER_SEC - parseFloat(stats.age)) : null

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
          <button className="reset" onClick={() => reset()} aria-label="Start a new universe">
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
          {deadlineLeft !== null && !e && (
            <div className="stat deadline">
              <label>Deadline</label>
              <b>{deadlineLeft.toFixed(1)} Gyr</b>
            </div>
          )}
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
        <div className="hud-row hud-tools">
          <div className="modes" role="group" aria-label="Game mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`pill${m.id === modeId ? ' active' : ''}`}
                onClick={() => changeMode(m.id)}
                title={m.blurb}
                aria-pressed={m.id === modeId}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="tools">
            <button
              className={`tool${muted ? ' off' : ''}`}
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            >
              {muted ? 'Sound off' : 'Sound on'}
            </button>
            <button
              className={`tool${panel === 'codex' ? ' open' : ''}`}
              onClick={() => setPanel(panel === 'codex' ? null : 'codex')}
              aria-label="Toggle codex panel"
            >
              Codex {codexSeen.length}/{CODEX.length}
            </button>
            <button
              className={`tool${panel === 'awards' ? ' open' : ''}`}
              onClick={() => setPanel(panel === 'awards' ? null : 'awards')}
              aria-label="Toggle achievements panel"
            >
              Awards {unlocked.length}/{ACHIEVEMENTS.length}
            </button>
          </div>
        </div>
      </header>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-kicker">{t.kind === 'achievement' ? 'Achievement' : 'Codex'}</span>
            <b>{t.title}</b>
            <span className="toast-desc">{t.desc}</span>
          </div>
        ))}
      </div>

      {stats.risk > 0 && !e && (
        <div className="risk" style={{ opacity: 0.5 + stats.risk * 0.5 }}>
          Compression critical: {Math.round(stats.risk * 100)}%
        </div>
      )}

      {!e && mission && (
        <div className="mission" key={mission.id}>
          <span className="mission-tag">Mission</span>
          <span className="mission-text">{mission.text}</span>
        </div>
      )}
      {!e && !mission && (
        <p className="hint" key={hint}>
          {HINTS[hint]}
        </p>
      )}

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

      {panel && (
        <div className="panel-wrap" onClick={() => setPanel(null)}>
          <div className="panel" onClick={(ev) => ev.stopPropagation()}>
            <div className="panel-head">
              <h3>{panel === 'codex' ? 'Codex' : 'Achievements'}</h3>
              <span className="panel-count">
                {panel === 'codex'
                  ? `${codexSeen.length}/${CODEX.length}`
                  : `${unlocked.length}/${ACHIEVEMENTS.length}`}
              </span>
              <button className="panel-close" onClick={() => setPanel(null)} aria-label="Close panel">
                Close
              </button>
            </div>
            <ul className="panel-list">
              {panel === 'codex'
                ? CODEX.map((c) => {
                    const known = codexSeen.includes(c.id)
                    return (
                      <li key={c.id} className={known ? '' : 'locked'}>
                        <b>{known ? c.title : 'Undiscovered'}</b>
                        <p>{known ? c.body : 'Keep shaping the universe to reveal this entry.'}</p>
                      </li>
                    )
                  })
                : ACHIEVEMENTS.map((a) => {
                    const got = unlocked.includes(a.id)
                    return (
                      <li key={a.id} className={got ? '' : 'locked'}>
                        <b>{a.title}</b>
                        <p>{a.desc}</p>
                      </li>
                    )
                  })}
            </ul>
          </div>
        </div>
      )}

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
            <div className="ending-actions">
              <button className="share" onClick={share} disabled={shareState === 'busy'}>
                {SHARE_LABEL[shareState]}
              </button>
              <button className="again" onClick={() => reset()}>
                Begin a new universe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
