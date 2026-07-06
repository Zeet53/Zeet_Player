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
  resetSection: (section: string) => ipcRenderer.invoke("config:resetSection", section),
  saveAllSettings: (data: any) => ipcRenderer.invoke("config:saveAll", data),
  setDisplayMode: (mode: "ym" | "yt") => ipcRenderer.invoke("config:setDisplayMode", mode),
  setWindowSize: (size: { width: number; height: number }) => ipcRenderer.invoke("config:setWindowSize", size),
  setAutoResize: (enabled: boolean) => ipcRenderer.invoke("config:setAutoResize", enabled),
  setTheme: (theme: any) => ipcRenderer.invoke("config:setTheme", theme),

  // Download
  downloadTrack: () => ipcRenderer.invoke("queue:downloadTrack"),

  // Physical matching
  physicalPickAudio: () => ipcRenderer.invoke("physical:pickAudio"),
  physicalPickCover: () => ipcRenderer.invoke("physical:pickCover"),
  physicalSave: (data: any) => ipcRenderer.invoke("physical:save", data),
  physicalDelete: (key: string) => ipcRenderer.invoke("physical:delete", key),
  physicalReadFile: (filePath: string) => ipcRenderer.invoke("physical:readFile", filePath),
  physicalList: () => ipcRenderer.invoke("physical:list"),
  physicalGetForTrack: (data: { artist: string; title: string }) => ipcRenderer.invoke("physical:getForTrack", data),

  // Log viewer
  logGetBuffer: () => ipcRenderer.invoke("log:getBuffer"),
  logOpenWindow: () => ipcRenderer.invoke("log:openWindow"),
});
