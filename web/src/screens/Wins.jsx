import { motion } from 'framer-motion'
import { Moon, Sprout, Footprints } from 'lucide-react'
import { Screen } from '../components/ui.jsx'

const ICON = { start: Sprout, step: Footprints, rest: Moon }
const TINT = { start: 'from-amber-300 to-pink-500', step: 'from-teal-300 to-emerald-500', rest: 'from-indigo-400 to-violet-500' }

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : new Date(ts).toLocaleDateString()
}

export default function Wins({ wins, feedback = {} }) {
  const helps = Object.entries(feedback).filter(([, v]) => v.done > 0).sort((a, b) => b[1].done - a[1].done).slice(0, 4)
  return (
    <Screen className="pt-[34vh]">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Your <span className="text-gradient">kind wins</span>
      </h1>
      <p className="mt-2 text-slate-300">No streaks. Nothing to break. Starts and rests both count.</p>
      {helps.length > 0 && (
        <div className="glass mt-5 p-4">
          <p className="font-display font-bold">What seems to <span className="text-gradient-cool">help you</span></p>
          <p className="text-xs text-slate-400">Kindling suggests these a little more often. Learned on this device only.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {helps.map(([id, v]) => (
              <span key={id} className="chip border-emerald-400/40 text-emerald-100">{v.title} · {v.done}×</span>
            ))}
          </div>
        </div>
      )}
      {wins.length === 0 ? (
        <div className="glass mt-6 p-6 text-center text-slate-300">
          Your garden is ready. Every tiny start you make grows here.
        </div>
      ) : (
        <ul className="mt-6 grid gap-2">
          {wins.slice().reverse().map((w, i) => {
            const Icon = ICON[w.kind] || Sprout
            return (
              <motion.li key={w.id} initial={{ opacity: 0, x: -20, rotateY: -20 }} animate={{ opacity: 1, x: 0, rotateY: 0 }} transition={{ delay: Math.min(i, 10) * 0.05 }}
                className="glass flex items-center gap-3 p-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${TINT[w.kind] || TINT.start}`}>
                  <Icon className="h-5 w-5 text-night-950" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{w.text}</p>
                  <p className="text-xs text-slate-400">{ago(w.at)}</p>
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Screen>
  )
}
