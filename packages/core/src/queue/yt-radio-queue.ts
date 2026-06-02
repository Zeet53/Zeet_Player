import type { YaTrackInfo } from "../ya-api/client.js";
import type { YtTrackInfo } from "../yt-api/client.js";
import { YandexMusicApi } from "../ya-api/api.js";
import { YouTubeMusicApi } from "../yt-api/api.js";
import { YtResolvedTrack } from "./yt-resolved-track.js";

type FeedbackType = "trackStarted" | "trackFinished" | "skip";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard similarity — пересечение/объединение слов */
function jaccard(a: string, b: string): number {
  const aw = new Set(normalize(a).split(" "));
  const bw = new Set(normalize(b).split(" "));
  let intersection = 0;
  for (const w of aw) { if (bw.has(w)) intersection++; }
  const union = new Set([...aw, ...bw]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Оценка совпадения YM-трека с YT-кандидатом.
 *
 * Правила:
 *  - titleScore  = jaccard(titleYM, titleYT) × 150  (0–150)
 *  - artistScore = jaccard(artistYM, artistYT) × 50  (0–50)
 *  - Если titleScore === 0 → 0 (другие треки того же артиста не интересуют)
 *  - Иначе → titleScore + artistScore
 */
function scoreMatch(ym: YaTrackInfo, yt: YtTrackInfo): number {
  const titleScore = Math.round(jaccard(ym.title, yt.title) * 150);
  if (titleScore === 0) return 0; // не совпало название — не кандидат
  const artistScore = Math.round(jaccard(ym.artist, yt.artist) * 50);
  return Math.min(titleScore + artistScore, 200);
}

// ============================================================
// YtRadioQueue — радио-очередь с резолвингом YouTube Music
// ============================================================

export class YtRadioQueue {
  private api: YandexMusicApi;
  private ytApi: YouTubeMusicApi;

  sessionId: string;
  from: string;
  stationId: string;
  queue: YtResolvedTrack[] = [];

  refillThreshold = 2;
  batchSize = 10;

  /** Сколько треков запрашиваем у YT для ручного матчинга */
  matchCandidateSearchLimit = 15;
  /** Сколько кандидатов показываем в UI */
  matchCandidateDisplayLimit = 5;

  /** Ручные матчи: "artist:title" (как есть) → ytVideoId */
  manualMatches: Map<string, string> = new Map();
  /** Callback при новом ручном матче */
  onManualMatchSaved: ((key: string, ytVideoId: string) => void) | null = null;

  private static matchKey(artist: string, title: string): string {
    return `${artist}:${title}`;
  }

  /** Загрузить сохранённые ручные матчи (из файла) */
  loadManualMatches(entries: Record<string, string>): void {
    const keys = Object.keys(entries);
    if (keys.length > 0) {
      console.log(`[Match] loaded ${keys.length} manual matches: ${keys.slice(0, 5).join(", ")}`);
    } else {
      console.log(`[Match] loaded 0 manual matches`);
    }
    for (const [key, ytVideoId] of Object.entries(entries)) {
      this.manualMatches.set(key, ytVideoId);
    }
  }

  /** Сохранить ручной матч в памяти */
  setManualMatch(key: string, ytVideoId: string): void {
    this.manualMatches.set(key, ytVideoId);
    console.log(`[Match] saved: ${key} → ${ytVideoId}`);
  }

  index = -1;
  private batchId = "";
  private queueHistory: string[] = [];
  private currentQueueId = "";

  constructor(
    session: { sessionId: string; from: string; stationId: string },
    api: YandexMusicApi,
    options?: { refillThreshold?: number; batchSize?: number },
  ) {
    this.sessionId = session.sessionId;
    this.from = session.from;
    this.stationId = session.stationId;
    this.api = api;
    this.ytApi = new YouTubeMusicApi();

    if (options?.refillThreshold !== undefined)
      this.refillThreshold = options.refillThreshold;
    if (options?.batchSize !== undefined)
      this.batchSize = options.batchSize;
  }

  get currentTrack(): YtResolvedTrack | null {
    return this.index >= 0 && this.index < this.queue.length
      ? this.queue[this.index]
      : null;
  }

  private getTrack(): YtResolvedTrack {
    return this.queue[this.index];
  }

  private getAlbumId(index: number): string {
    const trackId = this.queue[index].ym.id;
    const match = this.queueHistory.find((qid) =>
      qid.startsWith(`${trackId}:`),
    );
    return match ? match.split(":")[1] : "0";
  }

  // ============================================================
  // Добавление и резолвинг треков
  // ============================================================

  private async addTracks(
    newTracks: YaTrackInfo[],
    newQueueIds: string[],
    newBatchId: string,
  ): Promise<number> {
    for (const qid of newQueueIds) {
      if (!this.queueHistory.includes(qid)) {
        this.queueHistory.push(qid);
      }
    }
    this.batchId = newBatchId;

    const results = await Promise.all(
      newTracks.map(async (track, i) => {
        if (this.queue.some((r) => r.ym.id === track.id)) return null;
        const resolved = await this.resolveTrack(track);
        if (resolved) return { resolved, queueId: newQueueIds[i] };
        return null;
      }),
    );

    let addedCount = 0;
    for (const r of results) {
      if (!r) continue;
      this.queue.push(r.resolved);
      addedCount++;
      if (this.index === -1 && this.currentQueueId === "") {
        this.currentQueueId = r.queueId;
      }
    }
    return addedCount;
  }

  /**
   * Найти трек на YouTube Music по YaTrackInfo.
   * Проверяет сохранённый ручной матч перед поиском.
   */
  async resolveTrack(ymTrack: YaTrackInfo): Promise<YtResolvedTrack | null> {
    // 1) Проверяем ручной матч по artist:title
    const matchKey = YtRadioQueue.matchKey(ymTrack.artist, ymTrack.title);
    const savedVideoId = this.manualMatches.get(matchKey);
    if (savedVideoId) {
      console.log(`[Match] found for "${matchKey}" → videoId=${savedVideoId}, getting stream...`);
      try {
        const streamUrl = await this.ytApi.getStreamUrlByVideoId(savedVideoId);
        if (streamUrl) {
          // Получаем информацию о треке по videoId — поищем с ним
          const searchResults = await this.ytApi.search(savedVideoId, 1);
          const ytTrack = searchResults.find(r => r.videoId === savedVideoId);
          if (ytTrack) {
            const result = new YtResolvedTrack(ymTrack);
            result.yt = ytTrack;
            result.streamUrl = streamUrl;
            result.state = "ready";
            console.log(
              `[YT] ✅ ${ymTrack.artist} — ${ymTrack.title} → [manual] ${ytTrack.artist} — ${ytTrack.title}`,
            );
            return result;
          }
          // Если поиск не вернул трек — используем минимальные данные
          const result = new YtResolvedTrack(ymTrack);
          result.yt = { id: savedVideoId, videoId: savedVideoId, title: ymTrack.title, artist: ymTrack.artist, duration: 0, coverUrl: "" };
          result.streamUrl = streamUrl;
          result.state = "ready";
          console.log(
            `[YT] ✅ ${ymTrack.artist} — ${ymTrack.title} → [manual] videoId=${savedVideoId}`,
          );
          return result;
        }
        console.log(
          `[YT] ${ymTrack.artist} — ${ymTrack.title} → ручной матч ${savedVideoId} недоступен`,
        );
        return null;
      } catch (e: any) {
        console.log(
          `[YT] ${ymTrack.artist} — ${ymTrack.title} → ошибка ручного матча ${savedVideoId}: ${e.message}`,
        );
        return null;
      }
    }

    // 2) Обычный поиск + скоринг
    try {
      const query = `${ymTrack.artist} — ${ymTrack.title}`;
      const results = await this.ytApi.search(query, 5);

      if (results.length === 0) {
        console.log(
          `[YT] ${ymTrack.artist} — ${ymTrack.title} → не найдено на YouTube Music`,
        );
        return null;
      }

      // Оценка результатов
      const scored = results
        .map((track) => ({ track, score: scoreMatch(ymTrack, track) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        console.log(
          `[YT] ${ymTrack.artist} — ${ymTrack.title} → совпадение не найдено`,
        );
        return null;
      }

      // Перебираем кандидатов по убыванию скора — берём первого со streamUrl
      for (const candidate of scored) {
        const streamUrl = await this.ytApi.getStreamUrl(candidate.track);
        if (!streamUrl) {
          console.log(
            `[YT] ${ymTrack.artist} — ${ymTrack.title} → ${candidate.track.artist} — ${candidate.track.title} (score: ${candidate.score}) ❌ нет stream-ссылки, пробуем следующий...`,
          );
          continue;
        }

        const result = new YtResolvedTrack(ymTrack);
        result.yt = candidate.track;
        result.streamUrl = streamUrl;
        result.state = "ready";
        console.log(
          `[YT] ✅ ${ymTrack.artist} — ${ymTrack.title} → ${candidate.track.artist} — ${candidate.track.title} (score: ${candidate.score})`,
        );
        return result;
      }

      console.log(
        `[YT] ${ymTrack.artist} — ${ymTrack.title} → ни один кандидат не имеет stream-ссылки`,
      );
      return null;
    } catch (e: any) {
      console.error(
        `[YT] ${ymTrack.artist} — ${ymTrack.title}: ${e.message ?? e}`,
      );
      return null;
    }
  }

  async fill(
    tracks: YaTrackInfo[],
    queueIds: string[],
    batchId: string,
  ): Promise<number> {
    return this.addTracks(tracks, queueIds, batchId);
  }

  // ============================================================
  // Навигация
  // ============================================================

  async sendTrackStarted(): Promise<void> {
    if (!this.sessionId || !this.currentQueueId || !this.batchId) return;
    await this.api.sessionFeedback(
      this.sessionId,
      "trackStarted",
      this.batchId,
      this.currentQueueId,
      this.from,
    );
  }

  private async ensureBuffer(feedback?: {
    type: FeedbackType;
    time: number;
  }): Promise<void> {
    const remaining = this.queue.length - this.index - 1;
    if (remaining > this.refillThreshold) return;

    const feedbacks: Array<{
      batchId: string;
      type: FeedbackType;
      trackId: string;
      from: string;
      totalPlayedSeconds?: number;
    }> = [];

    if (feedback) {
      feedbacks.push({
        batchId: this.batchId,
        type: feedback.type,
        trackId: this.currentQueueId,
        from: this.from,
        totalPlayedSeconds: feedback.time,
      });
    }

    console.log(`[Queue] Осталось ${remaining}, загружаю ещё...`);
    const result = await this.api.getSessionTracks(
      this.sessionId,
      this.queueHistory,
      feedbacks,
    );
    const tracks = result.tracks.slice(0, this.batchSize);
    const queueIds = result.queueIds.slice(0, this.batchSize);
    const added = await this.addTracks(tracks, queueIds, result.batchId);
    console.log(`[Queue] +${added} валидных YT (всего: ${this.queue.length})`);
  }

  async forward(feedback?: {
    type: FeedbackType;
    time: number;
  }): Promise<YtResolvedTrack | null> {
    if (this.queue.length === 0) return null;

    if (this.index === -1) {
      this.index = 0;
    } else if (this.index < this.queue.length - 1) {
      this.index++;
    }

    if (this.index >= this.queue.length) {
      this.index = this.queue.length - 1;
    }

    this.currentQueueId = `${this.getTrack().ym.id}:${this.getAlbumId(this.index)}`;
    await this.ensureBuffer(feedback);
    await this.sendTrackStarted();

    return this.getTrack();
  }

  async back(): Promise<YtResolvedTrack | null> {
    if (this.queue.length === 0) return null;
    if (this.index > 0) {
      this.index--;
    }
    this.currentQueueId = `${this.getTrack().ym.id}:${this.getAlbumId(this.index)}`;
    return this.getTrack();
  }

  // ============================================================
  // Лайки
  // ============================================================

  async like(track?: YtResolvedTrack): Promise<void> {
    const t = track ?? this.currentTrack;
    if (!t) throw new Error("Нет трека");
    await this.api.likeTrack(t.ym.id);
    console.log(`❤️ ${t.ym.artist} — ${t.ym.title}`);
  }

  async dislike(track?: YtResolvedTrack): Promise<void> {
    const t = track ?? this.currentTrack;
    if (!t) throw new Error("Нет трека");
    await this.api.dislikeTrack(t.ym.id);
    console.log(`💔 ${t.ym.artist} — ${t.ym.title}`);
  }

  async unlike(track?: YtResolvedTrack): Promise<void> {
    const t = track ?? this.currentTrack;
    if (!t) throw new Error("Нет трека");
    await this.api.removeLikeTrack(t.ym.id);
    console.log(`💛 Убран лайк: ${t.ym.artist} — ${t.ym.title}`);
  }

  async undislike(track?: YtResolvedTrack): Promise<void> {
    const t = track ?? this.currentTrack;
    if (!t) throw new Error("Нет трека");
    await this.api.removeDislikeTrack(t.ym.id);
    console.log(`💙 Убран дизлайк: ${t.ym.artist} — ${t.ym.title}`);
  }

  // ============================================================
  // Поиск и ручной матчинг
  // ============================================================

  async searchAndResolve(
    query: string,
    limit = 5,
  ): Promise<YtResolvedTrack[]> {
    console.log(`[Search] Ищу "${query}" в YM...`);
    const tracks = await this.api.search(query, limit);
    if (tracks.length === 0) {
      console.log(`[Search] Ничего не найдено`);
      return [];
    }

    console.log(`[Search] Найдено ${tracks.length} треков, резолвлю YT...`);
    const results = await Promise.all(
      tracks.map((track) => this.resolveTrack(track)),
    );

    const resolved = results.filter((r): r is YtResolvedTrack => r !== null);
    console.log(`[Search] Готово: ${resolved.length}/${tracks.length} с YT`);
    return resolved;
  }

  async getLikedTracks(
    page = 0,
    pageSize = 50,
  ): Promise<YtResolvedTrack[]> {
    const tracks = await this.api.getLikedTracks(page, pageSize);
    console.log(`[Likes] ${tracks.length} лайкнутых треков, резолвлю YT...`);
    const results = await Promise.all(
      tracks.map((track) => this.resolveTrack(track)),
    );
    return results.filter((r): r is YtResolvedTrack => r !== null);
  }

  async getMatchCandidates(
    ymTrack: YaTrackInfo,
    limit = 10,
  ): Promise<{
    candidates: Array<{
      track: YtTrackInfo;
      streamUrl: string;
      score: number;
    }>;
    autoMatch: YtTrackInfo | null;
  }> {
    const query = `${ymTrack.artist} — ${ymTrack.title}`;
    const results = await this.ytApi.search(query, this.matchCandidateSearchLimit);
    if (results.length === 0) return { candidates: [], autoMatch: null };

    console.log(`[Match] ${results.length} results from search:`);

    const withStreams = await Promise.all(
      results.map(async (ytTrack, i) => {
        const streamUrl = await this.ytApi.getStreamUrl(ytTrack);
        return { ytTrack, streamUrl, index: i };
      }),
    );

    const candidates = withStreams
      .filter(
        (r): r is { ytTrack: YtTrackInfo; streamUrl: string; index: number } =>
          r.streamUrl !== null,
      )
      .map((r) => {
        const score = scoreMatch(ymTrack, r.ytTrack);
        return { track: r.ytTrack, streamUrl: r.streamUrl, score, idx: r.index };
      })
      .sort((a, b) => b.score - a.score);

    const display = candidates
      .filter(c => c.score > 0)
      .slice(0, this.matchCandidateDisplayLimit);

    // Log each candidate from original search
    for (const r of withStreams) {
      const score = r.streamUrl ? scoreMatch(ymTrack, r.ytTrack) : 0;
      let reason: string;
      if (!r.streamUrl) {
        reason = "no stream url";
      } else if (score === 0) {
        reason = "score is 0";
      } else {
        const isShown = display.some(d => d.track.videoId === r.ytTrack.videoId);
        reason = isShown ? "shown" : "hidden (limit)";
      }
      console.log(`[Match]   #${r.index + 1} ${r.ytTrack.artist} — ${r.ytTrack.title} (${score}) - ${reason}`);
    }

    const autoMatch =
      candidates.length > 0 && candidates[0].score > 0
        ? candidates[0]
        : null;

    const shownCount = display.length;
    const noStreamCount = withStreams.length - candidates.length;
    const zeroScoreCount = candidates.filter(c => c.score === 0).length;
    const hiddenCount = Math.max(0, candidates.filter(c => c.score > 0).length - this.matchCandidateDisplayLimit);
    console.log(`[Match] total: ${results.length} | no-stream: ${noStreamCount} | score-0: ${zeroScoreCount} | hidden: ${hiddenCount} | shown: ${shownCount}`);
    return { candidates: display, autoMatch: autoMatch?.track ?? null };
  }

  applyManualMatch(
    track: YtResolvedTrack,
    ytTrack: YtTrackInfo,
    streamUrl: string,
  ): YtResolvedTrack {
    track.yt = ytTrack;
    track.streamUrl = streamUrl;
    track.state = "ready";
    // Сохраняем ручной матч по artist:title
    const key = YtRadioQueue.matchKey(track.ym.artist, track.ym.title);
    this.manualMatches.set(key, ytTrack.videoId);
    if (this.onManualMatchSaved) {
      this.onManualMatchSaved(key, ytTrack.videoId);
    }
    console.log(
      `[Match] ✅ сохранён ручной матч: "${key}" → ${ytTrack.artist} — ${ytTrack.title} (${ytTrack.videoId})`,
    );
    return track;
  }

  // ============================================================
  // Волна по треку
  // ============================================================

  async startTrackRadio(track: YtResolvedTrack): Promise<void> {
    const session = await this.api.createTrackSession(track.ym.id);

    this.sessionId = session.sessionId;
    this.from = session.from;
    this.stationId = session.stationId;
    this.batchId = session.batchId;
    this.queue = [];
    this.index = -1;
    this.queueHistory = [];

    // Seed-трек первым
    this.queue.push(track);
    this.queueHistory.push("");
    this.index = 0;
    this.currentQueueId = "";

    const apiTracks = session.tracks.filter(
      (t) => t.id !== track.ym.id,
    );
    const apiQueueIds = session.queueIds.filter(
      (qid) => !qid.startsWith(`${track.ym.id}:`),
    );

    await this.addTracks(apiTracks, apiQueueIds, session.batchId);

    console.log(
      `🎵 Волна по треку: ${track.ym.artist} — ${track.ym.title}`,
    );
  }
}
