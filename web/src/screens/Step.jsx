import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, ChevronsDown, Info, Loader2, Shuffle, SkipForward } from 'lucide-react'
import { Screen, TiltCard } from '../components/ui.jsx'

// Explainable retrieval: shows which signals made this strategy the best fit.
function Why({ strategy, retrieval }) {
  const w = strategy.why
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden">
      <p className="text-sm text-slate-300">{strategy.summary}</p>
      {w && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {w.meaning != null && <span className="chip border-violet-400/40 text-violet-200">Meaning match {Math.round(w.meaning * 100)}%</span>}
          {w.keywords.length > 0 && <span className="chip border-sky-400/40 text-sky-200">Words: {w.keywords.join(', ')}</span>}
          {w.task_types.map((t) => <span key={t} className="chip border-teal-400/40 text-teal-200">Task: {t}</span>)}
          {w.energy_fit && <span className="chip border-amber-300/40 text-amber-200">Fits your spoons</span>}
          {w.personal > 0 && <span className="chip border-emerald-400/40 text-emerald-200">Helped you before</span>}
          {w.personal < 0 && <span className="chip border-slate-400/40 text-slate-300">Ranked lower: skipped before</span>}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Retrieved by {retrieval === 'hybrid' ? 'hybrid search (meaning + keywords)' : 'keyword search'} from 18 neurodivergent coping strategies.</p>
    </motion.div>
  )
}

// Shows exactly ONE step. The user chooses what happens next; nothing is forced.
export default function Step({ result, index, phase, loading, onDone, onSmaller, onChange, onSkip, onNext, onMore, onStop, onBack }) {
  const [why, setWhy] = useState(false)
  const step = result.steps[index]
  const hasNext = index < result.steps.length - 1

  return (
    <Screen className="pt-[32vh]">
      <button onClick={onBack} className="chip mb-4 self-start hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> New brain-dump</button>
      <p className="text-slate-300">{result.message}</p>

      <AnimatePresence mode="wait">
        {phase === 'step' ? (
          <motion.div key={step} initial={{ opacity: 0, rotateY: -25, y: 20 }} animate={{ opacity: 1, rotateY: 0, y: 0 }} exit={{ opacity: 0, rotateY: 25 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ perspective: 1000 }}>
            <TiltCard className="mt-4 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Your one tiny step</p>
              <p className="mt-3 font-display text-3xl font-extrabold leading-snug sm:text-4xl">
                <span className="text-gradient">{step}</span>
              </p>
              {result.strategy && (
                <div className="mt-5">
                  <button onClick={() => setWhy((w) => !w)} className="chip hover:bg-white/10" aria-expanded={why}>
                    <Info className="h-3.5 w-3.5" /> Strategy: {result.strategy.title}
                  </button>
                  {why && <Why strategy={result.strategy} retrieval={result.retrieval} />}
                </div>
              )}
            </TiltCard>
          </motion.div>
        ) : (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <TiltCard className="mt-4 p-6 text-center">
              <p className="font-display text-4xl font-extrabold">
                <span className="text-gradient">{phase === 'done' ? 'You started.' : 'Skipped. No problem.'}</span>
              </p>
              <p className="mt-2 text-slate-300">
                {phase === 'done' ? "That counts. It's saved to your kind wins." : 'Not every step fits. Want a different way in, or stop for now?'}
              </p>
              <div className="mt-6 grid gap-2">
                {hasNext ? (
                  <button className="btn-primary" onClick={onNext}>Next tiny step</button>
                ) : (
                  <button className="btn-primary" onClick={onMore} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Find another tiny step
                  </button>
                )}
                <button className="btn-ghost" onClick={onStop}>Stop here. That's a win</button>
              </div>
            </TiltCard>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'step' && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button className="btn-primary col-span-2 sm:col-span-1" onClick={onDone} disabled={loading}><Check className="h-4 w-4" /> Did it</button>
          <button className="btn-ghost" onClick={onSmaller} disabled={loading}>{loading === 'smaller' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsDown className="h-4 w-4" />} Smaller</button>
          <button className="btn-ghost" onClick={onChange} disabled={loading}>{loading === 'change' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />} Change</button>
          <button className="btn-ghost col-span-2 sm:col-span-1" onClick={onSkip} disabled={loading}><SkipForward className="h-4 w-4" /> Skip</button>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-slate-500">Written by: {result.engine === 'built-in' ? 'built-in engine' : result.engine}</p>
    </Screen>
  )
}
