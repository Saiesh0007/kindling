import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Footprints, GlassWater, Wind, BedDouble } from 'lucide-react'
import { Screen, TiltCard } from '../components/ui.jsx'

const OPTIONS = [
  { id: 'breathe', icon: Wind, title: 'Breathe with the orb', text: 'Box breathing, about a minute', minutes: 1.1, color: 'from-sky-400 to-indigo-500' },
  { id: 'water', icon: GlassWater, title: 'Get some water', text: "I'll be here when you're back", minutes: 2, color: 'from-teal-300 to-cyan-500' },
  { id: 'move', icon: Footprints, title: 'Stretch or short walk', text: 'Five minutes, any pace', minutes: 5, color: 'from-emerald-300 to-teal-500' },
  { id: 'still', icon: BedDouble, title: 'Eyes closed, lie down', text: 'Ten quiet minutes', minutes: 10, color: 'from-violet-400 to-fuchsia-500' },
]
const BOX = [['Breathe in', 1], ['Hold', 1], ['Breathe out', 0], ['Hold', 0]] // 4s each

export default function Rest({ setBreath, onFinish, onBack }) {
  const [active, setActive] = useState(null)
  const [left, setLeft] = useState(0)
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!active) return
    const end = Date.now() + active.minutes * 60_000
    const id = setInterval(() => {
      const ms = end - Date.now()
      setLeft(Math.max(0, ms))
      if (active.id === 'breathe') {
        const t = (active.minutes * 60_000 - ms) / 1000
        const p = Math.floor(t / 4) % 4
        setPhase(p)
        const within = (t % 4) / 4
        setBreath(p === 0 ? within : p === 1 ? 1 : p === 2 ? 1 - within : 0)
      }
      if (ms <= 0) {
        clearInterval(id)
        setBreath(null)
        onFinish(active)
      }
    }, 100)
    return () => {
      clearInterval(id)
      setBreath(null)
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  if (active) {
    const mm = Math.floor(left / 60000)
    const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0')
    return (
      <Screen className="items-center pt-[44vh] text-center">
        {active.id === 'breathe' ? (
          <motion.p key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="font-display text-4xl font-extrabold text-gradient-cool">
            {BOX[phase][0]}…
          </motion.p>
        ) : (
          <p className="font-display text-3xl font-extrabold text-gradient-cool">{active.title}</p>
        )}
        <p className="mt-2 text-slate-300">Nothing else needs you right now. {mm}:{ss}</p>
        <button className="btn-ghost mt-6" onClick={() => onFinish(active)}>I'm back</button>
      </Screen>
    )
  }

  return (
    <Screen className="pt-[34vh]">
      <button onClick={onBack} className="chip mb-4 self-start hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Rest is <span className="text-gradient-cool">real progress</span>.
      </h1>
      <p className="mt-2 text-slate-300">Pick whatever sounds least effortful. Real rest, not doom-scrolling.</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => (
          <TiltCard key={o.id} className="cursor-pointer p-4" role="button" tabIndex={0} onClick={() => setActive(o)} onKeyDown={(e) => e.key === 'Enter' && setActive(o)}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${o.color}`}>
              <o.icon className="h-5 w-5 text-night-950" />
            </div>
            <p className="mt-3 font-semibold">{o.title}</p>
            <p className="text-sm text-slate-400">{o.text}</p>
          </TiltCard>
        ))}
      </div>
    </Screen>
  )
}
