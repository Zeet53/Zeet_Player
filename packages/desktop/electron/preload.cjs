const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  ping: () => ipcRenderer.invoke("ping"),
  ymLoginOAuth: () => ipcRenderer.invoke("ym:loginOAuth"),
  getUserInfo: () => ipcRenderer.invoke("ym:getUserInfo"),
  queueInit: () => ipcRenderer.invoke("queue:init"),
  queueForward: (feedback) => ipcRenderer.invoke("queue:forward", feedback),
  queueBack: () => ipcRenderer.invoke("queue:back"),
  queueState: () => ipcRenderer.invoke("queue:state"),
  queueTrackRadio: () => ipcRenderer.invoke("queue:trackRadio"),
  queueRadioStatus: () => ipcRenderer.invoke("queue:radioStatus"),
  queueResetWave: () => ipcRenderer.invoke("queue:resetWave"),
  getMatchCandidates: (limit) => ipcRenderer.invoke("queue:getMatchCandidates", limit),
  applyManualMatch: (data) => ipcRenderer.invoke("queue:applyManualMatch", data),
  feedbackStatus: () => ipcRenderer.invoke("queue:feedbackStatus"),
  like: () => ipcRenderer.invoke("queue:like"),
  dislike: () => ipcRenderer.invoke("queue:dislike"),
  unlike: () => ipcRenderer.invoke("queue:unlike"),
  undislike: () => ipcRenderer.invoke("queue:undislike"),
  getWaveSettings: () => ipcRenderer.invoke("ym:getWaveSettings"),
  setWaveSettings: (settings) => ipcRenderer.invoke("ym:setWaveSettings", settings),
  log: (msg) => ipcRenderer.send("app:log", msg),
});
