import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  ping: () => ipcRenderer.invoke("ping"),
  ymLoginOAuth: () => ipcRenderer.invoke("ym:loginOAuth"),
  ymRestoreSession: () => ipcRenderer.invoke("ym:restoreSession"),
  ymLogout: () => ipcRenderer.invoke("ym:logout"),
  getUserInfo: () => ipcRenderer.invoke("ym:getUserInfo"),
  queueInit: () => ipcRenderer.invoke("queue:init"),
  queueForward: (feedback: any) => ipcRenderer.invoke("queue:forward", feedback),
  queueBack: () => ipcRenderer.invoke("queue:back"),
  queueState: () => ipcRenderer.invoke("queue:state"),
  queueTrackRadio: () => ipcRenderer.invoke("queue:trackRadio"),
  queueRadioStatus: () => ipcRenderer.invoke("queue:radioStatus"),
  queueResetWave: () => ipcRenderer.invoke("queue:resetWave"),
  getMatchCandidates: (limit?: number) => ipcRenderer.invoke("queue:getMatchCandidates", limit),
  applyManualMatch: (data: any) => ipcRenderer.invoke("queue:applyManualMatch", data),
  feedbackStatus: () => ipcRenderer.invoke("queue:feedbackStatus"),
  like: () => ipcRenderer.invoke("queue:like"),
  dislike: () => ipcRenderer.invoke("queue:dislike"),
  unlike: () => ipcRenderer.invoke("queue:unlike"),
  undislike: () => ipcRenderer.invoke("queue:undislike"),
  getWaveSettings: () => ipcRenderer.invoke("ym:getWaveSettings"),
  setWaveSettings: (settings: any) => ipcRenderer.invoke("ym:setWaveSettings", settings),
  search: (query: string) => ipcRenderer.invoke("queue:search", query),
  selectSearchTrack: (index: number) => ipcRenderer.invoke("queue:selectSearchTrack", index),
  log: (msg: string) => ipcRenderer.send("app:log", msg),

  // Config
  getConfig: () => ipcRenderer.invoke("config:get"),
  setVolume: (volume: number) => ipcRenderer.invoke("config:setVolume", volume),
  setWaveConfig: (settings: any) => ipcRenderer.invoke("config:setWaveSettings", settings),
  openFolderDialog: () => ipcRenderer.invoke("config:openFolderDialog"),
  resetConfig: () => ipcRenderer.invoke("config:reset"),
  saveAllSettings: (data: any) => ipcRenderer.invoke("config:saveAll", data),

  // Download
  downloadTrack: () => ipcRenderer.invoke("queue:downloadTrack"),
});
