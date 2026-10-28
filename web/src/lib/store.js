// Local-only, encrypted storage. Everything personal stays in this browser's IndexedDB,
// encrypted with AES-GCM using a non-extractable key that never leaves the device.
const DB = 'kindling'
const STORE = 'kv'
let memory = new Map() // fallback when IndexedDB is unavailable (private mode)

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(req?.result)
    t.onerror = () => reject(t.error)
  })
}

let keyPromise
function getKey() {
  keyPromise ??= (async () => {
    let key = await tx('readonly', (s) => s.get('__key'))
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      await tx('readwrite', (s) => s.put(key, '__key'))
    }
    return key
  })()
  return keyPromise
}

export async function load(name, fallback) {
  try {
    const rec = await tx('readonly', (s) => s.get(name))
    if (!rec) return fallback
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, await getKey(), rec.data)
    return JSON.parse(new TextDecoder().decode(plain))
  } catch {
    return memory.has(name) ? memory.get(name) : fallback
  }
}

export async function save(name, value) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await getKey(), new TextEncoder().encode(JSON.stringify(value)))
    await tx('readwrite', (s) => s.put({ iv, data }, name))
  } catch {
    memory.set(name, value)
  }
}

export async function wipeAll() {
  memory = new Map()
  keyPromise = undefined
  try {
    await tx('readwrite', (s) => s.clear())
  } catch { /* nothing stored */ }
  try {
    localStorage.clear()
  } catch { /* blocked */ }
}
