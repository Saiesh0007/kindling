import { useEffect, useRef, useState } from 'react'

// The webcam "focus lens". Opt-in and fully on-device: frames are analysed in memory by
// MediaPipe Face Landmarker and immediately discarded. Nothing is recorded, stored or sent.
// Only a few numbers per second are kept, in memory, for the rolling window below.
//
// Signals (all compared to this user's own calibration, not a population norm):
//   stillness  - gaze and head barely moving (fixed stare)
//   blink rate - blinks per minute; staring at a stuck screen tends to lower it
//   tension    - brow lowering, lip pressing and squinting above the user's baseline
// Smiling or an open, relaxed face lowers the score: someone comfortably watching a video
// looks "settled", not stuck. A stuck moment is only a hint, and only ever leads to a question.

const BASE = `${import.meta.env.BASE_URL}mediapipe`
const FPS = 12
const CALIBRATE_MS = 12_000
const SHORT_MS = 10_000 // window for stillness and tension
const BLINK_MS = 60_000 // window for blink rate

let landmarkerPromise = null
async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
      const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`)
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: `${BASE}/face_landmarker.task`, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
      })
      try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'))
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, options('CPU'))
      }
    })().catch((e) => {
      landmarkerPromise = null
      throw e
    })
  }
  return landmarkerPromise
}

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x))
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const std = (a) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)))
}

function readFrame(result) {
  const shapes = result.faceBlendshapes?.[0]?.categories
  const nose = result.faceLandmarks?.[0]?.[1]
  if (!shapes || !nose) return null
  const b = Object.fromEntries(shapes.map((c) => [c.categoryName, c.score]))
  const avg = (k) => (b[`${k}Left`] + b[`${k}Right`]) / 2
  return {
    blink: avg('eyeBlink'),
    gx: b.eyeLookOutLeft - b.eyeLookInLeft + b.eyeLookInRight - b.eyeLookOutRight,
    gy: avg('eyeLookUp') - avg('eyeLookDown'),
    hx: nose.x,
    hy: nose.y,
    tension: (avg('browDown') + avg('mouthPress') + avg('eyeSquint') + 0.5 * b.browInnerUp) / 3.5,
    ease: Math.max(avg('mouthSmile'), b.jawOpen * 0.6),
  }
}

/**
 * useLens(enabled, { windowSec, onStuck }) -> { status, metrics, error, videoRef }
 * status: off | loading | calibrating | on | hidden | error
 */
export function useLens(enabled, { windowSec = 60, onStuck } = {}) {
  const [status, setStatus] = useState('off')
  const [metrics, setMetrics] = useState(null)
  const [error, setError] = useState(null)
  const videoRef = useRef(null)
  const stuckRef = useRef(onStuck)
  stuckRef.current = onStuck

  useEffect(() => {
    if (!enabled) {
      setStatus('off')
      setMetrics(null)
      return
    }
    let stream = null
    let timer = null
    let cancelled = false
    const frames = [] // { t, ...readFrame }  (numbers only, never images)
    const blinks = [] // timestamps
    const scores = [] // { t, s }
    let eyesClosed = false
    let started = 0
    let baseline = null
    let lastUi = 0
    let firedAt = 0

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    videoRef.current = video

    async function start() {
      setStatus('loading')
      setError(null)
      try {
        const [landmarker, s] = await Promise.all([
          getLandmarker(),
          navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false }),
        ])
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        video.srcObject = s
        await video.play()
        started = performance.now()
        setStatus('calibrating')
        loop(landmarker)
      } catch (e) {
        if (cancelled) return
        setStatus('error')
        setError(e?.name === 'NotAllowedError' ? 'Camera permission was declined. That is completely fine.' : 'The camera lens could not start on this device.')
      }
    }

    function loop(landmarker) {
      timer = setTimeout(() => loop(landmarker), 1000 / FPS)
      if (document.visibilityState !== 'visible') {
        setStatus('hidden')
        return
      }
      if (video.readyState < 2) return
      const now = performance.now()
      const f = readFrame(landmarker.detectForVideo(video, now))
      frames.push({ t: now, face: !!f, ...(f || {}) })
      while (frames.length && now - frames[0].t > SHORT_MS) frames.shift()

      if (f) {
        // Blink with hysteresis so one blink isn't counted twice.
        if (!eyesClosed && f.blink > 0.5) { eyesClosed = true; blinks.push(now) }
        else if (eyesClosed && f.blink < 0.3) eyesClosed = false
      }
      while (blinks.length && now - blinks[0] > BLINK_MS) blinks.shift()

      const seen = frames.filter((x) => x.face)
      const presence = seen.length / Math.max(1, frames.length)
      const elapsed = now - started
      const tension = mean(seen.map((x) => x.tension))
      const ease = mean(seen.map((x) => x.ease))
      const motion = std(seen.map((x) => x.gx)) + std(seen.map((x) => x.gy)) + 8 * (std(seen.map((x) => x.hx)) + std(seen.map((x) => x.hy)))
      const stillness = clamp(1 - motion / 0.35)
      const bpm = blinks.length * (60_000 / Math.min(BLINK_MS, Math.max(elapsed, 1)))

      const fps = frames.length / (SHORT_MS / 1000)
      if (!baseline && elapsed > CALIBRATE_MS && seen.length >= 10 && presence > 0.5) {
        baseline = { tension, bpm: Math.max(8, bpm) }
      }

      let state = elapsed > CALIBRATE_MS && presence < 0.4 ? 'away' : 'calibrating'
      let score = 0
      if (baseline) {
        const lowBlink = clamp((baseline.bpm * 0.85 - bpm) / (baseline.bpm * 0.6))
        const tense = clamp((tension - baseline.tension) / 0.08)
        score = clamp(0.4 * stillness + 0.3 * lowBlink + 0.3 * tense - 0.5 * clamp((ease - 0.25) / 0.4))
        scores.push({ t: now, s: score })
        if (presence < 0.4) state = 'away'
        else if (score > 0.6) state = 'stuck'
        else if (stillness > 0.6) state = 'settled'
        else state = 'active'

        while (scores.length && now - scores[0].t > windowSec * 1000) scores.shift()
        const covered = scores.length && now - scores[0].t > windowSec * 1000 * 0.95
        const share = scores.filter((x) => x.s > 0.6).length / Math.max(1, scores.length)
        if (covered && share > 0.75 && presence > 0.6 && now - firedAt > windowSec * 1000) {
          firedAt = now
          scores.length = 0
          const reasons = []
          if (stillness > 0.6) reasons.push('your gaze has stayed in one place')
          if (bpm < baseline.bpm * 0.85) reasons.push('you are blinking less than your usual')
          if (tension > baseline.tension + 0.03) reasons.push('your face looks a little more tense than earlier')
          stuckRef.current?.({ reasons, seconds: windowSec })
        }
      }

      if (now - lastUi > 250) {
        lastUi = now
        setStatus(baseline ? 'on' : 'calibrating')
        setMetrics({
          state, score, stillness, bpm: Math.round(bpm), presence, fps: Math.round(fps),
          tension: baseline ? clamp((tension - baseline.tension) / 0.08) : 0,
          calibrated: !!baseline,
          calibration: baseline ? 1 : clamp(elapsed / CALIBRATE_MS) * (presence > 0.5 ? 1 : 0.95),
          sustained: scores.length ? scores.filter((x) => x.s > 0.6).length / scores.length : 0,
        })
      }
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      videoRef.current = null
    }
  }, [enabled, windowSec])

  return { status, metrics, error, videoRef }
}
