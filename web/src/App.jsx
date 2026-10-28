import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Scene from './three/Scene.jsx'
import { Dock, Screen, TiltCard } from './components/ui.jsx'
import CheckIn from './components/CheckIn.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Dump from './screens/Dump.jsx'
import Step from './screens/Step.jsx'
import Rest from './screens/Rest.jsx'
import Wins from './screens/Wins.jsx'
import Settings from './screens/Settings.jsx'
import Support from './screens/Support.jsx'
import { health, sequence } from './lib/api.js'
import { load, save, wipeAll } from './lib/store.js'
import { clearExtensionData, inExtension, simulateSignal, syncSignals } from './lib/ext.js'

const DEFAULT_PREFS = {
  onboarded: false,
  signals: { enabled: false, tabs: false, pause: false },
  pausedUntil: 0,
  snoozedUntil: 0,
  readable: false,
  contrast: false,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  useLLM: true,
}
const COOLDOWN_MS = 30 * 60_000

export default function App() {
  const [ready, setReady] = useState(false)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [wins, setWins] = useState([])
  const [screen, setScreen] = useState('home')
  const [energy, setEnergy] = useState(3)
  const [task, setTask] = useState('')
  const [result, setResult] = useState(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState('step')
  const [used, setUsed] = useState([])
  const [loading, setLoading] = useState(false)
  const [checkIn, setCheckIn] = useState(null)
  const [breath, setBreath] = useState(null)
  const [burst, setBurst] = useState(0)
  const [engine, setEngine] = useState(null)
  const [restDone, setRestDone] = useState(null)
  const firstLoad = useRef(true)

  useEffect(() => {
    (async () => {
      const p = { ...DEFAULT_PREFS, ...(await load('prefs', {})) }
      setPrefs(p)
      setWins(await load('wins', []))
      setReady(true)
      if (location.hash === '#checkin') setCheckIn('demo')
      if (location.hash === '#nudge') setScreen('home')
    })()
    health().then(setEngine)
    const id = setInterval(() => health().then(setEngine), 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('readable', prefs.readable)
    root.classList.toggle('hc', prefs.contrast)
    root.classList.toggle('calm', prefs.reducedMotion)
    if (!ready) return
    if (firstLoad.current) { firstLoad.current = false; syncSignals(prefs); return }
    save('prefs', prefs)
    syncSignals(prefs)
  }, [prefs, ready])

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), [])

  const addWin = (text, kind) => {
    setWins((w) => {
      const next = [...w, { id: crypto.randomUUID(), text, kind, at: Date.now() }].slice(-200)
      save('wins', next)
      return next
    })
  }

  const go = (s) => { setScreen(s); setRestDone(null); window.scrollTo({ top: 0 }) }

  // ---- task sequencing ----
  const ask = async (mode, extra = {}) => {
    setLoading(mode === 'start' ? true : mode)
    const res = await sequence({ task, energy, mode, use_llm: prefs.useLLM, ...extra })
    setLoading(false)
    return res
  }

  const submitDump = async (text) => {
    setTask(text)
    setLoading(true)
    const res = await sequence({ task: text, energy, mode: 'start', use_llm: prefs.useLLM })
    setLoading(false)
    if (res.kind === 'support') { setResult(res); go('support'); return }
    setResult(res)
    setUsed(res.strategy ? [res.strategy.id] : [])
    setIndex(0)
    setPhase('step')
    go('step')
  }

  const onDone = () => {
    const step = result.steps[index]
    addWin(index === 0 ? `Started: ${step}` : step, index === 0 ? 'start' : 'step')
    setBurst((b) => b + 1)
    setPhase('done')
  }
  const onNext = () => { setIndex((i) => i + 1); setPhase('step') }
  const onSkip = () => (index < result.steps.length - 1 ? setIndex((i) => i + 1) : setPhase('skipped'))
  const onSmaller = async () => {
    const res = await ask('smaller', { current_step: result.steps[index], exclude: used })
    setResult({ ...res, steps: [...res.steps, ...result.steps.slice(index + 1)] })
    setIndex(0)
    setPhase('step')
  }
  const onChange = async () => {
    const res = await ask('change', { current_step: result.steps[index], exclude: used })
    setResult(res)
    if (res.strategy) setUsed((u) => [...u, res.strategy.id])
    setIndex(0)
    setPhase('step')
  }
  const onMore = onChange

  // ---- check-ins ----
  const simulate = () => (inExtension && prefs.signals.enabled ? simulateSignal() : setCheckIn('demo'))
  const checkInYes = () => { setCheckIn(null); go('home') }
  const checkInLater = () => { setCheckIn(null); update({ snoozedUntil: Date.now() + COOLDOWN_MS }) }
  const checkInPause = () => {
    const d = new Date(); d.setHours(23, 59, 59, 999)
    setCheckIn(null)
    update({ pausedUntil: d.getTime() })
  }

  const wipe = async () => {
    await wipeAll()
    clearExtensionData()
    setWins([])
    setPrefs({ ...DEFAULT_PREFS })
    go('home')
  }

  const mood = screen === 'rest' || screen === 'support' || restDone ? 'rest' : energy
  if (!ready) return <Scene mood={3} reducedMotion={prefs.reducedMotion} />

  let view
  if (!prefs.onboarded) {
    view = <Onboarding key="onb" prefs={prefs} onDone={(signals) => update({ onboarded: true, signals })} />
  } else if (restDone) {
    view = (
      <Screen key="restdone" className="pt-[40vh]">
        <TiltCard className="p-6 text-center">
          <p className="font-display text-3xl font-extrabold"><span className="text-gradient-cool">Welcome back.</span></p>
          <p className="mt-2 text-slate-300">Rest counts. It's in your kind wins. What feels right now?</p>
          <div className="mt-5 grid gap-2">
            <button className="btn-primary" onClick={() => { setRestDone(null); go('dump') }}>Try one tiny step</button>
            <button className="btn-ghost" onClick={() => { setRestDone(null); go('rest') }}>Rest a bit more</button>
            <button className="btn-ghost" onClick={() => go('home')}>Done for now</button>
          </div>
        </TiltCard>
      </Screen>
    )
  } else if (screen === 'dump') {
    view = <Dump key="dump" initial={task} loading={loading} onSubmit={submitDump} onBack={() => go('home')} />
  } else if (screen === 'step' && result) {
    view = (
      <Step key="step" result={result} index={index} phase={phase} loading={loading}
        onDone={onDone} onSmaller={onSmaller} onChange={onChange} onSkip={onSkip} onNext={onNext} onMore={onMore}
        onStop={() => go('wins')} onBack={() => go('dump')} />
    )
  } else if (screen === 'rest') {
    view = <Rest key="rest" setBreath={setBreath} onBack={() => go('home')}
      onFinish={(o) => { addWin(`Rested: ${o.title.toLowerCase()}`, 'rest'); setRestDone(o) }} />
  } else if (screen === 'support' && result) {
    view = <Support key="support" message={result.message} onBack={() => go('rest')} />
  } else if (screen === 'wins') {
    view = <Wins key="wins" wins={wins} />
  } else if (screen === 'settings') {
    view = <Settings key="settings" prefs={prefs} update={update} engine={engine} onWipe={wipe} />
  } else {
    view = <Home key="home" energy={energy} setEnergy={setEnergy} engine={engine} onSimulate={simulate}
      onStart={() => go('dump')} onRest={() => go('rest')} />
  }

  return (
    <>
      <Scene mood={mood} breath={breath} burst={burst} reducedMotion={prefs.reducedMotion} />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-2/3 bg-gradient-to-t from-night-950 via-night-950/70 to-transparent" />
      <AnimatePresence mode="wait">{view}</AnimatePresence>
      {prefs.onboarded && !restDone && <Dock screen={['home', 'wins', 'settings'].includes(screen) ? screen : 'home'} go={go} />}
      <CheckIn open={!!checkIn} reason={checkIn} onYes={checkInYes} onLater={checkInLater} onPause={checkInPause} />
    </>
  )
}
