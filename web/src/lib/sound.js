// Gentle sounds, generated with the Web Audio API: no audio files, nothing downloaded.
//   chime()          - a soft two-note bell for check-in notifications
//   soundscape(kind) - a looping rest soundscape: 'rain', 'waves' or 'pad'

let ctx = null
const audio = () => {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export const SOUNDSCAPES = [
  ['off', 'Silence'],
  ['rain', 'Soft rain'],
  ['waves', 'Slow waves'],
  ['pad', 'Warm hum'],
]

export function chime(volume = 0.18) {
  const a = audio()
  const t = a.currentTime
  for (const [freq, delay] of [[659.25, 0], [987.77, 0.18]]) { // E5 then B5: open, unhurried
    const osc = a.createOscillator()
    const gain = a.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t + delay)
    gain.gain.linearRampToValueAtTime(volume, t + delay + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 1.6)
    osc.connect(gain).connect(a.destination)
    osc.start(t + delay)
    osc.stop(t + delay + 1.7)
  }
}

function noise(a, seconds = 4, brown = false) {
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = brown ? (last + 0.02 * white) / 1.02 : white
    data[i] = brown ? last * 3.5 : white
  }
  const src = a.createBufferSource()
  src.buffer = buf
  src.loop = true
  return src
}

function lfo(a, rate, depth, target) {
  const osc = a.createOscillator()
  const amount = a.createGain()
  osc.frequency.value = rate
  amount.gain.value = depth
  osc.connect(amount).connect(target)
  osc.start()
  return osc
}

/** Starts a soundscape; returns { setVolume(v), stop() }. Fades in and out to avoid clicks. */
export function soundscape(kind, volume = 0.5) {
  if (kind === 'off') return { setVolume() {}, stop() {} }
  const a = audio()
  const out = a.createGain()
  out.gain.value = 0
  out.connect(a.destination)
  const level = (v) => v * (kind === 'pad' ? 0.25 : 0.4)
  out.gain.linearRampToValueAtTime(level(volume), a.currentTime + 3)
  const nodes = []

  if (kind === 'rain') {
    const src = noise(a)
    const hp = new BiquadFilterNode(a, { type: 'highpass', frequency: 500 })
    const lp = new BiquadFilterNode(a, { type: 'lowpass', frequency: 5000 })
    const shimmer = a.createGain()
    shimmer.gain.value = 0.8
    nodes.push(lfo(a, 0.13, 0.15, shimmer.gain))
    src.connect(hp).connect(lp).connect(shimmer).connect(out)
    src.start()
    nodes.push(src)
  } else if (kind === 'waves') {
    const src = noise(a, 6, true)
    const lp = new BiquadFilterNode(a, { type: 'lowpass', frequency: 600 })
    const swell = a.createGain()
    swell.gain.value = 0.55
    nodes.push(lfo(a, 0.09, 0.45, swell.gain)) // one wave about every 11 s
    nodes.push(lfo(a, 0.09, 350, lp.frequency))
    src.connect(lp).connect(swell).connect(out)
    src.start()
    nodes.push(src)
  } else if (kind === 'pad') {
    const lp = new BiquadFilterNode(a, { type: 'lowpass', frequency: 700, Q: 0.7 })
    nodes.push(lfo(a, 0.05, 250, lp.frequency))
    lp.connect(out)
    for (const [freq, detune] of [[130.81, -4], [196.0, 3], [246.94, -2], [329.63, 5]]) { // C3 G3 B3 E4
      const osc = new OscillatorNode(a, { type: 'triangle', frequency: freq, detune })
      const g = new GainNode(a, { gain: 0.25 })
      osc.connect(g).connect(lp)
      osc.start()
      nodes.push(osc)
    }
  }

  return {
    setVolume(v) { out.gain.linearRampToValueAtTime(level(v), a.currentTime + 0.3) },
    stop() {
      const end = a.currentTime + 1.5
      out.gain.cancelScheduledValues(a.currentTime)
      out.gain.setValueAtTime(out.gain.value, a.currentTime)
      out.gain.linearRampToValueAtTime(0, end)
      for (const n of nodes) n.stop(end + 0.05)
      setTimeout(() => out.disconnect(), 1700)
    },
  }
}
