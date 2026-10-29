import { useMemo, useState } from 'react'
import { ArrowLeft, Download, Footprints, HandHeart, Moon, Printer, Sprout } from 'lucide-react'
import { Screen } from '../components/ui.jsx'
import { desktop, inDesktop } from '../lib/ext.js'

const DAY = 86_400_000
const PERIODS = [[7, 'Last 7 days'], [30, 'Last 30 days'], [0, 'Everything']]
const REASONS = { apps: 'App hopping', tabs: 'Tab hopping', pause: 'Long pause', lens: 'Focus lens', demo: 'Demo' }
const ANSWERS = { yes: 'Yes, a nudge', later: 'Not now', pause: 'Paused for today' }

const dayKey = (ts) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function Stat({ icon: Icon, value, label, tint }) {
  return (
    <div className="glass flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tint}`}><Icon className="h-5 w-5 text-night-950" /></div>
      <div>
        <p className="font-display text-2xl font-extrabold leading-none">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}

// "My report": a kind summary built on this device from the encrypted local data.
// It is never uploaded; the user saves or prints it if they want to share it.
export default function Report({ wins, feedback, checkins, onBack }) {
  const [days, setDays] = useState(7)
  const [saved, setSaved] = useState(null)

  const r = useMemo(() => {
    const from = days ? Date.now() - days * DAY : 0
    const w = wins.filter((x) => x.at >= from)
    const c = checkins.filter((x) => x.at >= from)
    const span = days || Math.max(1, Math.min(30, Math.ceil((Date.now() - (wins[0]?.at || Date.now())) / DAY)))
    const bars = Array.from({ length: Math.min(span, 30) }, (_, i) => {
      const start = new Date(Date.now() - (Math.min(span, 30) - 1 - i) * DAY).setHours(0, 0, 0, 0)
      const inDay = w.filter((x) => x.at >= start && x.at < start + DAY)
      return { label: dayKey(start), starts: inDay.filter((x) => x.kind !== 'rest').length, rests: inDay.filter((x) => x.kind === 'rest').length }
    })
    const count = (list, key) => list.reduce((m, x) => ({ ...m, [x[key]]: (m[x[key]] || 0) + 1 }), {})
    return {
      starts: w.filter((x) => x.kind === 'start').length,
      steps: w.filter((x) => x.kind === 'step').length,
      rests: w.filter((x) => x.kind === 'rest').length,
      checkins: c.length,
      reasons: count(c, 'reason'),
      answers: count(c, 'answer'),
      bars,
      top: Math.max(1, ...bars.map((b) => b.starts + b.rests)),
      helps: Object.values(feedback).filter((v) => v.done + v.skipped > 0).sort((a, b) => b.done - a.done || a.skipped - b.skipped).slice(0, 6),
    }
  }, [days, wins, feedback, checkins])

  const save = async () => {
    if (inDesktop) setSaved(await desktop.saveReport())
    else window.print()
  }
  const period = PERIODS.find(([d]) => d === days)[1].toLowerCase()

  return (
    <Screen className="report pt-[30vh]">
      <div className="no-print flex items-center justify-between">
        <button onClick={onBack} className="chip hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> Kind wins</button>
        <button onClick={save} className="chip border-amber-300/60 bg-amber-300/15 text-amber-100 hover:bg-amber-300/25">
          {inDesktop ? <Download className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />} {inDesktop ? 'Save as PDF' : 'Print or save as PDF'}
        </button>
      </div>
      {saved && <p className="no-print mt-2 text-xs text-emerald-300" role="status">Saved to {saved}</p>}

      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-amber-300">Kindling · my report</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
        Your <span className="text-gradient">{period}</span>, gently
      </h1>
      <p className="mt-1 text-sm text-slate-400">Made on this device on {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}. Not a score and not a diagnosis.</p>

      <div className="no-print mt-4 flex flex-wrap gap-2">
        {PERIODS.map(([d, label]) => (
          <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
            className={`chip ${days === d ? 'border-amber-300/60 bg-amber-300/15 text-amber-200' : 'hover:bg-white/10'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon={Sprout} value={r.starts} label="tiny starts" tint="from-amber-300 to-pink-500" />
        <Stat icon={Footprints} value={r.steps} label="more steps after starting" tint="from-teal-300 to-emerald-500" />
        <Stat icon={Moon} value={r.rests} label="real rests" tint="from-indigo-400 to-violet-500" />
        <Stat icon={HandHeart} value={r.checkins} label="gentle check-ins" tint="from-sky-300 to-indigo-400" />
      </div>

      <section className="glass mt-4 p-4">
        <p className="font-display font-bold">Day by day</p>
        <p className="text-xs text-slate-400">Starts and steps (warm) and rests (cool). Quiet days are fine.</p>
        <div className="mt-3 flex h-28 gap-1" role="img" aria-label="Wins per day">
          {r.bars.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col justify-end" title={`${b.label}: ${b.starts} starts and steps, ${b.rests} rests`}>
              <div className="rounded-t bg-gradient-to-t from-violet-500 to-indigo-400" style={{ height: `${(b.rests / r.top) * 100}%` }} />
              <div className={`${b.rests ? '' : 'rounded-t'} bg-gradient-to-t from-pink-500 to-amber-300`} style={{ height: `${(b.starts / r.top) * 100}%` }} />
              {!b.starts && !b.rests && <div className="h-0.5 rounded bg-white/15" />}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{r.bars[0]?.label}</span><span>{r.bars.at(-1)?.label}</span></div>
      </section>

      <section className="glass mt-4 p-4">
        <p className="font-display font-bold">What seems to help</p>
        {r.helps.length === 0 ? <p className="mt-1 text-sm text-slate-400">Nothing learned yet. Every “Did it” teaches Kindling a little.</p> : (
          <ul className="mt-2 grid gap-1.5 text-sm">
            {r.helps.map((h) => (
              <li key={h.title} className="flex justify-between gap-3"><span>{h.title}</span><span className="shrink-0 text-slate-400">{h.done} done · {h.skipped} skipped</span></li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass mt-4 p-4">
        <p className="font-display font-bold">Check-ins</p>
        {r.checkins === 0 ? <p className="mt-1 text-sm text-slate-400">No check-ins in this period.</p> : (
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <ul className="grid gap-1">{Object.entries(r.reasons).map(([k, n]) => <li key={k} className="flex justify-between"><span>{REASONS[k] || k}</span><span className="text-slate-400">{n}</span></li>)}</ul>
            <ul className="grid gap-1">{Object.entries(r.answers).map(([k, n]) => <li key={k} className="flex justify-between"><span>{ANSWERS[k] || k}</span><span className="text-slate-400">{n}</span></li>)}</ul>
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-500">Kindling keeps this data encrypted on this device only. It does not diagnose ADHD, autism or any condition.</p>
    </Screen>
  )
}
