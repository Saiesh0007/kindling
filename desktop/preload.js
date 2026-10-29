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
  onCheckIn: listen('kindling:checkin'),
  onPause: listen('kindling:pause'),
})
