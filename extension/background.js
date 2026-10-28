// Kindling background worker: the on-device signal watcher and rule engine.
//
// Signals (only when the user has opted in):
//   * tab-hopping - counts tab activations in a 5-minute window. Uses tabs.onActivated, which
//                   gives a tab id only: no URL, title or page content is ever read.
//   * long pause  - chrome.idle reports no keyboard/mouse input; when the user comes back after
//                   3 to 20 minutes, a gentle check-in is offered. A locked screen is ignored.
// Signals are possible hints, never proof of how someone feels. Nothing leaves the device.

const WINDOW_MS = 5 * 60_000
const TAB_THRESHOLD = 12
const IDLE_SECONDS = 180
const MAX_PAUSE_MS = 20 * 60_000
const COOLDOWN_MS = 30 * 60_000
const NOTIFICATION_ID = 'kindling-checkin'

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
chrome.idle.setDetectionInterval(IDLE_SECONDS)

async function getSignals() {
  const { kindlingSignals } = await chrome.storage.local.get('kindlingSignals')
  return { enabled: false, tabs: false, pause: false, pausedUntil: 0, snoozedUntil: 0, ...kindlingSignals }
}

async function getState() {
  const { kindlingState } = await chrome.storage.session.get('kindlingState')
  return { switches: [], idleSince: 0, lastCheckIn: 0, ...kindlingState }
}

const setState = (s) => chrome.storage.session.set({ kindlingState: s })

async function maybeCheckIn(reason, { force = false } = {}) {
  const signals = await getSignals()
  const state = await getState()
  const now = Date.now()
  if (!force) {
    if (!signals.enabled) return
    if (signals.pausedUntil > now || signals.snoozedUntil > now) return
    if (now - state.lastCheckIn < COOLDOWN_MS) return
  }
  await setState({ ...state, lastCheckIn: now, switches: [] })
  const message = reason === 'tabs'
    ? "You've been hopping between a lot of tabs. Want a tiny nudge?"
    : reason === 'pause'
      ? 'Welcome back. Want help picking one tiny step?'
      : 'Looks like a tricky moment. Want a tiny nudge?'
  chrome.action.setBadgeBackgroundColor({ color: '#f472b6' })
  chrome.action.setBadgeText({ text: '•' })
  chrome.notifications.create(NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Kindling',
    message,
    buttons: [{ title: 'Yes, a tiny nudge' }, { title: 'Not now' }],
    priority: 0,
    silent: true,
  })
}

chrome.tabs.onActivated.addListener(async () => {
  const signals = await getSignals()
  if (!signals.enabled || !signals.tabs) return
  const state = await getState()
  const now = Date.now()
  const switches = [...state.switches.filter((t) => now - t < WINDOW_MS), now]
  await setState({ ...state, switches })
  if (switches.length >= TAB_THRESHOLD) maybeCheckIn('tabs')
})

chrome.idle.onStateChanged.addListener(async (idleState) => {
  const signals = await getSignals()
  if (!signals.enabled || !signals.pause) return
  const state = await getState()
  if (idleState === 'idle') {
    await setState({ ...state, idleSince: Date.now() - IDLE_SECONDS * 1000 })
  } else if (idleState === 'locked') {
    await setState({ ...state, idleSince: 0 })
  } else if (idleState === 'active' && state.idleSince) {
    const away = Date.now() - state.idleSince
    await setState({ ...state, idleSince: 0 })
    if (away <= MAX_PAUSE_MS) maybeCheckIn('pause')
  }
})

function openKindling(hash) {
  chrome.action.setBadgeText({ text: '' })
  chrome.windows.create({ url: chrome.runtime.getURL(`panel/index.html${hash}`), type: 'popup', width: 440, height: 780 })
}

chrome.notifications.onButtonClicked.addListener(async (id, button) => {
  if (id !== NOTIFICATION_ID) return
  chrome.notifications.clear(id)
  if (button === 0) {
    openKindling('#nudge')
  } else {
    const signals = await getSignals()
    await chrome.storage.local.set({ kindlingSignals: { ...signals, snoozedUntil: Date.now() + COOLDOWN_MS } })
    chrome.action.setBadgeText({ text: '' })
  }
})

chrome.notifications.onClicked.addListener((id) => {
  if (id !== NOTIFICATION_ID) return
  chrome.notifications.clear(id)
  openKindling('#checkin')
})

chrome.notifications.onClosed.addListener(() => chrome.action.setBadgeText({ text: '' }))

// "Simulate signal" from the panel: runs the real notification path, skipping thresholds.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'simulate') maybeCheckIn('demo', { force: true })
})
