import { useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, Sparkles, Wand2 } from 'lucide-react'
import { EnergyPicker, Screen, TiltCard } from '../components/ui.jsx'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Home({ energy, setEnergy, onStart, onRest, onSimulate, engine, lens }) {
  const [lowPrompt, setLowPrompt] = useState(false)
  const start = () => (energy === 1 && !lowPrompt ? setLowPrompt(true) : onStart())

  return (
    <Screen className="pt-[32vh]">
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <span className="chip" title="Which engine writes your steps">
          <span className={`h-2 w-2 rounded-full ${engine?.llm ? 'bg-emerald-400' : engine?.status === 'ok' ? 'bg-amber-300' : 'bg-rose-400'}`} />
          {engine?.llm ? `Local AI · ${engine.model}` : engine?.status === 'ok' ? 'Built-in engine' : 'Offline mode'}
        </span>
        <button className="chip hover:bg-white/10" onClick={onSimulate} title="Demo: simulate a possible stuck signal">
          <Wand2 className="h-3.5 w-3.5" /> Simulate signal
        </button>
      </div>

      <p className="text-sm font-semibold text-slate-400">{greeting()}</p>
      <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-5xl">
        What would feel <span className="text-gradient">kind</span> right now?
      </h1>

      <TiltCard className="mt-6 p-5">
        <p className="mb-3 font-semibold">How many spoons do you have?</p>
        <EnergyPicker value={energy} onChange={(v) => { setEnergy(v); setLowPrompt(false) }} />
      </TiltCard>

      {lowPrompt && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass mt-4 p-4 text-sm text-slate-200">
          Energy is really low. Rest might be the kindest choice, or we can try <em>one</em> very tiny step. Either is a good call.
        </motion.p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <motion.button whileHover={{ y: -4, rotateX: 8 }} whileTap={{ scale: 0.97 }} onClick={start}
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 p-5 text-left text-night-950 shadow-[0_20px_40px_-12px_rgba(251,146,60,0.7)] [transform-style:preserve-3d]">
          <Sparkles className="h-7 w-7" />
          <p className="mt-6 font-display text-xl font-extrabold">{lowPrompt ? 'One tiny step' : 'Help me start'}</p>
          <p className="text-sm font-semibold opacity-80">Brain-dump, get one step</p>
        </motion.button>
        <motion.button whileHover={{ y: -4, rotateX: 8 }} whileTap={{ scale: 0.97 }} onClick={onRest}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 p-5 text-left text-white shadow-[0_20px_40px_-12px_rgba(139,92,246,0.7)] [transform-style:preserve-3d]">
          <Moon className="h-7 w-7" />
          <p className="mt-6 font-display text-xl font-extrabold">I need rest</p>
          <p className="text-sm font-semibold opacity-85">Guided, guilt-free</p>
        </motion.button>
      </div>
      {lens}
    </Screen>
  )
}
