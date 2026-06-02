import { Innertube, UniversalCache, Platform } from "youtubei.js";
import vm from "vm";

export interface YtTrackInfo {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
}

// Install real JS evaluator at module init to decrypt YouTube stream URLs
// youtubei.js ships with a stub that throws: "To decipher URLs, you must provide
// your own JavaScript evaluator." We replace it with Node's vm module.
if (Platform.shim.eval.toString().includes("provide your own")) {
  Platform.shim.eval = (data: any, _env: any) => {
    const code = `(function(){\n${data.output}\n})()`;
    return vm.runInNewContext(code, {}, { timeout: 5000 });
  };
}

/** Оборачивает youtubei.js и предоставляет методы для поиска и стриминга */
export class YtClient {
  private yt: Innertube | null = null;
  private initPromise: Promise<Innertube> | null = null;

  async ensureReady(): Promise<Innertube> {
    if (this.yt) return this.yt;
    if (this.initPromise) return this.initPromise;
    console.log(`[YT] создаю Innertube...`);
    this.initPromise = Innertube.create({
      cache: new UniversalCache(false),
      lang: "en",
    });
    this.yt = await this.initPromise;
    return this.yt;
  }

  /** Поиск треков в YouTube Music */
  async search(query: string, limit = 10): Promise<YtTrackInfo[]> {
    const yt = await this.ensureReady();
    let search = await yt.music.search(query);
    const results: YtTrackInfo[] = [];
    const seenVideoIds = new Set<string>();
    let page = 0;

    while (search && results.length < limit) {
      const sections = search.contents as any[] ?? [];
      if (page === 0) {
        console.log(`[YT searchRaw] query="${query}" — ${sections.length} sections`);
        for (let si = 0; si < sections.length; si++) {
          const s = sections[si];
          if (s.type === "ItemSection") {
            // Логируем сырые данные из ItemSection — ищем continuation
            const cont = s.continuation || s.continuation_endpoint || (s.endpoint?.payload && JSON.stringify(s.endpoint.payload).slice(0, 200));
            const hasContinuation = !!(s.continuation || s.continuation_endpoint || s.endpoint?.payload?.continuation);
            const items = (s.contents || []).map((it: any, ii: number) => ({
              idx: ii,
              type: it.item_type || it.type || it?.constructor?.name,
              id: it.id || "",
              title: it.title?.toString?.()?.slice(0, 60) ?? "",
              hasEndpoint: !!it.endpoint,
              hasContinuation: !!(it.endpoint?.payload?.continuation || it.continuation),
            }));
            console.log(`[YT searchRaw] ItemSection[${si}]: continuation=${!!cont} contField=${typeof cont === 'string' ? cont.slice(0, 80) : typeof cont}, items=${items.length}`, JSON.stringify(items));
          } else {
            const cont = s.continuation || s.continuation_endpoint;
            console.log(`[YT searchRaw] ${s.type}[${si}]: title="${(s.title?.toString?.() ?? s.title ?? '').slice(0, 60)}", items=${s.contents?.length ?? 0}, continuation=${!!cont}`);
          }
        }
      } else {
        console.log(`[YT searchRaw] page ${page}: ${sections.length} sections`);
      }

      for (const section of sections) {
        if (results.length >= limit) break;

        switch (section.type) {
          case "MusicCardShelf": {
            const track = this.parseMusicCardShelf(section);
            if (track && !seenVideoIds.has(track.videoId)) {
              seenVideoIds.add(track.videoId);
              results.push(track);
            }
            break;
          }
          case "MusicShelf": {
            for (const item of section.contents || []) {
              if (results.length >= limit) break;
              if (!item.id) {
                const overlayId = item.overlay?.content?.endpoint?.payload?.videoId;
                if (overlayId) item.id = overlayId;
              }
              if ((item.item_type === "song" || item.item_type === "video") && item.id && item.title) {
                if (seenVideoIds.has(item.id)) continue;
                seenVideoIds.add(item.id);
                results.push(this.toTrackInfo(item));
              }
            }
            break;
          }
          case "ItemSection": {
            for (const item of section.contents || []) {
              if (results.length >= limit) break;
              // Fallback: если id пустой — берём из overlay
              if (!item.id) {
                const overlayId = item.overlay?.content?.endpoint?.payload?.videoId;
                if (overlayId) item.id = overlayId;
              }
              if (!item.id || !item.title) continue;
              if (item.item_type !== "song" && item.item_type !== "video") continue;
              if (seenVideoIds.has(item.id)) continue;
              seenVideoIds.add(item.id);

              const track = this.toTrackInfo(item);

              if (item.item_type === "video" && (!track.artist || track.artist === "Unknown")) {
                const parsed = this.parseVideoTitle(track.title);
                if (parsed) {
                  track.title = parsed.title;
                  track.artist = parsed.artist;
                }
              }

              results.push(track);
            }
            break;
          }
        }
      }

      if (results.length >= limit) break;
      try {
        console.log(`[YT] loading continuation page ${page + 1}...`);
        search = await (search as any).getContinuation();
        if (!search || !search.contents) {
          console.log(`[YT] continuation returned empty`);
          break;
        }
        page++;
        console.log(`[YT] continuation page ${page}: ${(search.contents as any[]).length} sections`);
      } catch (e: any) {
        console.log(`[YT] continuation failed: ${e.message ?? e}`);
        break;
      }
    }

    console.log(`[YT] search "${query}" → ${results.length} tracks (pages: ${page + 1})`);
    return results;
  }

  /**
   * Parse track info from a MusicCardShelf (featured result card).
   * Fields are on the shelf itself, not in .contents.
   */
  private parseMusicCardShelf(shelf: any): YtTrackInfo | null {
    const title = shelf.title?.toString?.() ?? shelf.title;
    const videoId = shelf.on_tap?.payload?.videoId;
    if (!title || !videoId) return null;

    // subtitle format: "Song • Artist1, Artist2 • 3:45"
    const subtitle = shelf.subtitle?.toString?.() ?? "";
    const parts = subtitle.split(" • ");

    // Artist is the second part (after "Song"), take only the first artist
    let artist = "Unknown";
    if (parts.length >= 2) {
      artist = parts[1]?.trim() ?? "Unknown";
      // Multiple artists: "Artist1, Artist2, & Artist3" → "Artist1"
      artist = artist.split(",")[0].replace(/^& /, "").trim();
    }

    // Duration from the last part ("3:45")
    let duration = 0;
    const lastPart = parts[parts.length - 1]?.trim();
    const durMatch = lastPart?.match(/(\d+):(\d+)/);
    if (durMatch) {
      duration = parseInt(durMatch[1]) * 60 + parseInt(durMatch[2]);
    }

    const coverUrl =
      shelf.thumbnail?.contents?.[0]?.url ??
      shelf.thumbnail?.url ??
      "";

    return { id: videoId, videoId, title, artist, duration, coverUrl };
  }

  /** Получить прямую ссылку на аудиопоток */
  async getStreamUrl(track: YtTrackInfo): Promise<string | null> {
    return this.getStreamUrlByVideoId(track.videoId);
  }

  /** Получить прямую ссылку на аудиопоток по videoId */
  async getStreamUrlByVideoId(videoId: string): Promise<string | null> {
    try {
      const yt = await this.ensureReady();
      const info = await yt.getBasicInfo(videoId);
      const formats = [
        ...((info as any).streaming_data?.formats || []),
        ...((info as any).streaming_data?.adaptive_formats || []),
      ];

      // Find formats that have url, cipher, or signature_cipher (can be deciphered)
      // Audio-only formats lack these in YouTube's API, so we fall back to
      // video+audio formats like itag=18
      const cipherable = formats.find(
        (f: any) => f.url || f.cipher || f.signature_cipher,
      );
      if (!cipherable) return null;

      const player = (yt as any).session?.player;
      const url = await cipherable.decipher(player);
      return url || cipherable.url || null;
    } catch (e: any) {
      console.error(`[YT] getStreamUrl error: ${e.message ?? e}`);
      return null;
    }
  }

  /** Скачать аудио как ReadableStream */
  async download(
    videoId: string,
  ): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const yt = await this.ensureReady();
      return await yt.download(videoId, { type: "video+audio", format: "mp4" });
    } catch (e: any) {
      console.error(`[YT] download error: ${e.message ?? e}`);
      return null;
    }
  }

  private toTrackInfo(item: any): YtTrackInfo {
    return {
      id: item.id,
      videoId: item.id,
      title: item.title ?? "Unknown",
      artist: item.artists?.[0]?.name ?? "Unknown",
      duration: item.duration?.seconds ?? 0,
      coverUrl: item.thumbnails?.[0]?.url ?? "",
    };
  }

  /**
   * Парсит заголовок video-записи вида "Artist — Title (extra)"
   * или "Artist - Title (extra)", извлекает исполнителя и название.
   * Возвращает null, если формат не распознан.
   */
  private parseVideoTitle(title: string): { artist: string; title: string } | null {
    // "Artist — Title (extra)" или "Artist - Title (extra)"
    const sepMatch = title.match(/^(.+?)\s*[—–-]\s*(.+)$/);
    if (!sepMatch) return null;

    let artist = sepMatch[1].trim();
    let rawTitle = sepMatch[2].trim();

    // Убираем суффиксы в скобках из названия: "(текст)", "(speed up)", "(slowed)", "(lyrics)" etc.
    const cleaned = rawTitle.replace(/\s*\([^)]*\)\s*$/g, "").trim();

    return { artist, title: cleaned || rawTitle };
  }
}
