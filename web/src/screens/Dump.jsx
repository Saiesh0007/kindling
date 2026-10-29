import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Mic, MicOff } from 'lucide-react'
import { Screen, TiltCard } from '../components/ui.jsx'
import { useSpeech } from '../lib/speech.js'

const EXAMPLES = [
  'I have a history essay on the French Revolution and I keep opening it and closing it',
  "I'm so overwhelmed, my DSA coding assignment is huge and I can't start",
  "I need to reply to my professor's email",
  'Revise for my maths exam on calculus',
]

export default function Dump({ initial = '', loading, onSubmit, onBack }) {
  const [text, setText] = useState(initial)
  const speech = useSpeech((t) => setText((v) => (v ? `${v} ${t}` : t)))
  // The built-in writer answers instantly; a local AI model on a laptop CPU can take 15-20 s.
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!loading) return setSlow(false)
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  return (
    <Screen className="pt-[32vh]">
      <button onClick={onBack} className="chip mb-4 self-start hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Brain-dump it. <span className="text-gradient">Messy is fine.</span>
      </h1>
      <p className="mt-2 text-slate-300">Type or say whatever's in your head about the task. No need to organise it.</p>

      <TiltCard className="mt-5 p-4" still>
        <label htmlFor="dump" className="sr-only">What's on your mind</label>
        <textarea
          id="dump"
          autoFocus
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim() && onSubmit(text)}
          placeholder="e.g. I have to write my essay and I don't know where to begin..."
          className="w-full resize-none bg-transparent text-lg leading-relaxed placeholder:text-slate-500 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {speech.supported ? (
            <button onClick={speech.toggle} className={`chip ${speech.listening ? 'border-pink-400 text-pink-300' : 'hover:bg-white/10'}`} aria-pressed={speech.listening}>
              {speech.listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {speech.listening ? 'Listening… tap to stop' : 'Say it instead'}
            </button>
          ) : <span />}
          <span className="text-xs text-slate-500">Ctrl + Enter</span>
        </div>
        {speech.offline && (speech.listening || speech.error) && (
          <p className={`mt-2 text-xs ${speech.error ? 'text-rose-300' : 'text-slate-400'}`} role="status">
            {speech.error === 'mic' ? "I couldn't hear a microphone. Check Windows Settings → Privacy → Microphone, then try again."
              : speech.error === 'none' ? "Windows has no speech recognizer installed. Typing works just as well."
                : speech.error ? "Voice input didn't start this time. Typing works just as well."
                  : 'Listening with Windows’ offline recognizer. Your voice never leaves this laptop. Stops after a quiet pause.'}
          </p>
        )}
      </TiltCard>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => setText(e)} className="chip max-w-full truncate text-left font-normal hover:bg-white/10">{e}</button>
        ))}
      </div>

      <button disabled={!text.trim() || loading} onClick={() => onSubmit(text)} className="btn-primary mt-6 py-4 text-lg">
        {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Finding a tiny way in…</> : 'Find my first tiny step'}
      </button>
      {slow && <p className="mt-3 text-center text-sm text-slate-400" role="status">Your local AI is writing the steps on this laptop. It can take about 15 seconds.</p>}
    </Screen>
  )
}
