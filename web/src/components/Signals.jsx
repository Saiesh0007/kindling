import { useEffect, useState } from 'react'
import { Activity, Moon } from 'lucide-react'
import { TiltCard } from './ui.jsx'
import { Meter } from './Lens.jsx'
import { desktop } from '../lib/ext.js'

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Desktop app: live view of the system-wide signals, so it's clear what Kindling is counting.
// Counts and timers only; nothing here is stored.
export function SignalsCard({ signals }) {
  const [activity, setActivity] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    let live = true
    const tick = async () => {
      try {
        const [a, s] = await Promise.all([fetch('/api/desktop/activity').then((r) => r.json()), desktop.getStatus()])
        if (live) { setActivity(a); setStatus(s) }
      } catch {
        // the server is starting; try again on the next tick
      }
    }
    tick()
    const id = setInterval(tick, 2000)
    return () => { live = false; clearInterval(id) }
  }, [])

  const switches = activity ? activity.switches + activity.tabs : 0
  const threshold = activity?.threshold || 12
  const idle = status?.idleSeconds || 0
  const idleLimit = status?.idleThreshold || 180
  const quietMin = status ? Math.ceil((status.quietUntil - Date.now()) / 60000) : 0

  return (
    <TiltCard className="mt-4 p-5" still data-switches={switches} data-idle={idle}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-teal-300">
          <Activity className="h-5 w-5 text-night-950" />
        </div>
        <div>
          <p className="font-display font-bold">Gentle signals <span className="text-xs font-semibold text-slate-400">· live, on this laptop</span></p>
          <p className="text-sm text-slate-400">Counts and timers only. Titles are never stored.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {signals.tabs && (
          <div>
            <Meter label="App and tab hopping" value={Math.min(1, switches / threshold)} text={`${switches} of ${threshold} in 5 min`} from="from-violet-300" to="to-pink-400" />
            <p className="mt-1 text-xs text-slate-400">{activity ? `${activity.switches} app switches · ${activity.tabs} tab switches` : 'Starting…'}</p>
          </div>
        )}
        {signals.pause && (
          <div>
            <Meter label="Long pause" value={Math.min(1, idle / idleLimit)} text={idle < 2 ? 'active' : `no input for ${clock(idle)}`} from="from-sky-300" to="to-indigo-400" />
            <p className="mt-1 text-xs text-slate-400">
              {idle >= idleLimit ? 'A pause has started. Kindling will gently welcome you back if you return within 20 minutes.' : `After ${clock(idleLimit)} with no keyboard or mouse, a return gets a gentle welcome back.`}
            </p>
          </div>
        )}
      </div>
      {quietMin > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-white/5 p-2.5 text-xs text-slate-300">
          <Moon className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
          Check-ins are resting for {quietMin >= 60 ? 'the rest of today' : `${quietMin} min`}, after the last check-in or a “Not now”.
        </p>
      )}
    </TiltCard>
  )
}
