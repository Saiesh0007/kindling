// Kindling desktop: runs the local server, keeps Kindling in the system tray, and turns the
// user's opt-in signals into gentle Windows notifications.
//
// Signals (only when the user has opted in, mirroring the browser extension):
//   * app and tab hopping - how often the foreground window, or its title, changes in 5 minutes.
//                   The server compares titles only as short in-memory hashes: titles, app names
//                   and screen content are never stored or sent.
//   * long pause  - no keyboard or mouse for 3 to 20 minutes, then the user comes back.
//   * focus lens  - runs in the page and keeps working while Kindling sits in the tray.
// Everything stays on this laptop. Signals are hints, never proof of how someone feels.

const { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, powerMonitor, session, shell } = require('electron')
const path = require('node:path')
const { spawn } = require('node:child_process')

const PORT = Number(process.env.KINDLING_PORT) || 8765
const ORIGIN = `http://127.0.0.1:${PORT}`
const ICON = path.join(__dirname, 'assets', 'icon.png')
const SWITCH_THRESHOLD = 12
const IDLE_SECONDS = 180
const MAX_PAUSE_MS = 20 * 60_000
const COOLDOWN_MS = 30 * 60_000
const MESSAGES = {
  apps: "You've been hopping between a lot of apps. Want a tiny nudge?",
  tabs: "You've been hopping between a lot of tabs. Want a tiny nudge?",
  pause: 'Welcome back. Want help picking one tiny step?',
  lens: 'Looks like a tricky moment. Want a tiny nudge?',
  demo: 'Looks like a tricky moment. Want a tiny nudge?',
}

// A separate profile (used by tests) never touches the installed app's data or lock.
if (process.env.KINDLING_PROFILE) app.setPath('userData', process.env.KINDLING_PROFILE)
if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('com.kindling.desktop') // Windows needs this to show notifications

let win = null
let tray = null
let server = null
let quitting = false
let signals = { enabled: false, tabs: false, pause: false, lens: false, pausedUntil: 0, snoozedUntil: 0 }
let lastCheckIn = 0
let idleSince = 0
let locked = false

// ---- local server ----
async function serverUp() {
  try {
    const r = await fetch(`${ORIGIN}/api/health`)
    return r.ok
  } catch {
    return false
  }
}

async function startServer() {
  if (await serverUp()) return // already running (e.g. left over from a previous session)
  const env = { ...process.env, KINDLING_DESKTOP: '1', KINDLING_PORT: String(PORT) }
  if (app.isPackaged) {
    const dir = path.join(process.resourcesPath, 'server')
    server = spawn(path.join(dir, 'kindling-server.exe'), [], { env, cwd: dir, windowsHide: true })
  } else {
    const backend = path.join(__dirname, '..', 'backend')
    server = spawn(path.join(backend, '.venv', 'Scripts', 'python.exe'), ['server.py'], { env, cwd: backend, windowsHide: true })
  }
  server.on('exit', () => { server = null })
  for (let i = 0; i < 240 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 250))
}

// ---- window and tray ----
function createWindow(show) {
  win = new BrowserWindow({
    width: 460,
    height: 860,
    minWidth: 380,
    minHeight: 620,
    show,
    title: 'Kindling',
    icon: ICON,
    backgroundColor: '#07061a',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false },
  })
  win.loadFile(path.join(__dirname, 'loading.html'))
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault() // closing keeps Kindling in the tray, so gentle check-ins keep working
    win.hide()
    if (!createWindow.hinted) {
      createWindow.hinted = true
      tray?.displayBalloon({ iconType: 'info', title: 'Kindling is still here', content: 'It lives in the tray. Right-click the icon to pause or quit.' })
    }
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function showWindow() {
  if (!win) createWindow(true)
  win.show()
  win.focus()
}

function refreshTray() {
  const paused = signals.pausedUntil > Date.now()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Kindling', click: showWindow },
    { type: 'separator' },
    { label: paused ? 'Check-ins paused for today' : 'Pause check-ins for today', enabled: !paused, click: () => win?.webContents.send('kindling:pause') },
    { label: 'Demo: send a check-in in 5 seconds', click: () => setTimeout(() => checkIn('demo', { force: true, toast: true }), 5000) },
    { type: 'separator' },
    { label: 'Quit Kindling', click: () => { quitting = true; app.quit() } },
  ]))
  tray.setToolTip(paused ? 'Kindling (paused for today)' : 'Kindling')
}

// ---- start at login ----
// Windows is the source of truth, so the switch always shows what will really happen at sign-in,
// including after "Startup apps" is changed in Task Manager or Kindling's data is deleted.
const loginItem = () => (app.isPackaged
  ? { args: ['--hidden'] }
  : { path: process.execPath, args: [app.getAppPath(), '--hidden'] })

function getStartAtLogin() {
  const s = app.getLoginItemSettings(loginItem())
  return s.executableWillLaunchAtLogin ?? s.openAtLogin
}

function setStartAtLogin(on) {
  app.setLoginItemSettings({ ...loginItem(), openAtLogin: on, enabled: on })
  return getStartAtLogin()
}

// ---- check-ins ----
const shown = new Set() // Windows drops a notification whose object is garbage-collected

function toast(reason, always = false) {
  if (!always && win?.isVisible() && win.isFocused()) return // the in-app check-in is already on screen
  if (!Notification.isSupported()) return
  const n = new Notification({ title: 'Kindling', body: MESSAGES[reason] || MESSAGES.demo, icon: ICON, silent: true })
  shown.add(n)
  const done = () => shown.delete(n)
  n.on('click', () => { done(); showWindow() })
  n.on('close', done)
  n.on('failed', done)
  n.show()
}

// Demo check-ins (forced) skip the rules and don't start the cooldown, so real signals still work.
function checkIn(reason, { force = false, toast: always = false } = {}) {
  const now = Date.now()
  if (!force) {
    if (!signals.enabled || signals.pausedUntil > now || signals.snoozedUntil > now) return
    if (now - lastCheckIn < COOLDOWN_MS) return
    lastCheckIn = now
  }
  win?.webContents.send('kindling:checkin', { reason })
  toast(reason, always)
}

async function watchApps() {
  if (!signals.enabled || !signals.tabs) return
  try {
    const a = await (await fetch(`${ORIGIN}/api/desktop/activity`)).json()
    if (a.switches + a.tabs >= SWITCH_THRESHOLD) checkIn(a.tabs > a.switches ? 'tabs' : 'apps')
  } catch {
    // the server is restarting; try again next tick
  }
}

function watchIdle() {
  if (!signals.enabled || !signals.pause || locked) return
  const idle = powerMonitor.getSystemIdleTime()
  const now = Date.now()
  if (idle >= IDLE_SECONDS && !idleSince) {
    idleSince = now - idle * 1000
  } else if (idle < 5 && idleSince) {
    const away = now - idleSince
    idleSince = 0
    if (away <= MAX_PAUSE_MS) checkIn('pause')
  }
}

// ---- messages from the page ----
ipcMain.on('kindling:signals', (_e, s) => {
  signals = { ...signals, ...s }
  if (tray) refreshTray()
})
ipcMain.handle('kindling:get-login', () => getStartAtLogin())
ipcMain.handle('kindling:set-login', (_e, on) => setStartAtLogin(!!on))
ipcMain.on('kindling:simulate', () => checkIn('demo', { force: true }))
ipcMain.on('kindling:notify', (_e, reason) => {
  lastCheckIn = Date.now()
  toast(reason)
})

// ---- startup ----
app.on('second-instance', showWindow)
app.on('before-quit', () => {
  quitting = true
  server?.kill()
})
app.on('window-all-closed', () => {}) // stay in the tray

app.whenReady().then(async () => {
  // Camera (video only) and notifications, for Kindling's own page only.
  const ours = (url) => typeof url === 'string' && url.startsWith(ORIGIN)
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb, details) => {
    const video = permission === 'media' && !(details.mediaTypes || []).includes('audio')
    cb(ours(details.requestingUrl) && (video || permission === 'notifications'))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => ours(origin) && ['media', 'notifications'].includes(permission))

  Menu.setApplicationMenu(null)
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }))
  tray.on('click', showWindow)
  refreshTray()

  createWindow(!process.argv.includes('--hidden'))
  await startServer()
  win.loadURL(ORIGIN)

  powerMonitor.on('lock-screen', () => { locked = true; idleSince = 0 })
  powerMonitor.on('unlock-screen', () => { locked = false })
  setInterval(watchIdle, 5000)
  setInterval(watchApps, 10_000)
  setInterval(refreshTray, 60_000) // the "paused for today" label expires at midnight
})
