// Ya API
export type { YaTrackInfo } from "./ya-api/client.js";
export { YaClient } from "./ya-api/client.js";
export type {
  WaveSettings,
  RadioResult,
  MoreTracksResult,
  SessionResult,
  SessionTracksResult,
  UserInfo,
} from "./ya-api/api.js";
export { YandexMusicApi } from "./ya-api/api.js";

// YT API
export type { YtTrackInfo } from "./yt-api/client.js";
export { YtClient } from "./yt-api/client.js";
export { YouTubeMusicApi } from "./yt-api/api.js";

// YT Queue
export { YtResolvedTrack } from "./queue/yt-resolved-track.js";
export { YtRadioQueue } from "./queue/yt-radio-queue.js";
