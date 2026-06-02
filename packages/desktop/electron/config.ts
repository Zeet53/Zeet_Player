import { app } from "electron";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface PlayerConfig {
  volume: number;
  batchSize: number;
  refillThreshold: number;
  matchCandidateSearchLimit: number;
  matchCandidateDisplayLimit: number;
}

export interface WaveConfig {
  moodEnergy: string;
  diversity: string;
  language: string;
}

export interface DownloadConfig {
  path: string;
  format: string;
}

export interface ConfigData {
  player: PlayerConfig;
  wave: WaveConfig;
  download: DownloadConfig;
}

export interface SecretsData {
  ym: { token: string; uid: number };
}

export type MatchesData = Record<string, string>; // ymId → ytVideoId

// ──────────────────────────────────────────────
// Defaults
// ──────────────────────────────────────────────

const CONFIG_DEFAULTS: ConfigData = {
  player: {
    volume: 0.5,
    batchSize: 5,
    refillThreshold: 2,
    matchCandidateSearchLimit: 9,
    matchCandidateDisplayLimit: 9,
  },
  wave: {
    moodEnergy: "all",
    diversity: "default",
    language: "any",
  },
  download: {
    path: "",
    format: "mp3",
  },
};

const SECRETS_DEFAULTS: SecretsData = {
  ym: { token: "", uid: 0 },
};

// ──────────────────────────────────────────────
// Base manager with shared file logic
// ──────────────────────────────────────────────

class FileStore<T> {
  protected filePath: string;
  protected data: T;
  protected defaults: T;

  constructor(subPath: string, defaults: T, basePath?: string) {
    const userDataPath = basePath ?? app.getPath("userData");
    this.filePath = path.join(userDataPath, "configs", subPath);
    this.defaults = defaults;
    this.data = this.deepClone(defaults);
  }

  async load(): Promise<T> {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<T>;
      this.data = this.merge(parsed);
      console.log(`[Config] loaded from ${this.filePath}`);
    } catch {
      console.log(`[Config] no file at ${this.filePath}, creating defaults`);
      this.data = this.deepClone(this.defaults);
      await this.save();
    }
    return this.get();
  }

  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    if (!fsSync.existsSync(dir)) {
      fsSync.mkdirSync(dir, { recursive: true });
    }
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  get(): T {
    return this.data;
  }

  /** Установить значение по dot-notation пути (например "player.volume") */
  async set(path: string, value: any): Promise<void> {
    const parts = path.split(".");
    let obj: any = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (obj === undefined) throw new Error(`Invalid config path: ${path}`);
    }
    obj[parts[parts.length - 1]] = value;
    await this.save();
  }

  protected deepClone<U>(obj: U): U {
    return JSON.parse(JSON.stringify(obj));
  }

  protected merge(parsed: Partial<T>): T {
    // Default merge — override in subclass if more logic needed
    return { ...this.deepClone(this.defaults), ...parsed };
  }
}

// ──────────────────────────────────────────────
// ConfigManager — настройки (безопасно для шеринга)
// ──────────────────────────────────────────────

export class ConfigManager extends FileStore<ConfigData> {
  constructor() {
    super("config.json", CONFIG_DEFAULTS);
  }

  async setPlayer(partial: Partial<PlayerConfig>): Promise<void> {
    Object.assign(this.data.player, partial);
    await this.save();
  }

  async setWave(partial: Partial<WaveConfig>): Promise<void> {
    Object.assign(this.data.wave, partial);
    await this.save();
  }

  async reset(): Promise<ConfigData> {
    this.data = this.deepClone(CONFIG_DEFAULTS);
    await this.save();
    return this.get();
  }
}

// ──────────────────────────────────────────────
// SecretsManager — токены, uid (НЕ шерить!)
// ──────────────────────────────────────────────

export class SecretsManager extends FileStore<SecretsData> {
  constructor() {
    super("secrets.json", SECRETS_DEFAULTS);
  }

  async setYmAuth(auth: { token: string; uid: number }): Promise<void> {
    this.data.ym = auth;
    await this.save();
  }
}

// ──────────────────────────────────────────────
// MatchesStore — ручные матчи ymId → ytVideoId
// ──────────────────────────────────────────────

export class MatchesStore extends FileStore<MatchesData> {
  constructor() {
    super("matches.json", {} as MatchesData);
  }

  async load(): Promise<MatchesData> {
    const data = await super.load();
    const keys = Object.keys(data);
    console.log(`[Matches] loaded ${keys.length} matches: ${keys.slice(0, 5).join(", ")}`);
    return data;
  }
}
