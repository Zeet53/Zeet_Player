import type { YtTrackInfo } from "./client.js";
import { YtClient } from "./client.js";

// ============================================================
// YouTubeMusicApi — работа с YouTube Music
// ============================================================

export class YouTubeMusicApi {
  private client: YtClient;

  constructor() {
    this.client = new YtClient();
  }

  /** Пинг — проверка доступности YouTube */
  static async ping(): Promise<boolean> {
    try {
      const res = await fetch("https://www.youtube.com", {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Поиск треков */
  async search(query: string, limit = 10): Promise<YtTrackInfo[]> {
    return this.client.search(query, limit);
  }

  /** Получить stream-ссылку для воспроизведения */
  async getStreamUrl(track: YtTrackInfo): Promise<string | null> {
    return this.client.getStreamUrl(track);
  }

  /** Получить stream-ссылку по videoId */
  async getStreamUrlByVideoId(videoId: string): Promise<string | null> {
    return this.client.getStreamUrlByVideoId(videoId);
  }

  /** Скачать трек для офлайн (ReadableStream) */
  async download(videoId: string): Promise<ReadableStream<Uint8Array> | null> {
    return this.client.download(videoId);
  }
}
