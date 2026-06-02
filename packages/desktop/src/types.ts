export type FeedbackStatus = "liked" | "disliked" | "none";

export interface PingResult {
  ym: boolean;
  yt: boolean;
}

export interface UserInfo {
  displayName: string;
  login: string;
}

export interface TrackData {
  ym: {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    coverUri: string;
  };
  yt: {
    id: string;
    videoId: string;
    title: string;
    artist: string;
    duration: number;
    coverUrl: string;
  } | null;
  streamUrl: string | null;
  state: "pending" | "ready" | "failed";
  feedback?: FeedbackStatus;
}

export interface YtMatchTrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
}

export interface MatchCandidatesResult {
  ym: TrackData["ym"];
  candidates: Array<{
    track: YtMatchTrack;
    streamUrl: string;
  }>;
}

export interface QueueState {
  canPrev: boolean;
  canNext: boolean;
  index: number;
  queueLen: number;
}

export interface RadioStatus {
  mode: "default" | "custom" | "track";
  tags: string[];
  trackName: string;
}

export type FeedbackType = "trackStarted" | "trackFinished" | "skip";

export interface Feedback {
  type: FeedbackType;
  time: number;
}

export interface WaveSettings {
  moodEnergy: "active" | "fun" | "calm" | "sad" | "all";
  diversity: "favorite" | "discover" | "popular" | "default";
  language: "russian" | "not-russian" | "any";
}

// ── Config types ──

export interface PlayerConfig {
  volume: number;
  batchSize: number;
  refillThreshold: number;
  matchCandidateSearchLimit: number;
  matchCandidateDisplayLimit: number;
}

export interface DownloadConfig {
  path: string;
  format: string;
}

export interface ConfigData {
  player: PlayerConfig;
  wave: { moodEnergy: string; diversity: string; language: string };
  download: DownloadConfig;
}

export type DownloadStatus = "done" | "cancelled" | "error";

export interface DownloadResult {
  status: DownloadStatus;
  filePath?: string;
  message?: string;
}

export interface Api {
  ping(): Promise<PingResult>;
  ymLoginOAuth(): Promise<{ uid: number; token: string }>;
  ymRestoreSession(): Promise<UserInfo | null>;
  ymLogout(): Promise<void>;
  getUserInfo(): Promise<UserInfo>;
  queueInit(): Promise<TrackData | null>;
  queueForward(feedback: Feedback | null): Promise<TrackData | null>;
  queueBack(): Promise<TrackData | null>;
  queueState(): Promise<QueueState>;
  queueTrackRadio(): Promise<TrackData | null>;
  queueRadioStatus(): Promise<RadioStatus>;
  queueResetWave(): Promise<TrackData | null>;
  getMatchCandidates(limit?: number): Promise<MatchCandidatesResult>;
  applyManualMatch(data: { ytTrack: YtMatchTrack; streamUrl: string }): Promise<TrackData>;
  feedbackStatus(): Promise<FeedbackStatus>;
  like(): Promise<void>;
  dislike(): Promise<void>;
  unlike(): Promise<void>;
  undislike(): Promise<void>;
  getWaveSettings(): Promise<WaveSettings>;
  setWaveSettings(settings: Partial<WaveSettings>): Promise<TrackData | null>;
  search(query: string): Promise<TrackData[]>;
  selectSearchTrack(index: number): Promise<TrackData>;
  log(message: string): void;

  // Config
  getConfig(): Promise<ConfigData>;
  setVolume(volume: number): Promise<void>;
  setWaveConfig(settings: { moodEnergy: string; diversity: string; language: string }): Promise<void>;
  openFolderDialog(): Promise<string | null>;
  resetConfig(): Promise<ConfigData>;
  saveAllSettings(data: { player: Partial<PlayerConfig>; download: { path?: string } }): Promise<void>;
  setPlayerSettings(settings: Partial<PlayerConfig>): Promise<void>;

  // Download
  downloadTrack(): Promise<DownloadResult>;
}

declare global {
  interface Window {
    api: Api;
  }
}
