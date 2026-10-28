import { inExtension } from './ext.js'

// Inside the extension the UI talks to the local server; on the web it is same-origin.
const BASE = inExtension ? 'http://127.0.0.1:8000' : ''

export async function health() {
  try {
    const r = await fetch(`${BASE}/api/health`)
    return await r.json()
  } catch {
    return { status: 'offline', llm: false, engine: 'offline' }
  }
}

export async function sequence(body) {
  try {
    const r = await fetch(`${BASE}/api/sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    return offline(body)
  }
}

// Last-resort steps if the server can't be reached, so the user is never left with an error.
function offline({ mode }) {
  const steps = mode === 'smaller'
    ? ['Put your hand on the mouse and look at the task for ten seconds']
    : ['Open the thing you need and leave it on screen', 'Write one word about where to begin']
  return {
    kind: 'steps',
    message: "I can't reach my strategy library right now, but here's a tiny way in.",
    steps,
    strategy: { id: 'offline', title: 'Set up a landing pad', summary: 'Preparing the space counts as starting.' },
    engine: 'offline',
    overwhelmed: false,
  }
}
