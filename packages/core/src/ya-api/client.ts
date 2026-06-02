import { YandexMusicClient as YMClient } from "yandex-music";

export interface YaTrackInfo {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUri: string;
}

export class YaClient {
  private client: YMClient | null = null;
  private _token = "";

  get isAuthenticated(): boolean {
    return this.client !== null;
  }

  get token(): string {
    return this._token;
  }

  async login(username: string, password: string): Promise<void> {
    const { uid, token, language } = await YMClient.get({
      auth: { type: "LOGIN", username, password },
      language: "ru",
    });

    this._token = token;
    this.client = new YMClient(token, uid, language);
  }

  async getMyWaveTracks(limit = 20): Promise<YaTrackInfo[]> {
    if (!this.client) throw new Error("Not authenticated");

    // Get all stations
    const stations = await this.client.rotor.list();
    // Find "Моя волна" — usually has tag "onyourwave"
    const myWave =
      stations.find(
        (s) =>
          s.station.id.tag === "onyourwave" ||
          s.station.id.tag === "morning"
      ) ?? stations[0];

    if (!myWave) throw new Error("No stations found");

    const stationId = `${myWave.station.id.type}:${myWave.station.id.tag}`;
    const tracks = await this.client.rotor.tracks(stationId);

    return tracks.sequence.slice(0, limit).map((item) => {
      const t = item.track;
      return {
        id: t.id,
        title: t.title,
        artist: t.artists[0]?.name ?? "Unknown",
        album: t.albums[0]?.title ?? "",
        duration: Math.floor(t.durationMs / 1000),
        coverUri: t.coverUri,
      };
    });
  }

  static getCoverUrl(uri: string, size = "200x200"): string {
    return `https://${uri.replace("%%", size)}`;
  }
}
