import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Home, Sprout, Settings2 } from 'lucide-react'
import { ENERGY_COLORS } from '../three/Scene.jsx'

// A glass card that tilts toward the pointer in 3D. Children marked `data-depth` float above it.
export function TiltCard({ children, className = '', still = false, ...rest }) {
  const ref = useRef(null)
  const onMove = (e) => {
    if (still || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    ref.current.style.transform = `perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg)`
    ref.current.style.setProperty('--gx', `${(x + 0.5) * 100}%`)
    ref.current.style.setProperty('--gy', `${(y + 0.5) * 100}%`)
  }
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)'
  }
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`glass relative transition-transform duration-200 ease-out [transform-style:preserve-3d] ${className}`}
      {...rest}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-60"
        style={{ background: 'radial-gradient(400px circle at var(--gx,50%) var(--gy,0%), rgba(253,230,138,0.14), transparent 45%)' }}
      />
      <div className="relative [transform:translateZ(30px)]">{children}</div>
    </div>
  )
}

export function Screen({ children, className = '' }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.98 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`relative z-10 mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pb-28 pt-6 ${className}`}
    >
      {children}
    </motion.main>
  )
}

function Spoon({ filled, color }) {
  return (
    <svg viewBox="0 0 24 48" className="h-11 w-6" aria-hidden>
      <ellipse cx="12" cy="11" rx="8" ry="10" fill={filled ? color : 'transparent'} stroke={filled ? color : 'rgba(255,255,255,0.35)'} strokeWidth="2" />
      <rect x="10" y="20" width="4" height="25" rx="2" fill={filled ? color : 'rgba(255,255,255,0.35)'} />
    </svg>
  )
}

export const ENERGY_LABELS = { 1: 'Running on empty', 2: 'Low', 3: 'Okay-ish', 4: 'Pretty good', 5: 'Fired up' }

export function EnergyPicker({ value, onChange }) {
  const color = ENERGY_COLORS[value][0]
  return (
    <div>
      <div className="flex items-end justify-between gap-1" role="radiogroup" aria-label="Energy level, 1 to 5 spoons">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} spoon${n > 1 ? 's' : ''}: ${ENERGY_LABELS[n]}`}
            onClick={() => onChange(n)}
            className={`flex flex-1 flex-col items-center rounded-2xl py-2 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${value === n ? 'bg-white/10' : ''}`}
          >
            <motion.div animate={{ y: n <= value ? -4 : 0, scale: n <= value ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}>
              <Spoon filled={n <= value} color={color} />
            </motion.div>
            <span className="mt-1 text-xs font-semibold text-slate-400">{n}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-sm font-semibold" style={{ color }}>
        {ENERGY_LABELS[value]}
      </p>
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-slate-400">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${checked ? 'bg-gradient-to-r from-teal-400 to-emerald-400' : 'bg-white/15'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  )
}

export function Dock({ screen, go }) {
  const items = [
    ['home', Home, 'Home'],
    ['wins', Sprout, 'Kind wins'],
    ['settings', Settings2, 'Settings'],
  ]
  return (
    <nav className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
      <div className="glass flex gap-1 rounded-full p-1.5">
        {items.map(([id, Icon, label]) => {
          const active = screen === id
          return (
            <button
              key={id}
              onClick={() => go(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm sm:px-4 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${active ? 'text-night-950' : 'text-slate-300 hover:text-white'}`}
            >
              {active && <motion.span layoutId="dock" className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-300 to-pink-400" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
