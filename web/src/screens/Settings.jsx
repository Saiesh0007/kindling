import { useState } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import { Screen, Toggle } from '../components/ui.jsx'
import { inExtension } from '../lib/ext.js'

export default function Settings({ prefs, update, engine, onWipe }) {
  const [confirm, setConfirm] = useState(false)
  const paused = prefs.pausedUntil > Date.now()
  const sig = (k, v) => update({ signals: { ...prefs.signals, [k]: v, ...(k === 'enabled' && !v ? { tabs: false, pause: false } : {}) } })
  const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }

  return (
    <Screen className="pt-[32vh]">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        You're in <span className="text-gradient">control</span>
      </h1>

      <section className="glass mt-5 p-5">
        <h2 className="font-display text-lg font-bold">Gentle check-ins</h2>
        <p className="text-sm text-slate-400">
          {inExtension ? 'Signals are counted on this device only.' : 'Signals need the Kindling browser extension. Settings here are saved for it.'}
        </p>
        <div className="mt-1 divide-y divide-white/10">
          <Toggle label="Allow gentle check-ins" checked={prefs.signals.enabled} onChange={(v) => sig('enabled', v)} />
          <Toggle label="Tab-hopping" hint="Number of tab switches per 5 min. Never URLs." checked={prefs.signals.tabs} disabled={!prefs.signals.enabled} onChange={(v) => sig('tabs', v)} />
          <Toggle label="Long pauses" hint="No mouse or keyboard for a while, then you return." checked={prefs.signals.pause} disabled={!prefs.signals.enabled} onChange={(v) => sig('pause', v)} />
          <Toggle label="Pause everything for today" checked={paused} onChange={(v) => update({ pausedUntil: v ? endOfDay() : 0 })} />
        </div>
      </section>

      <section className="glass mt-4 p-5">
        <h2 className="font-display text-lg font-bold">Comfort & accessibility</h2>
        <div className="mt-1 divide-y divide-white/10">
          <Toggle label="Dyslexia-friendly font" hint="Atkinson Hyperlegible, wider spacing" checked={prefs.readable} onChange={(v) => update({ readable: v })} />
          <Toggle label="High contrast" checked={prefs.contrast} onChange={(v) => update({ contrast: v })} />
          <Toggle label="Reduce motion" hint="Calms the 3D scene and animations" checked={prefs.reducedMotion} onChange={(v) => update({ reducedMotion: v })} />
          <Toggle label="Use local AI when available" hint={engine?.llm ? `Running: ${engine.model}` : 'No local model running, so the built-in engine is used'} checked={prefs.useLLM} onChange={(v) => update({ useLLM: v })} />
        </div>
      </section>

      <section className="glass mt-4 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Lock className="h-4 w-4 text-teal-300" /> Your data</h2>
        <p className="mt-1 text-sm text-slate-300">
          Wins and settings are encrypted (AES-GCM) in this browser. The server keeps nothing: no accounts, no chat logs.
          Kindling does not diagnose ADHD, autism or any condition.
        </p>
        {confirm ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn bg-rose-500 text-white hover:bg-rose-400" onClick={() => { onWipe(); setConfirm(false) }}>Yes, delete all</button>
            <button className="btn-ghost" onClick={() => setConfirm(false)}>Keep my data</button>
          </div>
        ) : (
          <button className="btn-ghost mt-4 w-full" onClick={() => setConfirm(true)}><Trash2 className="h-4 w-4" /> Delete all my data</button>
        )}
      </section>
    </Screen>
  )
}
