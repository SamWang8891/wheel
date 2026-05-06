import { useEffect, useMemo, useRef, useState } from 'react'
import Wheel from './Wheel.jsx'

const DEFAULT_ITEMS = ['YES', 'NO']

// editorial-feeling palette (warm, cohesive, never saturated rainbow)
const PALETTE = [
  '#ff5d8f', // hot
  '#ffc857', // amber
  '#4fd1c5', // mint
  '#9b6bff', // violet
  '#ff8a5c', // coral
  '#5b86ff', // sky
  '#f0e9d2', // cream
  '#e26a8d', // rose
  '#48b89f', // jade
  '#ffaa3b', // sun
  '#7c5dff', // indigo
  '#ff7a9c', // peach
]

const STORAGE_KEY = 'wheel.items.v1'
const HISTORY_KEY = 'wheel.history.v1'

export default function App() {
  const [items, setItems] = useState(() => loadItems())
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState(null) // { label, ts }
  const [showModal, setShowModal] = useState(false)
  const [history, setHistory] = useState(() => loadHistory())
  const [removeWinner, setRemoveWinner] = useState(false)
  const [muted, setMuted] = useState(false)
  const [confettiSeed, setConfettiSeed] = useState(0)
  const [tickPulse, setTickPulse] = useState(0)

  const tickAudioRef = useRef(null)
  const winAudioRef = useRef(null)
  const tickRafRef = useRef(null)

  // persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {}
  }, [items])

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {}
  }, [history])

  // setup tiny WebAudio tick for haptic-feel
  useEffect(() => {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return
    const audio = new Ctor()
    tickAudioRef.current = {
      play() {
        if (muted) return
        try {
          const o = audio.createOscillator()
          const g = audio.createGain()
          o.type = 'square'
          o.frequency.value = 1200
          g.gain.value = 0.04
          g.gain.exponentialRampToValueAtTime(
            0.0001,
            audio.currentTime + 0.06
          )
          o.connect(g).connect(audio.destination)
          o.start()
          o.stop(audio.currentTime + 0.06)
        } catch {}
      },
    }
    winAudioRef.current = {
      play() {
        if (muted) return
        try {
          const now = audio.currentTime
          ;[660, 880, 990].forEach((f, i) => {
            const o = audio.createOscillator()
            const g = audio.createGain()
            o.type = 'triangle'
            o.frequency.value = f
            g.gain.value = 0.08
            g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4 + i * 0.1)
            o.connect(g).connect(audio.destination)
            o.start(now + i * 0.08)
            o.stop(now + 0.5 + i * 0.1)
          })
        } catch {}
      },
    }
    return () => audio.close?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addItem = () => {
    setItems((prev) => [...prev, ''])
  }

  const updateItem = (i, value) => {
    setItems((prev) => prev.map((v, idx) => (idx === i ? value : v)))
  }

  const removeItem = (i) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  const shuffle = () => {
    setItems((prev) => {
      const arr = [...prev]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    })
  }

  const reset = () => {
    setItems(DEFAULT_ITEMS)
  }

  const cleaned = useMemo(
    () => items.map((s) => s.trim()).filter(Boolean),
    [items]
  )

  const startSpin = () => {
    if (spinning || cleaned.length < 2) return
    const idx = Math.floor(Math.random() * cleaned.length)

    // current normalized rotation
    const current = ((rotation % 360) + 360) % 360
    const slice = 360 / cleaned.length
    // slice 0 sits centered at the top (we drew start0 = -π/2 - step/2)
    // so to bring slice idx to top, rotate so that idx*slice ends at 0deg
    const targetRotation = -idx * slice
    // add a few full revolutions for drama (5–7)
    const turns = 5 + Math.floor(Math.random() * 3)
    // tiny in-slice jitter so the pointer doesn't always land mid-slice
    const jitter = (Math.random() - 0.5) * (slice * 0.7)
    const next =
      rotation + (turns * 360) + (((targetRotation - current) % 360 + 360) % 360) + jitter

    setSpinning(true)
    setRotation(next)

    // tick whenever the pointer crosses a slice border. Sample the same
    // cubic-bezier curve CSS uses for the transform so the JS-tracked
    // angle stays in lockstep with the visual rotation.
    const total = 5600
    const ease = cubicBezier(0.18, 0.86, 0.24, 1)
    const startTime = performance.now()
    const startRot = rotation
    const endRot = next
    const step = 360 / cleaned.length
    const segmentAt = (deg) => Math.floor(-deg / step + 0.5)
    let lastSeg = segmentAt(startRot)
    const frame = () => {
      const elapsed = performance.now() - startTime
      const t = Math.min(elapsed / total, 1)
      const r = startRot + (endRot - startRot) * ease(t)
      const seg = segmentAt(r)
      if (seg !== lastSeg) {
        lastSeg = seg
        tickAudioRef.current?.play()
        setTickPulse((n) => n + 1)
      }
      if (t < 1) tickRafRef.current = requestAnimationFrame(frame)
    }
    tickRafRef.current = requestAnimationFrame(frame)

    setTimeout(() => {
      setSpinning(false)
      cancelAnimationFrame(tickRafRef.current)
      const label = cleaned[idx]
      const entry = { label, ts: Date.now() }
      setWinner(entry)
      setHistory((h) => [entry, ...h].slice(0, 20))
      setShowModal(true)
      setConfettiSeed((s) => s + 1)
      winAudioRef.current?.play()

      if (removeWinner) {
        // remove the chosen entry by matching the original (non-trimmed) source
        let removed = false
        setItems((prev) =>
          prev.filter((v) => {
            if (!removed && v.trim() === label) {
              removed = true
              return false
            }
            return true
          })
        )
      }
    }, 5650)
  }

  return (
    <>
      <div className="bg" />
      <div className="flair flair--lucky">Fortuna</div>
      <div className="flair flair--fortuna">Lucky</div>

      <div className="app">
        <header className="masthead">
          <div className="masthead__brand">
            <span className="dot" />
            <span>Midnight · Carnival</span>
          </div>
          <div className="masthead__title">
            <span className="masthead__kicker">No. 01 — 命運轉盤</span>
            <h1 className="masthead__h1">
              幸運 <em>轉盤</em>
            </h1>
          </div>
          <div className="masthead__meta">
            <div>
              <strong>{cleaned.length.toString().padStart(2, '0')}</strong>{' '}
              選項待命
            </div>
            <div>
              已抽 <strong>{history.length.toString().padStart(2, '0')}</strong> 次
            </div>
          </div>
        </header>

        <main className="layout">
          <section className="stage">
            <div className="stage__numerals">{cleaned.length || '—'}</div>

            <div className="wheel-wrap">
              <div className="wheel-rim" />
              <Studs count={Math.min(36, Math.max(18, cleaned.length * 2))} />
              <Pointer pulseKey={tickPulse} />

              <Wheel
                items={cleaned.length ? cleaned : []}
                palette={PALETTE}
                rotation={rotation}
                spinning={spinning}
              />

              <button
                className="center-btn"
                onClick={startSpin}
                disabled={spinning || cleaned.length < 2}
                aria-label="開始轉動"
              >
                {spinning ? '...' : 'SPIN'}
              </button>
            </div>

            <div className="stage__caption">
              <span className="line" />
              <span>
                {cleaned.length < 2
                  ? '至少需要兩個選項'
                  : spinning
                    ? '命運正在編織中…'
                    : '按下中央按鈕讓命運出手'}
              </span>
              <span className="line" />
            </div>
          </section>

          <aside>
            <div className="panel">
              <div className="panel__title">
                <h2>
                  Options<span>選項清單</span>
                </h2>
                <span className="panel__counter">
                  TOTAL <strong>{items.length}</strong>
                </span>
              </div>

              <div className="options">
                {items.map((value, i) => (
                  <div className="option" key={i}>
                    <span className="option__index">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <label className="option__field">
                      <span
                        className="option__color"
                        style={{ background: PALETTE[i % PALETTE.length] }}
                      />
                      <input
                        className="option__input"
                        value={value}
                        placeholder={`選項 ${i + 1}`}
                        maxLength={32}
                        onChange={(e) => updateItem(i, e.target.value)}
                      />
                    </label>
                    <button
                      className="icon-btn icon-btn--danger"
                      onClick={() => removeItem(i)}
                      aria-label="刪除"
                      disabled={spinning}
                    >
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M6 6l12 12M18 6L6 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="add-row">
                <button className="add-btn" onClick={addItem} disabled={spinning}>
                  <span>＋</span>
                  <span>新增選項</span>
                </button>
              </div>

              <div className="panel__divider" />

              <div className="settings">
                <div className="setting">
                  <span className="setting__label">中籤後移除</span>
                  <button
                    className={`toggle ${removeWinner ? 'toggle--on' : ''}`}
                    onClick={() => setRemoveWinner((v) => !v)}
                    aria-pressed={removeWinner}
                    aria-label="切換中籤後移除"
                  />
                </div>
                <div className="setting">
                  <span className="setting__label">音效</span>
                  <button
                    className={`toggle ${!muted ? 'toggle--on' : ''}`}
                    onClick={() => setMuted((v) => !v)}
                    aria-pressed={!muted}
                    aria-label="切換音效"
                  />
                </div>
              </div>

              <div className="actions">
                <button className="btn" onClick={shuffle} disabled={spinning}>
                  打亂
                </button>
                <button className="btn" onClick={reset} disabled={spinning}>
                  重置
                </button>
              </div>
            </div>

            <div className="history">
              <div className="history__head">
                <h3>近期戰果</h3>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])}>清除</button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="history__empty">— 尚無紀錄 —</div>
              ) : (
                <ul className="history__list">
                  {history.map((h, i) => (
                    <li className="history__item" key={h.ts + '-' + i}>
                      <span className="num">
                        #{(history.length - i).toString().padStart(2, '0')}
                      </span>
                      <span>{h.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </main>
      </div>

      {showModal && winner && (
        <ResultModal
          winner={winner.label}
          onClose={() => setShowModal(false)}
          onSpinAgain={() => {
            setShowModal(false)
            setTimeout(startSpin, 250)
          }}
        />
      )}

      {confettiSeed > 0 && <Confetti key={confettiSeed} />}
    </>
  )
}

/* ============================================================
   Sub-components
   ============================================================ */

function Pointer({ pulseKey }) {
  // re-mount briefly when pulseKey changes to retrigger animation
  return (
    <svg
      key={pulseKey}
      className="pointer pointer--ticking"
      viewBox="0 0 64 92"
      fill="none"
    >
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff5e1" />
          <stop offset="40%" stopColor="#ffc857" />
          <stop offset="100%" stopColor="#a87618" />
        </linearGradient>
        <linearGradient id="pg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe7a8" />
          <stop offset="100%" stopColor="#bf8a2a" />
        </linearGradient>
      </defs>
      {/* outer body */}
      <path
        d="M32 4
           C 50 4, 60 18, 60 36
           C 60 56, 32 88, 32 88
           C 32 88, 4 56, 4 36
           C 4 18, 14 4, 32 4 Z"
        fill="url(#pg)"
        stroke="#5d4116"
        strokeWidth="1.2"
      />
      {/* inner gem */}
      <circle cx="32" cy="34" r="9" fill="url(#pg2)" />
      <circle cx="32" cy="34" r="3.5" fill="#3a2810" />
      <circle cx="30" cy="32" r="1.4" fill="#fff8e8" />
    </svg>
  )
}

function Studs({ count }) {
  return (
    <div className="wheel-studs" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360
        // place each stud along the outer rim — radius matches --rim variable
        const r = 'calc(50% - var(--rim, 22px) / 2)'
        return (
          <span
            key={i}
            style={{
              transform: `rotate(${angle}deg) translate(${r}) rotate(-${angle}deg)`,
            }}
          />
        )
      })}
    </div>
  )
}

function ResultModal({ winner, onClose, onSpinAgain }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') onSpinAgain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSpinAgain])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} aria-label="關閉">
          ×
        </button>
        <div className="modal__kicker">命運揭曉</div>
        <h3 className="modal__winner">{winner}</h3>
        <div className="modal__sub">恭喜中籤 — {formatTime()}</div>
        <div className="modal__actions">
          <button className="btn" onClick={onClose}>
            收下
          </button>
          <button
            className="btn"
            style={{
              background:
                'linear-gradient(135deg, #ffc857, #ff5d8f)',
              color: '#1a0e2e',
              borderColor: 'transparent',
            }}
            onClick={onSpinAgain}
          >
            再轉一次
          </button>
        </div>
      </div>
    </div>
  )
}

function Confetti() {
  const pieces = useMemo(() => {
    const colors = ['#ff5d8f', '#ffc857', '#4fd1c5', '#9b6bff', '#ff8a5c', '#fff5e1']
    return Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.4 + Math.random() * 1.8,
      drift: (Math.random() - 0.5) * 240 + 'px',
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      width: 6 + Math.random() * 6,
      height: 10 + Math.random() * 10,
    }))
  }, [])

  // auto-clean after animation
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: `${p.width}px`,
            height: `${p.height}px`,
            transform: `rotate(${p.rotate}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': p.drift,
          }}
        />
      ))}
    </div>
  )
}

/* ============================================================
   Helpers
   ============================================================ */

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_ITEMS
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length) return parsed
  } catch {}
  return DEFAULT_ITEMS
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
  } catch {}
  return []
}

function cubicBezier(x1, y1, x2, y2) {
  const sampleX = (t) =>
    3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t
  const sampleY = (t) =>
    3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t
  const sampleDX = (t) =>
    3 * (1 - t) * (1 - t) * x1 +
    6 * (1 - t) * t * (x2 - x1) +
    3 * t * t * (1 - x2)
  return (progress) => {
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    let t = progress
    for (let i = 0; i < 8; i++) {
      const x = sampleX(t) - progress
      if (Math.abs(x) < 1e-6) break
      const dx = sampleDX(t)
      if (Math.abs(dx) < 1e-6) break
      t -= x / dx
    }
    return sampleY(t)
  }
}

function formatTime() {
  const d = new Date()
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
