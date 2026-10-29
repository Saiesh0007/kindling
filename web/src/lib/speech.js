import { useEffect, useRef, useState } from 'react'

const desktop = typeof window !== 'undefined' ? window.kindlingDesktop : undefined

// Voice brain-dump via the browser's Web Speech API. Optional: hidden when unsupported.
function useBrowserSpeech(onText) {
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

  return { supported: !!Rec, listening, toggle, error: null, offline: false }
}

// Desktop app: Windows' built-in offline speech recognizer, run by the main process.
// Audio is recognised on this laptop and never recorded or sent.
function useDesktopSpeech(onText) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const latest = useRef(onText)
  latest.current = onText

  useEffect(() => desktop.onDictation((m) => {
    if (m.text) latest.current(m.text)
    if (m.error) setError(m.error)
    if (m.done) setListening(false)
  }), [])
  useEffect(() => () => { desktop.stopDictation() }, [])

  const toggle = () => {
    if (listening) {
      desktop.stopDictation()
      return
    }
    setError(null)
    setListening(true)
    desktop.startDictation()
  }

  return { supported: true, listening, toggle, error, offline: true }
}

export const useSpeech = desktop?.startDictation ? useDesktopSpeech : useBrowserSpeech
