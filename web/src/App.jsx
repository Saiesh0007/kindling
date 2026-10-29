import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Scene from './three/Scene.jsx'
import { Dock, Screen, TiltCard } from './components/ui.jsx'
import CheckIn from './components/CheckIn.jsx'
import { CameraPill, LensCard } from './components/Lens.jsx'
import { SignalsCard } from './components/Signals.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Home from './screens/Home.jsx'
import Dump from './screens/Dump.jsx'
import Step from './screens/Step.jsx'
import Rest from './screens/Rest.jsx'
import Wins from './screens/Wins.jsx'
import Settings from './screens/Settings.jsx'
import Support from './screens/Support.jsx'
import Report from './screens/Report.jsx'
import { health, sequence } from './lib/api.js'
import { load, save, wipeAll } from './lib/store.js'
import { useLens } from './lib/lens.js'
import { chime } from './lib/sound.js'
import { clearExtensionData, desktop, inDesktop, inExtension, simulateSignal, syncSignals } from './lib/ext.js'

const DEFAULT_PREFS = {
  onboarded: false,
  signals: { enabled: false, tabs: false, pause: false, lens: false },
  lensWindow: 60,
  pausedUntil: 0,
  snoozedUntil: 0,
  readable: false,
  contrast: false,
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  useLLM: true,
  chime: true,
  restSound: { kind: 'off', volume: 0.5 },
}
const COOLDOWN_MS = 30 * 60_000
const LENS_SCREENS = ['home', 'wins', 'settings', 'dump']

// On-device learning: how well each strategy has worked for this user, from -1 to 1.
const scoreOf = ({ done = 0, skipped = 0 }) => (done - skipped) / (done + skipped + 1)

export default function App() {
  const [ready, setReady] = useState(false)
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [wins, setWins] = useState([])
  const [feedback, setFeedback] = useState({})
  const [checkins, setCheckins] = useState([])
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
      setFeedback(await load('feedback', {}))
      setCheckins(await load('checkins', []))
      setReady(true)
      if (location.hash === '#checkin') setCheckIn({ reason: 'demo' })
      if (location.hash === '#nudge') setScreen('home')
    })()
    health().then(setEngine)
    const id = setInterval(() => health().then(setEngine), 15_000)
    return () => clearInterval(id)
  }, [])

  // Desktop app: check-ins from system-wide signals, a soft chime with each notification,
  // and "Pause for today" from the tray.
  const chimeOn = useRef(true)
  chimeOn.current = prefs.chime
  useEffect(() => {
    if (!inDesktop) return
    const offChime = desktop.onChime(() => chimeOn.current && chime())
    const offCheckIn = desktop.onCheckIn(({ reason }) => setCheckIn((c) => c || { reason }))
    const offPause = desktop.onPause(() => {
      const d = new Date(); d.setHours(23, 59, 59, 999)
      setCheckIn(null)
      setPrefs((p) => ({ ...p, pausedUntil: d.getTime() }))
    })
    return () => { offChime(); offCheckIn(); offPause() }
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

  const rate = (strategy, key) => {
    if (!strategy || strategy.id === 'offline') return
    setFeedback((f) => {
      const cur = f[strategy.id] || { title: strategy.title, done: 0, skipped: 0 }
      const next = { ...f, [strategy.id]: { ...cur, title: strategy.title, [key]: cur[key] + 1 } }
      save('feedback', next)
      return next
    })
  }
  const scores = () => Object.fromEntries(Object.entries(feedback).map(([id, v]) => [id, scoreOf(v)]))

  const go = (s) => { setScreen(s); setRestDone(null); window.scrollTo({ top: 0 }) }

  // ---- task sequencing ----
  const ask = async (mode, extra = {}) => {
    setLoading(mode === 'start' ? true : mode)
    const res = await sequence({ task, energy, mode, use_llm: prefs.useLLM, feedback: scores(), ...extra })
    setLoading(false)
    return res
  }

  const submitDump = async (text) => {
    setTask(text)
    setLoading(true)
    const res = await sequence({ task: text, energy, mode: 'start', use_llm: prefs.useLLM, feedback: scores() })
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
    rate(result.strategy, 'done')
    setBurst((b) => b + 1)
    setPhase('done')
  }
  const onNext = () => { setIndex((i) => i + 1); setPhase('step') }
  const onSkip = () => {
    rate(result.strategy, 'skipped')
    return index < result.steps.length - 1 ? setIndex((i) => i + 1) : setPhase('skipped')
  }
  const onSmaller = async () => {
    const res = await ask('smaller', { current_step: result.steps[index], exclude: used })
    setResult({ ...res, steps: [...res.steps, ...result.steps.slice(index + 1)] })
    setIndex(0)
    setPhase('step')
  }
  const onChange = async () => {
    if (phase === 'step') rate(result.strategy, 'skipped')
    const res = await ask('change', { current_step: result.steps[index], exclude: used })
    setResult(res)
    if (res.strategy) setUsed((u) => [...u, res.strategy.id])
    setIndex(0)
    setPhase('step')
  }
  const onMore = onChange

  // ---- check-ins ----
  const simulate = () => ((inExtension || inDesktop) && prefs.signals.enabled ? simulateSignal() : setCheckIn({ reason: 'demo' }))
  const quiet = () => prefs.pausedUntil > Date.now() || prefs.snoozedUntil > Date.now()
  const lensOn = !inExtension && prefs.onboarded && prefs.signals.enabled && prefs.signals.lens && prefs.pausedUntil <= Date.now()
  const lens = useLens(lensOn, {
    windowSec: prefs.lensWindow,
    background: inDesktop,
    onStuck: ({ reasons }) => {
      if (quiet() || checkIn || !LENS_SCREENS.includes(screen) || restDone) return
      setCheckIn({ reason: 'lens', reasons })
      desktop?.notify('lens') // a Windows notification when Kindling is in the tray
    },
  })
  const stopLens = () => update({ signals: { ...prefs.signals, lens: false } })
  // Each check-in and its answer is kept (encrypted, on this device) for "My report".
  const logCheckIn = (answer) => setCheckins((list) => {
    const next = [...list, { at: Date.now(), reason: checkIn?.reason || 'demo', answer }].slice(-500)
    save('checkins', next)
    return next
  })
  const checkInYes = () => { logCheckIn('yes'); setCheckIn(null); go('home') }
  const checkInLater = () => { logCheckIn('later'); setCheckIn(null); update({ snoozedUntil: Date.now() + COOLDOWN_MS }) }
  const checkInPause = () => {
    const d = new Date(); d.setHours(23, 59, 59, 999)
    logCheckIn('pause')
    setCheckIn(null)
    update({ pausedUntil: d.getTime() })
  }

  const wipe = async () => {
    await wipeAll()
    clearExtensionData()
    setWins([])
    setFeedback({})
    setCheckins([])
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
      sound={prefs.restSound} setSound={(restSound) => update({ restSound })}
      onFinish={(o) => { addWin(`Rested: ${o.title.toLowerCase()}`, 'rest'); setRestDone(o) }} />
  } else if (screen === 'support' && result) {
    view = <Support key="support" message={result.message} onBack={() => go('rest')} />
  } else if (screen === 'wins') {
    view = <Wins key="wins" wins={wins} feedback={feedback} onReport={() => go('report')} />
  } else if (screen === 'report') {
    view = <Report key="report" wins={wins} feedback={feedback} checkins={checkins} onBack={() => go('wins')} />
  } else if (screen === 'settings') {
    view = <Settings key="settings" prefs={prefs} update={update} engine={engine} onWipe={wipe} />
  } else {
    view = <Home key="home" energy={energy} setEnergy={setEnergy} engine={engine} onSimulate={simulate}
      onStart={() => go('dump')} onRest={() => go('rest')}
      lens={<>
        {inDesktop && prefs.signals.enabled && (prefs.signals.tabs || prefs.signals.pause) && <SignalsCard signals={prefs.signals} />}
        <LensCard lens={lens} windowSec={prefs.lensWindow} onStop={stopLens} />
      </>} />
  }

  return (
    <>
      <Scene mood={mood} breath={breath} burst={burst} reducedMotion={prefs.reducedMotion} />
      <div aria-hidden className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-2/3 bg-gradient-to-t from-night-950 via-night-950/70 to-transparent" />
      <AnimatePresence mode="wait">{view}</AnimatePresence>
      {prefs.onboarded && !restDone && <Dock screen={screen === 'report' ? 'wins' : ['home', 'wins', 'settings'].includes(screen) ? screen : 'home'} go={go} />}
      {prefs.onboarded && <CameraPill status={lens.status} onStop={stopLens} />}
      <CheckIn open={!!checkIn} reason={checkIn?.reason} reasons={checkIn?.reasons} onYes={checkInYes} onLater={checkInLater} onPause={checkInPause} />
    </>
  )
}
