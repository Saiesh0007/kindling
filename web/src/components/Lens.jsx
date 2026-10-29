import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, ScanFace, X } from 'lucide-react'
import { TiltCard } from './ui.jsx'

const STATE = {
  calibrating: ['Getting to know your normal…', 'text-sky-300'],
  settled: ['Looks settled. No nudge needed.', 'text-emerald-300'],
  active: ['Moving around. All good.', 'text-teal-300'],
  away: ['No face in view. Away is fine.', 'text-violet-300'],
  stuck: ['Might be a stuck moment…', 'text-amber-300'],
}

export function Meter({ label, value, text, from, to }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{text}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className={`h-full rounded-full bg-gradient-to-r ${from} ${to}`} animate={{ width: `${Math.round(value * 100)}%` }} transition={{ duration: 0.3 }} />
      </div>
    </div>
  )
}

function Preview({ videoRef }) {
  const el = useRef(null)
  useEffect(() => {
    const src = videoRef.current?.srcObject
    if (el.current && src && el.current.srcObject !== src) { el.current.srcObject = src; el.current.play().catch(() => {}) }
  })
  return <video ref={el} muted playsInline className="mt-3 aspect-[4/3] w-full -scale-x-100 rounded-2xl object-cover ring-1 ring-white/15" />
}

// Live view of what the lens measures. Numbers only; the preview is optional and never saved.
export function LensCard({ lens, windowSec, onStop }) {
  const [preview, setPreview] = useState(false)
  const { status, metrics: m, error } = lens
  if (status === 'off') return null

  return (
    <TiltCard className="mt-4 p-5" still data-lens-state={m?.state} data-lens-fps={m?.fps} data-lens-presence={m?.presence?.toFixed(2)}>
      <div className="flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500">
          <ScanFace className="h-5 w-5 text-night-950" />
          {status === 'on' && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-night-950" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Focus lens <span className="text-xs font-semibold text-slate-400">· on-device</span></p>
          <p className={`text-sm ${error ? 'text-rose-300' : STATE[m?.state || 'calibrating'][1]}`}>
            {error || (status === 'loading' ? 'Starting the camera…' : status === 'hidden' ? 'Paused while this tab is hidden.' : STATE[m?.state || 'calibrating'][0])}
          </p>
        </div>
        {status !== 'error' && (
          <button className="chip hover:bg-white/10" onClick={() => setPreview((p) => !p)} aria-pressed={preview} title="Show what the camera sees (never saved)">
            {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button className="chip hover:bg-white/10" onClick={onStop} aria-label="Turn the focus lens off"><X className="h-3.5 w-3.5" /></button>
      </div>

      {status === 'loading' && <Loader2 className="mx-auto mt-4 h-5 w-5 animate-spin text-slate-400" />}
      {m && status !== 'error' && (
        <div className="mt-4 grid gap-3">
          {!m.calibrated ? (
            <Meter label="Calibrating to you" value={m.calibration} text={`${Math.round(m.calibration * 100)}%`} from="from-sky-400" to="to-indigo-400" />
          ) : (
            <>
              <Meter label="Gaze stillness" value={m.stillness} text={`${Math.round(m.stillness * 100)}%`} from="from-teal-300" to="to-sky-400" />
              <Meter label="Blinks per minute" value={Math.min(1, m.bpm / 30)} text={m.bpm} from="from-indigo-300" to="to-violet-400" />
              <Meter label="Tension vs your normal" value={m.tension} text={m.tension > 0.5 ? 'higher' : m.tension > 0.2 ? 'a bit higher' : 'normal'} from="from-amber-300" to="to-pink-500" />
              <Meter label={`Stuck for ${windowSec}s → gentle check-in`} value={m.sustained} text={`${Math.round(m.sustained * 100)}%`} from="from-orange-300" to="to-rose-400" />
            </>
          )}
        </div>
      )}
      {preview && status !== 'error' && <Preview videoRef={lens.videoRef} />}
      <p className="mt-3 text-xs text-slate-400">Frames are analysed in memory and thrown away. Nothing is recorded or sent. These are hints, never a diagnosis.</p>
    </TiltCard>
  )
}

// Always-visible reminder that the camera is on, with a one-tap off switch.
export function CameraPill({ status, onStop }) {
  if (status === 'off' || status === 'error') return null
  return (
    <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={onStop}
      className="no-print chip fixed left-4 top-4 z-30 border-emerald-400/40 bg-night-950/90 backdrop-blur hover:bg-night-900" title="Turn the camera lens off">
      <span className={`h-2 w-2 rounded-full ${status === 'hidden' ? 'bg-slate-400' : 'animate-pulse bg-emerald-400'}`} />
      <span className="sm:hidden">Lens on</span><span className="hidden sm:inline">Camera lens on · tap to stop</span>
    </motion.button>
  )
}
