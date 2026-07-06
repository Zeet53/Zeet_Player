import { app, BrowserWindow, ipcMain, session, dialog, protocol, net } from "electron";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { fileURLToPath, pathToFileURL } from "url";
import { YandexMusicApi, YouTubeMusicApi, YtRadioQueue, YtResolvedTrack, YtTrackInfo, WaveSettings } from "@music-player/core";
import { ConfigManager, SecretsManager, MatchesStore, PhysicalMatchStore } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Log buffer ──
interface LogEntry {
  id: number;
  t: string;   // timestamp HH:MM:SS.mmm
  m: string;   // message
}

let logBuffer: LogEntry[] = [];
let logId = 0;
const MAX_LOG = 2000;

function pushLog(message: string) {
  logBuffer.push({ id: logId++, t: new Date().toISOString().slice(11, 23), m: message });
  if (logBuffer.length > MAX_LOG) logBuffer = logBuffer.slice(-MAX_LOG);
}

// Intercept main process console methods
{
  const origLog = console.log;
  console.log = (...args: any[]) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    pushLog(msg);
    origLog(...args);
  };
  const origError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    pushLog(`[ERROR] ${msg}`);
    origError(...args);
  };
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
    pushLog(`[WARN] ${msg}`);
    origWarn(...args);
  };
}

// Register privileged scheme for local media BEFORE app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: "local-media", privileges: { standard: true, secure: true, supportFetchAPI: true, media: true } },
]);

const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];

// --- State ---
let ymApi: YandexMusicApi | null = null;
let ymToken = "";
let ymUid = 0;
let rq: YtRadioQueue | null = null;
let mainWindow: BrowserWindow | null = null;

let configManager: ConfigManager;
let secretsManager: SecretsManager;
let matchesStore: MatchesStore;
let physicalMatchStore: PhysicalMatchStore;

let currentWaveSettings: WaveSettings = {
  moodEnergy: "all",
  diversity: "default",
  language: "any",
};

interface RadioStatus {
  mode: "default" | "custom" | "track";
  tags: string[];
  trackName: string;
}
let radioStatus: RadioStatus = { mode: "default", tags: [], trackName: "" };

const DEFAULT_WAVE: WaveSettings = { moodEnergy: "all", diversity: "default", language: "any" };

function computeRadioStatus(settings: WaveSettings): RadioStatus {
  const tags: string[] = [];
  if (settings.moodEnergy !== DEFAULT_WAVE.moodEnergy) tags.push(settings.moodEnergy);
  if (settings.diversity !== DEFAULT_WAVE.diversity) tags.push(settings.diversity);
  if (settings.language !== DEFAULT_WAVE.language) tags.push(settings.language);
  if (tags.length === 0) return { mode: "default", tags: [], trackName: "" };
  return { mode: "custom", tags, trackName: "" };
}

/** Создать YtRadioQueue с загрузкой ручных матчей */
function createQueue(session: { sessionId: string; from: string; stationId: string }): YtRadioQueue {
  const cfg = configManager.get();
  const queue = new YtRadioQueue(session, ymApi!, {
    batchSize: cfg.player.batchSize,
    refillThreshold: cfg.player.refillThreshold,
    maxHistoryLength: cfg.player.maxHistoryLength,
  });
  queue.matchCandidateSearchLimit = cfg.player.matchCandidateSearchLimit;
  queue.matchCandidateDisplayLimit = cfg.player.matchCandidateDisplayLimit;

  // Загружаем ручные матчи
  const savedMatches = matchesStore.get();
  const matchKeys = Object.keys(savedMatches);
  console.log(`[Main] createQueue: ${matchKeys.length} matches in store: ${matchKeys.slice(0, 5).join(", ")}`);
  queue.loadManualMatches(savedMatches);

  // При новом ручном матче — сохраняем в файл
  queue.onManualMatchSaved = (key: string, ytVideoId: string) => {
    const data = matchesStore.get();
    data[key] = ytVideoId;
    matchesStore.save();
  };

  return queue;
}

// --- Config ---
const YM_OAUTH_CLIENT_ID = "23cabbbdc6cd418abb4b39c32c41195d";
const YM_OAUTH_CLIENT_SECRET = "53bc75238f0c4d08a118e51fe9203300";
const YM_REDIRECT_URI = "https://music.yandex.ru/";

let resizeTimer: ReturnType<typeof setTimeout> | null = null;

async function oauthViaBrowser(): Promise<{ token: string; uid: number }> {
  return new Promise((resolve, reject) => {
    const AUTH_TIMEOUT = 5 * 60 * 1000;
    let resolved = false;
    let timeout: NodeJS.Timeout;

    const authWin = new BrowserWindow({
      width: 900,
      height: 700,
      parent: mainWindow ?? undefined,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    authWin.webContents.on("will-navigate", (event, url) => {
      try {
        const host = new URL(url).hostname;
        if (!host.endsWith(".yandex.ru") && host !== "yandex.ru" && host !== "music.yandex.ru") {
          event.preventDefault();
        }
      } catch {}
    });

    const finish = (token: string, uid: number) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      try { session.defaultSession.webRequest.onBeforeRequest(filter, null as any); } catch {}
      authWin.close();
      resolve({ token, uid });
    };

    const cancel = (err: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      try { session.defaultSession.webRequest.onBeforeRequest(filter, null as any); } catch {}
      reject(err);
    };

    const filter = { urls: [`${YM_REDIRECT_URI}*code=*`] };
    session.defaultSession.webRequest.onBeforeRequest(
      filter,
      async (details, callback) => {
        callback({ cancel: true });
        const url = new URL(details.url);
        const code = url.searchParams.get("code");
        if (url.hostname !== "music.yandex.ru" && url.hostname !== "www.music.yandex.ru") return;
        if (!code || resolved) return;

        try {
          const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: YM_OAUTH_CLIENT_ID,
            client_secret: YM_OAUTH_CLIENT_SECRET,
          });
          const res = await fetch("https://oauth.yandex.ru/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            cancel(new Error((errData as any).error_description ?? "Token exchange failed"));
            return;
          }
          const data = (await res.json()) as { access_token: string };

          const statusRes = await fetch("https://api.music.yandex.net/account/status", {
            headers: { Authorization: `OAuth ${data.access_token}` },
          });
          if (!statusRes.ok) throw new Error("Failed to verify token");
          const statusData: any = await statusRes.json();
          const uid = statusData.result.account.uid as number;

          finish(data.access_token, uid);
        } catch (e: any) {
          cancel(e);
        }
      },
    );

    const authUrl = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YM_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(YM_REDIRECT_URI)}`;
    authWin.loadURL(authUrl);

    timeout = setTimeout(() => cancel(new Error("Auth timeout")), AUTH_TIMEOUT);
    authWin.on("closed", () => {
      if (!resolved) cancel(new Error("Auth window closed"));
    });
  });
}

// --- IPC ---

ipcMain.on("app:log", (_event, message: string) => {
  pushLog(`[RENDERER] ${message}`);
});

// --- Log viewer ---

let logWindow: BrowserWindow | null = null;

ipcMain.handle("log:getBuffer", () => logBuffer);

ipcMain.handle("log:openWindow", () => {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 800,
    height: 500,
    title: "Log Viewer",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  logWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(LOG_HTML)}`);
  logWindow.on("closed", () => { logWindow = null; });
});

ipcMain.handle("ping", async () => {
  const [ym, yt] = await Promise.all([
    YandexMusicApi.ping(),
    YouTubeMusicApi.ping(),
  ]);
  return { ym, yt };
});

async function getTrackFeedback(trackId: string): Promise<"liked" | "disliked" | "none"> {
  if (!ymToken || !ymUid) { console.log(`[Feedback] no auth: token=${!!ymToken} uid=${ymUid}`); return "none"; }
  try {
    const likesUrl = `https://api.music.yandex.net/users/${ymUid}/likes/tracks?track-ids=${trackId}`;
    const dislikesUrl = `https://api.music.yandex.net/users/${ymUid}/dislikes/tracks?track-ids=${trackId}`;
    console.log(`[Feedback] checking track "${trackId}"...`);
    const [likesRes, dislikesRes] = await Promise.all([
      fetch(likesUrl, {
        headers: { Authorization: `OAuth ${ymToken}` },
      }),
      fetch(dislikesUrl, {
        headers: { Authorization: `OAuth ${ymToken}` },
      }),
    ]);
    if (likesRes.ok) {
      const likesData: any = await likesRes.json();
      console.log(`[Feedback] likes response:`, JSON.stringify(likesData).slice(0, 400));
      const likedTracks = likesData?.result?.library?.tracks;
      if (Array.isArray(likedTracks) && likedTracks.some((t: any) => String(t.id ?? t) === String(trackId))) { console.log(`[Feedback] ➡ liked`); return "liked"; }
    } else {
      console.log(`[Feedback] likes API status ${likesRes.status}`);
    }
    if (dislikesRes.ok) {
      const dislikesData: any = await dislikesRes.json();
      console.log(`[Feedback] dislikes response:`, JSON.stringify(dislikesData).slice(0, 400));
      const dislikedTracks = dislikesData?.result?.library?.tracks;
      if (Array.isArray(dislikedTracks) && dislikedTracks.some((t: any) => String(t.id ?? t) === String(trackId))) { console.log(`[Feedback] ➡ disliked`); return "disliked"; }
    } else {
      console.log(`[Feedback] dislikes API status ${dislikesRes.status}`);
    }
  } catch (e: any) { console.log(`[Feedback] error: ${e.message}`); }
  console.log(`[Feedback] ➡ none`);
  return "none";
}

async function attachFeedback(trackData: any): Promise<any> {
  if (!trackData) return trackData;
  const feedback = await getTrackFeedback(trackData.ym.id);
  return { ...trackData, feedback };
}

ipcMain.handle("ym:loginOAuth", async () => {
  const { token, uid } = await oauthViaBrowser();
  const api = new YandexMusicApi();
  await api.setToken(token);
  ymApi = api;
  ymToken = token;
  ymUid = uid;
  // Save auth to secrets (не в config.json!)
  await secretsManager.setYmAuth({ token, uid });
  return { uid, token };
});

ipcMain.handle("ym:logout", async () => {
  await secretsManager.setYmAuth({ token: "", uid: 0 });
  ymApi = null;
  ymToken = "";
  ymUid = 0;
  rq = null;
});

ipcMain.handle("ym:restoreSession", async () => {
  const sec = secretsManager.get();
  if (!sec.ym.token || !sec.ym.uid) return null;

  try {
    const api = new YandexMusicApi();
    await api.setToken(sec.ym.token);
    // Verify token is still valid by fetching user info
    const info = await api.getUserInfo();
    ymApi = api;
    ymToken = sec.ym.token;
    ymUid = sec.ym.uid;
    console.log(`[Config] Session restored: ${info.displayName}`);
    return info;
  } catch (e: any) {
    console.log(`[Config] Token expired or invalid: ${e.message ?? e}`);
    return null;
  }
});

ipcMain.handle("ym:getUserInfo", async () => {
  if (!ymApi) throw new Error("Not authenticated");
  return ymApi.getUserInfo();
});

ipcMain.handle("queue:init", async () => {
  if (!ymApi) throw new Error("Not authenticated");

  const cfg = configManager.get();
  currentWaveSettings = {
    moodEnergy: cfg.wave.moodEnergy as WaveSettings["moodEnergy"],
    diversity: cfg.wave.diversity as WaveSettings["diversity"],
    language: cfg.wave.language as WaveSettings["language"],
  };
  radioStatus = computeRadioStatus(currentWaveSettings);

  const session = await ymApi.createSession(currentWaveSettings);
  rq = createQueue(session);
  await rq.fill(
    session.tracks.slice(0, rq.batchSize),
    session.queueIds.slice(0, rq.batchSize),
    session.batchId,
  );
  const track = await rq.forward();
  return attachFeedback(track ? track.toJSON() : null);
});

ipcMain.handle("queue:getMatchCandidates", async () => {
  if (!rq) throw new Error("Queue not initialized");
  const track = rq.currentTrack;
  if (!track) throw new Error("No current track");
  const result = await rq.getMatchCandidates(track.ym);
  return {
    ym: track.ym,
    candidates: result.candidates.map(c => ({
      track: c.track,
      streamUrl: c.streamUrl,
    })),
  };
});

ipcMain.handle("queue:applyManualMatch", async (_event, data: { ytTrack: any; streamUrl: string }) => {
  if (!rq) throw new Error("Queue not initialized");
  const track = rq.currentTrack;
  if (!track) throw new Error("No current track");
  rq.applyManualMatch(track, data.ytTrack as YtTrackInfo, data.streamUrl);
  return attachFeedback(track.toJSON());
});

ipcMain.handle("queue:downloadTrack", async () => {
  if (!rq || !rq.currentTrack) throw new Error("No current track");
  const track = rq.currentTrack;

  // Проверяем путь для скачивания
  const cfg = configManager.get();
  let downloadPath = cfg.download.path;

  if (!downloadPath) {
    // Папка не назначена — открываем диалог
    if (!mainWindow) return { status: "error", message: "No window" } as const;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) {
      return { status: "cancelled" } as const;
    }
    downloadPath = result.filePaths[0];
    // Сохраняем как основную папку
    await configManager.set("download.path", downloadPath);
  }

  // Получаем videoId
  const videoId = track.yt?.videoId;
  if (!videoId) return { status: "error", message: "У этого трека нет YouTube-совпадения" } as const;

  // Формируем имя файла
  const safeName = `${track.ym.artist} - ${track.ym.title}`
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const filePath = path.join(downloadPath, `${safeName}.mp3`);

  console.log(`[Download] starting: ${safeName} → ${filePath}`);

  try {
    const ytApi = new YouTubeMusicApi();
    const webStream = await ytApi.download(videoId);
    if (!webStream) return { status: "error", message: "Не удалось получить поток от YouTube" } as const;

    const nodeStream = Readable.fromWeb(webStream as any);
    await pipeline(nodeStream, fs.createWriteStream(filePath));

    console.log(`[Download] done: ${filePath}`);
    return { status: "done", filePath } as const;
  } catch (e: any) {
    console.error(`[Download] error: ${e.message ?? e}`);
    return { status: "error", message: e.message ?? "Ошибка скачивания" } as const;
  }
});

ipcMain.handle("queue:forward", async (_event, feedback: { type: "trackStarted" | "trackFinished" | "skip"; time: number } | null) => {
  if (!rq) throw new Error("Queue not initialized");
  const track = feedback ? await rq.forward(feedback) : await rq.forward();
  return attachFeedback(track ? track.toJSON() : null);
});

ipcMain.handle("queue:back", async () => {
  if (!rq) throw new Error("Queue not initialized");
  const track = await rq.back();
  return attachFeedback(track ? track.toJSON() : null);
});

ipcMain.handle("queue:feedbackStatus", async () => {
  if (!rq || !rq.currentTrack) return "none";
  return getTrackFeedback(rq.currentTrack.ym.id);
});

ipcMain.handle("queue:like", async () => {
  if (!rq) throw new Error("Queue not initialized");
  await rq.like();
});

ipcMain.handle("queue:dislike", async () => {
  if (!rq) throw new Error("Queue not initialized");
  await rq.dislike();
});

ipcMain.handle("queue:unlike", async () => {
  if (!rq) throw new Error("Queue not initialized");
  await rq.unlike();
});

ipcMain.handle("queue:undislike", async () => {
  if (!rq) throw new Error("Queue not initialized");
  await rq.undislike();
});

ipcMain.handle("queue:trackRadio", async () => {
  if (!rq) throw new Error("Queue not initialized");
  const track = rq.currentTrack;
  if (!track) throw new Error("No current track");
  await rq.startTrackRadio(track);
  radioStatus = { mode: "track", tags: [], trackName: `${track.ym.artist} — ${track.ym.title}` };
  // current track is the seed track at index 0
  return attachFeedback(track.toJSON());
});

ipcMain.handle("queue:radioStatus", async () => {
  return radioStatus;
});

ipcMain.handle("queue:resetWave", async () => {
  if (!ymApi) throw new Error("Not authenticated");
  currentWaveSettings = { ...DEFAULT_WAVE };
  radioStatus = { mode: "default", tags: [], trackName: "" };

  const session = await ymApi.createSession(currentWaveSettings);
  rq = createQueue(session);
  await rq.fill(
    session.tracks.slice(0, rq.batchSize),
    session.queueIds.slice(0, rq.batchSize),
    session.batchId,
  );
  const track = await rq.forward();
  return attachFeedback(track ? track.toJSON() : null);
});

ipcMain.handle("queue:state", async () => {
  if (!rq) return { canPrev: false, canNext: false, index: -1, queueLen: 0 };
  return {
    canPrev: rq.index > 0,
    canNext: rq.queue.length > 0,
    index: rq.index,
    queueLen: rq.queue.length,
  };
});

let searchResults: YtResolvedTrack[] = [];

ipcMain.handle("queue:search", async (_event, query: string) => {
  if (!rq || !ymApi) throw new Error("Not authenticated");
  const results = await rq.searchAndResolve(query, 8);
  searchResults = results;
  return results.map(r => r.toJSON());
});

ipcMain.handle("queue:selectSearchTrack", async (_event, index: number) => {
  if (!rq) throw new Error("Queue not initialized");
  const track = searchResults[index];
  if (!track) throw new Error("Invalid track selection");

  await rq.startTrackRadio(track);
  radioStatus = { mode: "track", tags: [], trackName: `${track.ym.artist} — ${track.ym.title}` };
  return attachFeedback(track.toJSON());
});

// --- Config ---

ipcMain.handle("config:get", async () => {
  return configManager.get();
});

ipcMain.handle("config:setVolume", async (_event, volume: number) => {
  await configManager.set("player.volume", volume);
});

ipcMain.handle("config:setWaveSettings", async (_event, settings: WaveSettings) => {
  await configManager.setWave(settings);
});

ipcMain.handle("config:setPlayerSettings", async (_event, settings: { batchSize?: number; refillThreshold?: number; matchCandidateSearchLimit?: number; matchCandidateDisplayLimit?: number }) => {
  await configManager.setPlayer(settings);
});

ipcMain.handle("config:openFolderDialog", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("config:reset", async () => {
  return configManager.reset();
});

ipcMain.handle("config:resetSection", async (_event, section: "player" | "window" | "theme" | "download") => {
  await configManager.resetSection(section);
  // Применяем изменения, которые требуют немедленного эффекта
  if (section === "window" && mainWindow && !mainWindow.isDestroyed()) {
    const cfg = configManager.get();
    mainWindow.setSize(cfg.windowSize.width, cfg.windowSize.height);
  }
  return configManager.get();
});

ipcMain.handle("config:setDisplayMode", async (_event, mode: "ym" | "yt") => {
  await configManager.set("displayMode", mode);
});

ipcMain.handle("config:setWindowSize", async (_event, size: { width: number; height: number }) => {
  await configManager.set("windowSize", size);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(size.width, size.height);
  }
});

ipcMain.handle("config:setAutoResize", async (_event, enabled: boolean) => {
  await configManager.set("autoResize", enabled);
});

ipcMain.handle("config:setTheme", async (_event, theme: any) => {
  await configManager.set("theme", theme);
});

ipcMain.handle("config:saveAll", async (_event, data: { player: any; download: any; theme?: any }) => {
  if (data.player) await configManager.setPlayer(data.player);
  if (data.download?.path !== undefined) await configManager.set("download.path", data.download.path);
  if (data.theme) await configManager.set("theme", data.theme);
  // Apply to running queue
  if (data.player && rq) {
    if (data.player.batchSize !== undefined) rq.batchSize = data.player.batchSize;
    if (data.player.refillThreshold !== undefined) rq.refillThreshold = data.player.refillThreshold;
    if (data.player.matchCandidateSearchLimit !== undefined) rq.matchCandidateSearchLimit = data.player.matchCandidateSearchLimit;
    if (data.player.matchCandidateDisplayLimit !== undefined) rq.matchCandidateDisplayLimit = data.player.matchCandidateDisplayLimit;
    if (data.player.maxHistoryLength !== undefined) rq.maxHistoryLength = data.player.maxHistoryLength;
  }
});

// --- Physical matching ---

ipcMain.handle("physical:pickAudio", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Audio", extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "wma"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath, path.extname(filePath));
  return { filePath, fileName };
});

ipcMain.handle("physical:pickCover", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Images", extensions: ["jpg", "jpeg", "png", "webp", "bmp"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle("physical:save", async (_event, data: { key: string; audioPath: string; title: string; artist: string; coverPath?: string }) => {
  const mediaDir = physicalMatchStore.getMediaDir();
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // Validate source file exists
  if (!fs.existsSync(data.audioPath)) {
    throw new Error(`Source audio file not found: ${data.audioPath}`);
  }

  // Copy audio file
  const ext = path.extname(data.audioPath);
  const audioFileName = `audio_${Date.now()}${ext}`;
  const audioDest = path.join(mediaDir, audioFileName);
  await fsp.copyFile(data.audioPath, audioDest);

  // Copy cover if provided
  let coverDest: string | undefined;
  if (data.coverPath) {
    const coverExt = path.extname(data.coverPath);
    const coverFileName = `cover_${Date.now()}${coverExt}`;
    coverDest = path.join(mediaDir, coverFileName);
    await fsp.copyFile(data.coverPath, coverDest);
  }

  const all = physicalMatchStore.get();
  all[data.key] = {
    artist: data.artist,
    title: data.title,
    localFilePath: audioDest,
    coverPath: coverDest,
  };
  await physicalMatchStore.save();

  // Read file content for renderer to create blob:// URL
  const audioBuffer = await fsp.readFile(audioDest);

  console.log(`[Physical] saved match "${data.key}": ${audioDest} (${audioBuffer.length} bytes)`);
  return {
    key: data.key,
    entry: all[data.key],
    audioData: new Uint8Array(audioBuffer),
  };
});

ipcMain.handle("physical:readFile", async (_event, filePath: string) => {
  try {
    const buffer = await fsp.readFile(filePath);
    return { audioData: new Uint8Array(buffer) };
  } catch (e: any) {
    console.error(`[Physical] readFile error: ${e.message}`);
    return null;
  }
});

ipcMain.handle("physical:delete", async (_event, key: string) => {
  console.log(`[Physical] deleting match "${key}"`);
  await physicalMatchStore.remove(key);
});

ipcMain.handle("physical:list", async () => {
  return physicalMatchStore.get();
});

ipcMain.handle("physical:getForTrack", async (_event, data: { artist: string; title: string }) => {
  const key = `${data.artist}:${data.title}`;
  const all = physicalMatchStore.get();
  return all[key] ?? null;
});

// --- Wave settings ---

ipcMain.handle("ym:getWaveSettings", async () => {
  return currentWaveSettings;
});

ipcMain.handle("ym:setWaveSettings", async (_event, settings: Partial<WaveSettings>) => {
  if (!ymApi) throw new Error("Not authenticated");
  const merged = { ...currentWaveSettings, ...settings };
  currentWaveSettings = merged;
  radioStatus = computeRadioStatus(merged);

  const session = await ymApi.createSession(merged);
  rq = createQueue(session);
  await rq.fill(
    session.tracks.slice(0, rq.batchSize),
    session.queueIds.slice(0, rq.batchSize),
    session.batchId,
  );
  const track = await rq.forward();
  return attachFeedback(track ? track.toJSON() : null);
});

// --- Window ---

function setupResizeHandler(win: BrowserWindow) {
  win.on("resize", () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const cfg = configManager.get();
      if (!cfg.autoResize) return;
      if (win.isDestroyed()) return;
      const [w, h] = win.getSize();
      configManager.set("windowSize", { width: w, height: h }).catch((e: any) =>
        console.error("[Window] failed to save size:", e.message)
      );
    }, 500);
  });
}

function createWindow() {
  const cfg = configManager.get();
  const winSize = cfg.windowSize || { width: 1000, height: 720 };

  mainWindow = new BrowserWindow({
    width: winSize.width,
    height: winSize.height,
    minWidth: 700,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow!.show());
  setupResizeHandler(mainWindow);

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  // Set custom userData path: %APPDATA%/Zeet Player
  const appData = app.getPath("appData");
  const zeetPath = path.join(appData, "Zeet Player");
  app.setPath("userData", zeetPath);

  // Register local-media protocol to serve local audio files to renderer
  protocol.handle("local-media", (request) => {
    const url = new URL(request.url);
    // url.pathname is /C:/Users/... — strip leading /
    const filePath = url.pathname.replace(/^\//, "");
    return net.fetch(pathToFileURL(filePath).href);
  });

  configManager = new ConfigManager();
  secretsManager = new SecretsManager();
  matchesStore = new MatchesStore();
  physicalMatchStore = new PhysicalMatchStore();
  await Promise.all([configManager.load(), secretsManager.load(), matchesStore.load(), physicalMatchStore.load()]);
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Log viewer HTML (inline, no extra file needed) ──

const LOG_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#111;color:#ccc;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:13px}
#bar{display:flex;gap:8px;padding:8px 12px;background:#1a1a1a;border-bottom:1px solid #333;align-items:center;-webkit-app-region:drag}
#bar button{-webkit-app-region:no-drag;background:#333;border:1px solid #555;color:#ddd;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px}
#bar button:hover{background:#444}
#bar .info{color:#888;font-size:12px;margin-left:auto}
#log{padding:8px 12px;height:calc(100vh - 42px);overflow-y:auto;white-space:pre-wrap;word-break:break-all;user-select:text;font-variant-ligatures:none}
#log::-webkit-scrollbar{width:6px}
#log::-webkit-scrollbar-track{background:#111}
#log::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
.l{display:flex;gap:8px;padding:1px 0;line-height:1.5}
.l:hover{background:#1a1a1a}
.t{color:#666;flex-shrink:0}
.l:has(.e){background:#1a0a0a}
.l:has(.w){background:#1a1a00}
.e{color:#ff5252}
.w{color:#ffab00}
</style>
</head>
<body>
<div id="bar"><button onclick="copyAll()">📋 Copy All</button><button onclick="cls()">🗑 Clear</button><span class="info" id="info">0 lines</span></div>
<div id="log"></div>
<script>
let lastId=-1;
async function poll(){
  try{
    const buf=await window.api.logGetBuffer();
    if(!buf||!buf.length)return;
    const el=document.getElementById('log');
    document.getElementById('info').textContent=buf.length+' lines';
    const frag=document.createDocumentFragment();
    for(const e of buf){
      if(e.id<=lastId)continue;
      const d=document.createElement('div');
      d.className='l';
      const ts=document.createElement('span');
      ts.className='t';
      ts.textContent=e.t;
      d.appendChild(ts);
      const msg=document.createElement('span');
      if(e.m.includes('[ERROR]')||e.m.startsWith('Error'))msg.className='e';
      else if(e.m.includes('[WARN]'))msg.className='w';
      msg.textContent=e.m;
      d.appendChild(msg);
      frag.appendChild(d);
      lastId=e.id;
    }
    el.appendChild(frag);
    // Auto-scroll только если пользователь внизу (с запасом 10px)
    const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-10;
    if(atBottom)el.scrollTop=el.scrollHeight;
  }catch(e){}
}
async function copyAll(){
  let entries;
  try{entries=await window.api.logGetBuffer()}catch(e){return}
  const txt=entries.map(function(e){return e.t+' '+e.m}).join('\\n');
  try{await navigator.clipboard.writeText(txt)}catch(e){
    const ta=document.createElement('textarea');
    ta.value=txt;document.body.appendChild(ta);ta.select();
    document.execCommand('copy');ta.remove();
  }
}
function cls(){document.getElementById('log').innerHTML='';lastId=-1;document.getElementById('info').textContent='0 lines'}
setInterval(poll,500);poll();
<\/script>
</body>
</html>`;
