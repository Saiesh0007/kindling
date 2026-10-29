import { inExtension } from './ext.js'

// On the web and in the desktop app the server is same-origin. Inside the extension the UI
// talks to a local server: start.bat's (port 8000) or the desktop app's (port 8765).
const LOCAL = ['http://127.0.0.1:8000', 'http://127.0.0.1:8765']
let base = inExtension ? null : ''

async function server() {
  if (base !== null) return base
  for (const b of LOCAL) {
    try {
      if ((await fetch(`${b}/api/health`)).ok) return (base = b)
    } catch {
      // not running on this port
    }
  }
  return LOCAL[0]
}

const forget = () => { if (inExtension) base = null } // look again next time

export async function health() {
  try {
    const r = await fetch(`${await server()}/api/health`)
    return await r.json()
  } catch {
    forget()
    return { status: 'offline', llm: false, engine: 'offline' }
  }
}

export async function sequence(body) {
  try {
    const r = await fetch(`${await server()}/api/sequence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch {
    forget()
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
