// Bridges to the browser extension's background worker and to the desktop app.
// Both do nothing on the plain web app.
/* global chrome */
export const inExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id
export const desktop = typeof window !== 'undefined' ? window.kindlingDesktop : undefined
export const inDesktop = !!desktop

export function syncSignals(prefs) {
  if (inDesktop) {
    desktop.syncSignals({
      enabled: prefs.signals.enabled,
      tabs: prefs.signals.tabs,
      pause: prefs.signals.pause,
      lens: prefs.signals.lens,
      pausedUntil: prefs.pausedUntil,
      snoozedUntil: prefs.snoozedUntil,
    })
  }
  if (!inExtension) return
  chrome.storage.local.set({
    kindlingSignals: {
      enabled: prefs.signals.enabled,
      tabs: prefs.signals.tabs,
      pause: prefs.signals.pause,
      pausedUntil: prefs.pausedUntil,
      snoozedUntil: prefs.snoozedUntil,
    },
  })
}

export function simulateSignal() {
  if (inDesktop) desktop.simulate()
  if (inExtension) chrome.runtime.sendMessage({ type: 'simulate' })
}

export function clearExtensionData() {
  if (inExtension) chrome.storage.local.clear()
}
