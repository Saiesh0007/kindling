import { useEffect, useRef, useState } from 'react'

// Voice brain-dump via the browser's Web Speech API. Optional: hidden when unsupported.
export function useSpeech(onText) {
  const Rec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const [listening, setListening] = useState(false)
  const rec = useRef(null)

  useEffect(() => () => rec.current?.abort(), [])

  const toggle = () => {
    if (!Rec) return
    if (listening) {
      rec.current?.stop()
      return
    }
    const r = new Rec()
    r.lang = 'en-IN'
    r.interimResults = false
    r.continuous = true
    r.onresult = (e) => {
      const text = Array.from(e.results).slice(e.resultIndex).map((x) => x[0].transcript).join(' ')
      onText(text.trim())
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    r.start()
    setListening(true)
  }

  return { supported: !!Rec, listening, toggle }
}
