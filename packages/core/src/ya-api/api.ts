import { YandexMusicClient } from "yandex-music";
import { YaClient } from "./client.js";
import type { YaTrackInfo } from "./client.js";

// --- Interfaces ---

export interface WaveSettings {
  moodEnergy: "active" | "fun" | "calm" | "sad" | "all";
  diversity: "favorite" | "discover" | "popular" | "default";
  language: "russian" | "not-russian" | "any";
}

export interface RadioResult {
  stationId: string;
  tracks: YaTrackInfo[];
  batchId: string;
}

export interface MoreTracksResult {
  tracks: YaTrackInfo[];
  batchId: string;
}

export interface SessionResult {
  sessionId: string;
  batchId: string;
  tracks: YaTrackInfo[];
  queueIds: string[];
  from: string;
  stationId: string;
}

export interface SessionTracksResult {
  tracks: YaTrackInfo[];
  queueIds: string[];
  batchId: string;
}

export interface UserInfo {
  displayName: string;
  login: string;
}

// ============================================================
// YandexMusicApi — работа с Яндекс.Музыкой
// ============================================================

export class YandexMusicApi {
  private _token = "";
  private _uid: number | null = null;

  get isAuthenticated(): boolean {
    return !!this._token;
  }

  get token(): string {
    return this._token;
  }

  /** Установить токен (после OAuth) и получить UID */
  async setToken(token: string): Promise<number> {
    this._token = token;
    this._uid = await this.getUid(token);
    return this._uid;
  }

  private async ensureUid(): Promise<number> {
    if (this._uid) return this._uid;
    if (!this._token) throw new Error("Not authenticated");
    this._uid = await this.getUid(this._token);
    return this._uid;
  }

  /** Получить UID пользователя по токену */
  private async getUid(token: string): Promise<number> {
    const res = await fetch("https://api.music.yandex.net/account/status", {
      headers: { Authorization: `OAuth ${token}` },
    });
    if (!res.ok) throw new Error("Failed to verify token");
    const data: any = await res.json();
    return data.result.account.uid as number;
  }

  /** Получить YandexMusicClient (для rotor API) */
  private async getYMClient(): Promise<YandexMusicClient> {
    const uid = await this.ensureUid();
    return new YandexMusicClient(this._token, uid, "ru");
  }

  /** POST с JSON-телом (для session API) */
  private async ymRequest(path: string, body: unknown): Promise<any> {
    if (!this._token) throw new Error("Not authenticated");

    const res = await fetch(`https://api.music.yandex.net${path}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${this._token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YM API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.result ?? data;
  }

  /** POST с query-параметрами (для like/dislike) */
  private async ymPostForm(path: string, params: Record<string, string>): Promise<any> {
    if (!this._token) throw new Error("Not authenticated");

    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`https://api.music.yandex.net${path}?${qs}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${this._token}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`YM API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.result ?? data;
  }

  private mapTrack(item: any): YaTrackInfo {
    const t = item.track ?? item;
    return {
      id: t.id,
      title: t.title,
      artist: t.artists?.[0]?.name ?? "Unknown",
      album: t.albums?.[0]?.title ?? "",
      duration: Math.floor((t.durationMs ?? 0) / 1000),
      coverUri: t.coverUri ?? "",
    };
  }

  // ============================================================
  // API methods
  // ============================================================

  /** Информация о текущем пользователе */
  async getUserInfo(): Promise<UserInfo> {
    const ym = await this.getYMClient();
    const status = await ym.account.status();
    return {
      displayName: status.account.displayName,
      login: status.account.login,
    };
  }

  /** Инициализация радио (получение станции и треков) */
  async initRadio(): Promise<RadioResult> {
    const ym = await this.getYMClient();
    const stations = await ym.rotor.list();
    const myWave =
      stations.find(
        (s: any) =>
          s.station.id.tag === "onyourwave" || s.station.id.tag === "morning",
      ) ?? stations[0];
    if (!myWave) throw new Error("No stations found");

    const stationId = `${myWave.station.id.type}:${myWave.station.id.tag}`;
    const tracks = await ym.rotor.tracks(stationId);

    return {
      stationId,
      batchId: tracks.batchId,
      tracks: tracks.sequence.map((item: any) => this.mapTrack(item)),
    };
  }

  /** Получить ещё треки для текущей станции */
  async getMoreTracks(stationId: string): Promise<MoreTracksResult> {
    const ym = await this.getYMClient();
    const tracksData = await ym.rotor.tracks(stationId);

    return {
      batchId: tracksData.batchId,
      tracks: tracksData.sequence.map((item: any) => this.mapTrack(item)),
    };
  }

  /** Настроить параметры волны */
  async configureWave(settings: Partial<WaveSettings>): Promise<void> {
    const ym = await this.getYMClient();
    const stations = await ym.rotor.list();
    const myWave =
      stations.find((s: any) => s.station.id.tag === "onyourwave") ?? stations[0];
    if (!myWave) throw new Error("No stations found");

    const stationId = `${myWave.station.id.type}:${myWave.station.id.tag}`;
    await ym.rotor.settings(
      stationId,
      (settings.moodEnergy ?? "all") as any,
      (settings.diversity ?? "default") as any,
      (settings.language ?? "any") as any,
    );
  }

  /**
   * Применить настройки волны и сразу получить треки
   */
  async createRadio(settings: Partial<WaveSettings>): Promise<RadioResult> {
    const ym = await this.getYMClient();
    const stations = await ym.rotor.list();
    const myWave =
      stations.find(
        (s: any) =>
          s.station.id.tag === "onyourwave" || s.station.id.tag === "morning",
      ) ?? stations[0];
    if (!myWave) throw new Error("No stations found");

    const stationId = `${myWave.station.id.type}:${myWave.station.id.tag}`;
    await ym.rotor.settings(
      stationId,
      (settings.moodEnergy ?? "all") as any,
      (settings.diversity ?? "default") as any,
      (settings.language ?? "any") as any,
    );

    const tracksData = await ym.rotor.tracks(stationId);

    return {
      stationId,
      batchId: tracksData.batchId,
      tracks: tracksData.sequence.map((item: any) => this.mapTrack(item)),
    };
  }

  /** Поиск треков в Яндекс.Музыке */
  async search(query: string, limit = 10): Promise<YaTrackInfo[]> {
    if (!this._token) throw new Error("Not authenticated");

    const url = `https://api.music.yandex.net/search?text=${encodeURIComponent(query)}&type=track&page=0`;
    const res = await fetch(url, {
      headers: { Authorization: `OAuth ${this._token}` },
    });

    if (!res.ok) throw new Error(`YM search failed: ${res.status}`);
    const data: any = await res.json();
    const results = data?.result?.tracks?.results ?? [];

    return results.slice(0, limit).map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artists?.[0]?.name ?? "Unknown",
      album: t.albums?.[0]?.title ?? "",
      duration: Math.floor((t.durationMs ?? 0) / 1000),
      coverUri: t.coverUri ?? "",
    }));
  }

  /** Получить лайкнутые треки */
  async getLikedTracks(page = 0, pageSize = 50): Promise<YaTrackInfo[]> {
    const uid = await this.ensureUid();

    // 1. Получить список ID лайкнутых треков
    const url = `https://api.music.yandex.net/users/${uid}/likes/tracks?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `OAuth ${this._token}` },
    });
    if (!res.ok) throw new Error(`YM getLikedTracks failed: ${res.status}`);
    const data: any = await res.json();
    const likedItems: Array<{ id: number; albumId: number }> =
      data?.result?.library?.tracks ?? [];
    if (likedItems.length === 0) return [];

    // 2. Получить полную информацию о треках
    const ids = likedItems.map((item) => item.id).join(",");
    const tracksRes = await fetch(
      `https://api.music.yandex.net/tracks?track-ids=${ids}`,
      { headers: { Authorization: `OAuth ${this._token}` } },
    );
    if (!tracksRes.ok) throw new Error(`YM tracks fetch failed: ${tracksRes.status}`);
    const tracksData: any = await tracksRes.json();
    const trackList: any[] = tracksData?.result ?? [];

    return trackList.map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artists?.[0]?.name ?? "Unknown",
      album: t.albums?.[0]?.title ?? "",
      duration: Math.floor((t.durationMs ?? 0) / 1000),
      coverUri: t.coverUri ?? "",
    }));
  }

  /** Лайк трека */
  async likeTrack(trackId: string): Promise<void> {
    const uid = await this.ensureUid();
    await this.ymPostForm(`/users/${uid}/likes/tracks/add-multiple`, {
      "track-ids": trackId,
    });
  }

  /** Дизлайк трека */
  async dislikeTrack(trackId: string): Promise<void> {
    const uid = await this.ensureUid();
    await this.ymPostForm(`/users/${uid}/dislikes/tracks/add-multiple`, {
      "track-ids": trackId,
    });
  }

  /** Убрать лайк */
  async removeLikeTrack(trackId: string): Promise<void> {
    const uid = await this.ensureUid();
    await this.ymPostForm(`/users/${uid}/likes/tracks/remove`, {
      "track-ids": trackId,
    });
  }

  /** Убрать дизлайк */
  async removeDislikeTrack(trackId: string): Promise<void> {
    const uid = await this.ensureUid();
    await this.ymPostForm(`/users/${uid}/dislikes/tracks/remove`, {
      "track-ids": trackId,
    });
  }

  /**
   * Отправить фидбек о прослушивании трека (через rotor API)
   */
  async feedback(
    stationId: string,
    type: "trackStarted" | "trackFinished" | "skip" | "radioStarted",
    batchId: string,
    trackId?: string,
    totalPlayedSeconds?: number,
  ): Promise<void> {
    const ym = await this.getYMClient();
    const stations = await ym.rotor.list();
    const myWave =
      stations.find(
        (s: any) => s.station.id.tag === stationId.split(":")[1],
      ) ?? stations[0];

    const from = myWave?.station?.idForFrom ?? "radio";
    await ym.rotor.feedback(
      stationId,
      type,
      from,
      batchId,
      totalPlayedSeconds,
      trackId,
    );
  }

  // ============================================================
  // Session API — реальный API Яндекса (как в music.yandex.ru)
  // ============================================================

  /**
   * Создать радио-сессию с настройками
   */
  async createSession(settings: Partial<WaveSettings>): Promise<SessionResult> {
    await this.configureWave(settings);

    const seeds: string[] = ["user:onyourwave"];
    if (settings.diversity) seeds.push(`settingDiversity:${settings.diversity}`);
    if (settings.moodEnergy) seeds.push(`settingMoodEnergy:${settings.moodEnergy}`);
    if (settings.language) seeds.push(`settingLanguage:${settings.language}`);

    const data = await this.ymRequest("/rotor/session/new", {
      seeds,
      queue: [],
      includeTracksInResponse: true,
      includeWaveModel: true,
      interactive: true,
    });

    const seq = data.sequence ?? [];
    const tracks = seq.map(this.mapTrack);
    const queueIds = seq.map((item: any) => {
      const t = item.track ?? item;
      return `${t.id}:${t.albums?.[0]?.id ?? "0"}`;
    });

    return {
      sessionId: data.radioSessionId,
      batchId: data.batchId,
      from: data.wave?.idForFrom ?? "user:onyourwave",
      stationId: data.wave?.stationId ?? "user:onyourwave",
      tracks,
      queueIds,
    };
  }

  /**
   * Создать радио-сессию на основе трека
   */
  async createTrackSession(trackId: string): Promise<SessionResult> {
    const data = await this.ymRequest("/rotor/session/new", {
      seeds: [`track:${trackId}`],
      queue: [],
      includeTracksInResponse: true,
      includeWaveModel: true,
      interactive: true,
    });

    const seq = data.sequence ?? [];
    const tracks = seq.map(this.mapTrack);
    const queueIds = seq.map((item: any) => {
      const t = item.track ?? item;
      return `${t.id}:${t.albums?.[0]?.id ?? "0"}`;
    });

    return {
      sessionId: data.radioSessionId,
      batchId: data.batchId,
      from: data.wave?.idForFrom ?? `track:${trackId}`,
      stationId: data.wave?.stationId ?? `track:${trackId}`,
      tracks,
      queueIds,
    };
  }

  /**
   * Отправить фидбек в сессии
   */
  async sessionFeedback(
    sessionId: string,
    type: "trackStarted" | "trackFinished" | "skip",
    batchId: string,
    trackId: string,
    from: string,
    totalPlayedSeconds?: number,
  ): Promise<void> {
    const event: any = {
      type,
      timestamp: new Date().toISOString(),
      trackId,
    };
    if (totalPlayedSeconds !== undefined) {
      event.totalPlayedSeconds = totalPlayedSeconds;
    }

    await this.ymRequest(`/rotor/session/${sessionId}/feedback/`, {
      event,
      batchId,
      from,
    });
  }

  /**
   * Получить новые треки для сессии
   */
  async getSessionTracks(
    sessionId: string,
    queue: string[],
    feedbacks: Array<{
      batchId: string;
      type: "trackStarted" | "trackFinished" | "skip";
      trackId: string;
      from: string;
      totalPlayedSeconds?: number;
    }>,
  ): Promise<SessionTracksResult> {
    const data = await this.ymRequest(`/rotor/session/${sessionId}/tracks`, {
      queue,
      feedbacks: feedbacks.map((fb) => ({
        batchId: fb.batchId,
        event: {
          type: fb.type,
          timestamp: new Date().toISOString(),
          trackId: fb.trackId,
          ...(fb.totalPlayedSeconds !== undefined
            ? { totalPlayedSeconds: fb.totalPlayedSeconds }
            : {}),
        },
        from: fb.from,
      })),
    });

    const seq = data.sequence ?? [];
    const tracks = seq.map(this.mapTrack);
    const queueIds = seq.map((item: any) => {
      const t = item.track ?? item;
      return `${t.id}:${t.albums?.[0]?.id ?? "0"}`;
    });

    return {
      tracks,
      queueIds,
      batchId: data.batchId,
    };
  }

  /** Пинг Яндекс.Музыки — проверка доступности сервера (без авторизации) */
  static async ping(): Promise<boolean> {
    try {
      await fetch("https://api.music.yandex.net/account/status", {
        signal: AbortSignal.timeout(5000),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Получить URL обложки */
  static getCoverUrl(uri: string, size = "200x200"): string {
    return YaClient.getCoverUrl(uri, size);
  }
}
