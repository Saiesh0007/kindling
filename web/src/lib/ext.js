// Bridge to the browser extension's background worker. Does nothing on the plain web app.
/* global chrome */
export const inExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id

export function syncSignals(prefs) {
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
  if (inExtension) chrome.runtime.sendMessage({ type: 'simulate' })
}

export function clearExtensionData() {
  if (inExtension) chrome.storage.local.clear()
}
