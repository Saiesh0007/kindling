// The only things the Kindling page can ask of the desktop app. No Node access is exposed.
const { contextBridge, ipcRenderer } = require('electron')

const listen = (channel) => (cb) => {
  const handler = (_event, data) => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

contextBridge.exposeInMainWorld('kindlingDesktop', {
  syncSignals: (signals) => ipcRenderer.send('kindling:signals', signals),
  simulate: () => ipcRenderer.send('kindling:simulate'),
  notify: (reason) => ipcRenderer.send('kindling:notify', reason),
  getStartAtLogin: () => ipcRenderer.invoke('kindling:get-login'),
  setStartAtLogin: (on) => ipcRenderer.invoke('kindling:set-login', on),
  getStatus: () => ipcRenderer.invoke('kindling:status'),
  saveReport: () => ipcRenderer.invoke('kindling:save-report'),
  startDictation: () => ipcRenderer.invoke('kindling:dictate-start'),
  stopDictation: () => ipcRenderer.invoke('kindling:dictate-stop'),
  onDictation: listen('kindling:dictation'),
  onChime: listen('kindling:chime'),
  onCheckIn: listen('kindling:checkin'),
  onPause: listen('kindling:pause'),
})
