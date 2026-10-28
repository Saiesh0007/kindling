import { useState } from 'react'
import { Feather, ShieldCheck, Footprints } from 'lucide-react'
import { Screen, TiltCard, Toggle } from '../components/ui.jsx'

const POINTS = [
  [Footprints, 'One tiny step at a time', 'Never a long to-do list. Steps shrink to fit your energy.'],
  [Feather, 'Gentle, never pushy', 'No alarms, streaks or "overdue". Rest counts as a win.'],
  [ShieldCheck, 'Private by design', 'Your data stays encrypted on this device. Kindling does not diagnose anything.'],
]

export default function Onboarding({ prefs, onDone }) {
  const [signals, setSignals] = useState(prefs.signals)
  const set = (k, v) => setSignals((s) => ({ ...s, [k]: v, ...(k === 'enabled' && !v ? { tabs: false, pause: false } : {}) }))

  return (
    <Screen className="justify-end pt-[36vh]">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Kindling</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-tight sm:text-5xl">
        Starting is hard. <span className="text-gradient">Let's make it tiny.</span>
      </h1>
      <div className="mt-6 grid gap-3">
        {POINTS.map(([Icon, title, text]) => (
          <div key={title} className="glass flex gap-4 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-teal-300">
              <Icon className="h-5 w-5 text-night-950" />
            </div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-slate-300">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <TiltCard className="mt-4 p-5" still>
        <p className="font-display text-lg font-bold">Gentle check-ins (optional)</p>
        <p className="mt-1 text-sm text-slate-300">
          Kindling can notice <em>possible</em> signs of being stuck and offer help. These are hints, not proof of how you feel.
          Off unless you turn them on. You can pause anytime.
        </p>
        <div className="mt-2 divide-y divide-white/10">
          <Toggle label="Allow gentle check-ins" checked={signals.enabled} onChange={(v) => set('enabled', v)} />
          <Toggle label="Tab-hopping" hint="Counts tab switches per 5 minutes. Never which sites." checked={signals.tabs} disabled={!signals.enabled} onChange={(v) => set('tabs', v)} />
          <Toggle label="Long pauses" hint="Notices a long pause with no typing or mouse. Nothing is recorded." checked={signals.pause} disabled={!signals.enabled} onChange={(v) => set('pause', v)} />
        </div>
      </TiltCard>

      <button className="btn-primary mt-6 py-4 text-lg" onClick={() => onDone(signals)}>
        Begin gently
      </button>
    </Screen>
  )
}
