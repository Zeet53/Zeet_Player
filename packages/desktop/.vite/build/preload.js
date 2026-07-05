"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  ping: () => electron.ipcRenderer.invoke("ping"),
  ymLoginOAuth: () => electron.ipcRenderer.invoke("ym:loginOAuth"),
  ymRestoreSession: () => electron.ipcRenderer.invoke("ym:restoreSession"),
  ymLogout: () => electron.ipcRenderer.invoke("ym:logout"),
  getUserInfo: () => electron.ipcRenderer.invoke("ym:getUserInfo"),
  queueInit: () => electron.ipcRenderer.invoke("queue:init"),
  queueForward: (feedback) => electron.ipcRenderer.invoke("queue:forward", feedback),
  queueBack: () => electron.ipcRenderer.invoke("queue:back"),
  queueState: () => electron.ipcRenderer.invoke("queue:state"),
  queueTrackRadio: () => electron.ipcRenderer.invoke("queue:trackRadio"),
  queueRadioStatus: () => electron.ipcRenderer.invoke("queue:radioStatus"),
  queueResetWave: () => electron.ipcRenderer.invoke("queue:resetWave"),
  getMatchCandidates: (limit) => electron.ipcRenderer.invoke("queue:getMatchCandidates", limit),
  applyManualMatch: (data) => electron.ipcRenderer.invoke("queue:applyManualMatch", data),
  feedbackStatus: () => electron.ipcRenderer.invoke("queue:feedbackStatus"),
  like: () => electron.ipcRenderer.invoke("queue:like"),
  dislike: () => electron.ipcRenderer.invoke("queue:dislike"),
  unlike: () => electron.ipcRenderer.invoke("queue:unlike"),
  undislike: () => electron.ipcRenderer.invoke("queue:undislike"),
  getWaveSettings: () => electron.ipcRenderer.invoke("ym:getWaveSettings"),
  setWaveSettings: (settings) => electron.ipcRenderer.invoke("ym:setWaveSettings", settings),
  search: (query) => electron.ipcRenderer.invoke("queue:search", query),
  selectSearchTrack: (index) => electron.ipcRenderer.invoke("queue:selectSearchTrack", index),
  log: (msg) => electron.ipcRenderer.send("app:log", msg),
  // Config
  getConfig: () => electron.ipcRenderer.invoke("config:get"),
  setVolume: (volume) => electron.ipcRenderer.invoke("config:setVolume", volume),
  setWaveConfig: (settings) => electron.ipcRenderer.invoke("config:setWaveSettings", settings),
  openFolderDialog: () => electron.ipcRenderer.invoke("config:openFolderDialog"),
  resetConfig: () => electron.ipcRenderer.invoke("config:reset"),
  saveAllSettings: (data) => electron.ipcRenderer.invoke("config:saveAll", data),
  // Download
  downloadTrack: () => electron.ipcRenderer.invoke("queue:downloadTrack"),
  // Physical matching
  physicalPickAudio: () => electron.ipcRenderer.invoke("physical:pickAudio"),
  physicalPickCover: () => electron.ipcRenderer.invoke("physical:pickCover"),
  physicalSave: (data) => electron.ipcRenderer.invoke("physical:save", data),
  physicalDelete: (key) => electron.ipcRenderer.invoke("physical:delete", key),
  physicalReadFile: (filePath) => electron.ipcRenderer.invoke("physical:readFile", filePath),
  physicalList: () => electron.ipcRenderer.invoke("physical:list"),
  physicalGetForTrack: (data) => electron.ipcRenderer.invoke("physical:getForTrack", data)
});
//# sourceMappingURL=preload.js.map
