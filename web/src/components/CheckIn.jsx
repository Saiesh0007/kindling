import { AnimatePresence, motion } from 'framer-motion'
import { HandHeart, X } from 'lucide-react'

const REASONS = {
  tabs: 'You have been hopping between a lot of tabs.',
  pause: 'There was a long pause on the same screen.',
  demo: 'A possible stuck moment was noticed.',
  lens: 'The focus lens noticed a possible stuck moment.',
}

// The gentle check-in. One question, three equal-weight answers, dismissible with Esc or the X.
export default function CheckIn({ open, reason, reasons, onYes, onLater, onPause }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center bg-night-950/40 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onKeyDown={(e) => e.key === 'Escape' && onLater()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-title"
            initial={{ y: 60, rotateX: 25, opacity: 0 }}
            animate={{ y: 0, rotateX: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="glass relative w-full max-w-md p-6 [transform-style:preserve-3d]"
          >
            <button onClick={onLater} aria-label="Dismiss" className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-pink-500 shadow-lg shadow-pink-500/30">
              <HandHeart className="h-6 w-6 text-night-950" />
            </div>
            <h2 id="checkin-title" className="font-display text-2xl font-extrabold">
              Looks like a <span className="text-gradient">tricky moment</span>.
            </h2>
            <p className="mt-2 text-slate-300">
              {REASONS[reason] || REASONS.demo} That might mean nothing at all. Want a tiny nudge?
            </p>
            {reasons?.length > 0 && (
              <p className="mt-2 rounded-2xl bg-white/5 p-3 text-sm text-slate-300">
                <span className="font-semibold text-slate-200">Why I asked: </span>for the last little while, {reasons.join(', ')}.
              </p>
            )}
            <div className="mt-6 grid gap-2">
              <button autoFocus className="btn-primary" onClick={onYes}>Yes, a tiny nudge</button>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-ghost" onClick={onLater}>Not now</button>
                <button className="btn-ghost" onClick={onPause}>Pause for today</button>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">No streaks. No penalties. Saying no is always fine.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
