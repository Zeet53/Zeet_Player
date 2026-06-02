import type { YaTrackInfo } from "../ya-api/client.js";
import type { YtTrackInfo } from "../yt-api/client.js";

/** Трек с информацией из Yandex и YouTube Music */
export class YtResolvedTrack {
  ym: YaTrackInfo;
  yt: YtTrackInfo | null = null;
  streamUrl: string | null = null;
  state: "pending" | "ready" | "failed" = "pending";

  constructor(ym: YaTrackInfo) {
    this.ym = ym;
  }

  toJSON(): object {
    return {
      ym: this.ym,
      yt: this.yt,
      streamUrl: this.streamUrl,
      state: this.state,
    };
  }

  static fromJSON(data: any): YtResolvedTrack {
    const t = new YtResolvedTrack(data.ym);
    t.yt = data.yt ?? null;
    t.streamUrl = data.streamUrl ?? null;
    t.state = data.state ?? "pending";
    return t;
  }
}
