import { useState, useEffect, useRef, useCallback } from "react";
import type { UserInfo, TrackData, QueueState, MatchCandidatesResult, YtMatchTrack, FeedbackStatus, WaveSettings, RadioStatus, ConfigData, PlayerConfig } from "./types";

// Forward console.log to main process terminal
{
  const origLog = console.log.bind(console);
  console.log = (...args: any[]) => {
    origLog(...args);
    try {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      window.api.log(msg);
    } catch {}
  };
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function coverUrl(uri: string, size = "200x200"): string {
  return `https://${uri.replace("%%", size)}`;
}

// ================================================================
// MatchMenu — overlay with YT candidates for manual matching
// ================================================================

function MatchMenu(props: {
  result: MatchCandidatesResult;
  previewingId: string | null;
  onPreview: (candidate: { track: YtMatchTrack; streamUrl: string }) => void;
  onStopPreview: () => void;
  onSelect: (candidate: { track: YtMatchTrack; streamUrl: string }) => void;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        props.onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [props]);

  const ym = props.result.ym;
  const ymCover = coverUrl(ym.coverUri);

  return (
    <div className="match-overlay">
      <div className="match-panel" ref={overlayRef}>
        <div className="match-header">
          <img className="match-ym-cover" src={ymCover} alt="" />
          <div className="match-ym-info">
            <div className="match-ym-label">YM</div>
            <div className="match-ym-title">{ym.title}</div>
            <div className="match-ym-artist">{ym.artist}</div>
          </div>
          <button className="match-close" onClick={props.onClose}>✕</button>
        </div>

        <div className="match-list">
          {props.result.candidates.length === 0 && (
            <div className="match-empty">Нет кандидатов</div>
          )}
          {props.result.candidates.map((c, i) => {
            const isPrev = props.previewingId === c.track.id;
            return (
              <div className="match-item" key={c.track.id ?? i}>
                <img
                  className="match-item-cover"
                  src={c.track.coverUrl || "https://via.placeholder.com/40"}
                  alt=""
                  onClick={() => isPrev ? props.onStopPreview() : props.onPreview(c)}
                />
                <div className="match-item-info">
                  <div className="match-item-title">{c.track.title}</div>
                  <div className="match-item-artist">{c.track.artist}</div>
                </div>
                <button
                  className="match-item-play"
                  onClick={() => isPrev ? props.onStopPreview() : props.onPreview(c)}
                  title={isPrev ? "Остановить" : "Прослушать"}
                >
                  {isPrev ? "⏹" : "▶"}
                </button>
                <button
                  className="match-item-select"
                  onClick={() => props.onSelect(c)}
                  title="Выбрать"
                >
                  Выбрать
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ================================================================
// WaveSettingsMenu — wave settings overlay
// ================================================================

const MOOD_OPTIONS: Array<{ value: WaveSettings["moodEnergy"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "fun", label: "Fun" },
  { value: "calm", label: "Calm" },
  { value: "sad", label: "Sad" },
  { value: "all", label: "All" },
];

const DIVERSITY_OPTIONS: Array<{ value: WaveSettings["diversity"]; label: string }> = [
  { value: "favorite", label: "Favorite" },
  { value: "discover", label: "Discover" },
  { value: "popular", label: "Popular" },
  { value: "default", label: "Default" },
];

const LANGUAGE_OPTIONS: Array<{ value: WaveSettings["language"]; label: string }> = [
  { value: "russian", label: "Russian" },
  { value: "not-russian", label: "Not Russian" },
  { value: "any", label: "Any" },
];

function WaveSettingsMenu(props: {
  settings: WaveSettings;
  onChange: (s: WaveSettings) => void;
  onCancel: () => void;
  onOk: () => void;
  loading: boolean;
}) {
  const { settings, onChange, onCancel, onOk, loading } = props;
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onCancel]);

  return (
    <div className="match-overlay">
      <div className="match-panel" ref={overlayRef}>
        <div className="match-header">
          <h3 style={{ flex: 1, color: "#fff", fontSize: 16, margin: 0 }}>Wave Settings</h3>
          <button className="match-close" onClick={onCancel}>✕</button>
        </div>
        <div className="match-list" style={{ padding: "12px 16px" }}>
          <div className="wave-section">
            <div className="wave-section-title">Mood / Energy</div>
            <div className="wave-options">
              {MOOD_OPTIONS.map(opt => (
                <label key={opt.value} className="wave-option">
                  <input
                    type="radio"
                    name="moodEnergy"
                    checked={settings.moodEnergy === opt.value}
                    onChange={() => onChange({ ...settings, moodEnergy: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="wave-section">
            <div className="wave-section-title">Diversity</div>
            <div className="wave-options">
              {DIVERSITY_OPTIONS.map(opt => (
                <label key={opt.value} className="wave-option">
                  <input
                    type="radio"
                    name="diversity"
                    checked={settings.diversity === opt.value}
                    onChange={() => onChange({ ...settings, diversity: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="wave-section">
            <div className="wave-section-title">Language</div>
            <div className="wave-options">
              {LANGUAGE_OPTIONS.map(opt => (
                <label key={opt.value} className="wave-option">
                  <input
                    type="radio"
                    name="language"
                    checked={settings.language === opt.value}
                    onChange={() => onChange({ ...settings, language: opt.value })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <button className="wave-ok-btn" onClick={onOk} disabled={loading}>
            {loading ? "Applying..." : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SettingsMenu — full settings overlay
// ================================================================

function SettingsNumField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="settings-field">
      <span className="settings-field-label">{props.label}</span>
      <div className="settings-field-controls">
        <button
          className="settings-num-btn"
          onClick={() => props.onChange(Math.max(props.min, props.value - 1))}
          disabled={props.value <= props.min}
        >−</button>
        <span className="settings-num-value">{props.value}</span>
        <button
          className="settings-num-btn"
          onClick={() => props.onChange(Math.min(props.max, props.value + 1))}
          disabled={props.value >= props.max}
        >+</button>
      </div>
    </div>
  );
}

function SettingsMenu(props: {
  config: ConfigData;
  onSave: (config: ConfigData) => void;
  onCancel: () => void;
  onLogout: () => void;
  onOpenFolder: () => Promise<string | null>;
}) {
  const [pending, setPending] = useState<ConfigData>(() => JSON.parse(JSON.stringify(props.config)));
  const [resetting, setResetting] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onCancel();
    };
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        props.onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [props]);

  const updatePlayer = (partial: Partial<PlayerConfig>) => {
    setPending(prev => ({ ...prev, player: { ...prev.player, ...partial } }));
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const defaults = await window.api.resetConfig();
      setPending(defaults);
    } catch (e: any) {
      console.error("reset error:", e.message ?? e);
    }
    setResetting(false);
  };

  const handlePickFolder = async () => {
    const folder = await props.onOpenFolder();
    if (folder) {
      setPending(prev => ({ ...prev, download: { ...prev.download, path: folder } }));
    }
  };

  return (
    <div className="match-overlay">
      <div className="match-panel settings-panel" ref={overlayRef}>
        <div className="match-header">
          <h3 style={{ flex: 1, color: "#fff", fontSize: 16, margin: 0 }}>Settings</h3>
          <button className="match-close" onClick={props.onCancel}>✕</button>
        </div>

        <div className="settings-scroll">
          {/* Player Settings */}
          <div className="settings-section">
            <div className="settings-section-title">Player Settings</div>
            <SettingsNumField
              label="Batch Size"
              value={pending.player.batchSize}
              min={1} max={20}
              onChange={v => updatePlayer({ batchSize: v })}
            />
            <SettingsNumField
              label="Refill Threshold"
              value={pending.player.refillThreshold}
              min={1} max={10}
              onChange={v => updatePlayer({ refillThreshold: v })}
            />
            <SettingsNumField
              label="Match Search Limit"
              value={pending.player.matchCandidateSearchLimit}
              min={5} max={50}
              onChange={v => updatePlayer({ matchCandidateSearchLimit: v })}
            />
            <SettingsNumField
              label="Match Display Limit"
              value={pending.player.matchCandidateDisplayLimit}
              min={1} max={20}
              onChange={v => updatePlayer({ matchCandidateDisplayLimit: v })}
            />
          </div>

          {/* Download */}
          <div className="settings-section">
            <div className="settings-section-title">Download</div>
            <div className="settings-field">
              <span className="settings-field-label">Save Path</span>
              <div className="settings-folder-row">
                <button className="settings-folder-btn" onClick={handlePickFolder}>
                  📁 Select Folder...
                </button>
                <span className="settings-folder-path">
                  {pending.download.path || "Not set"}
                </span>
              </div>
            </div>
          </div>

          {/* Account */}
          <div className="settings-section">
            <div className="settings-section-title">Account</div>
            <button className="settings-logout-btn" onClick={props.onLogout}>
              ⏻  Logout
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button className="settings-action-btn settings-action-btn--reset" onClick={handleReset} disabled={resetting}>
            {resetting ? "Resetting..." : "Reset"}
          </button>
          <div className="settings-actions-right">
            <button className="settings-action-btn" onClick={props.onCancel}>
              Cancel
            </button>
            <button className="settings-action-btn settings-action-btn--save" onClick={() => props.onSave(pending)}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// App
// ================================================================

export default function App() {
  const [status, setStatus] = useState<"pinging" | "idle" | "loading" | "playing">("pinging");
  const [pingOk, setPingOk] = useState(false);
  const [authing, setAuthing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Player
  const [currentTrack, setCurrentTrack] = useState<TrackData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [displayMode, setDisplayMode] = useState<"ym" | "yt">("ym");
  const [volume, setVolume] = useState(0.5);
  const volumeRef = useRef(0.5);
  const [feedback, setFeedback] = useState<FeedbackStatus>("none");

  // Match menu
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchCandidatesResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // Wave settings
  const [waveMenuOpen, setWaveMenuOpen] = useState(false);
  const [waveSettings, setWaveSettings] = useState<WaveSettings | null>(null);
  const [pendingWaveSettings, setPendingWaveSettings] = useState<WaveSettings>({
    moodEnergy: "all",
    diversity: "default",
    language: "any",
  });
  const [waveLoading, setWaveLoading] = useState(false);
  const [radioStatus, setRadioStatus] = useState<RadioStatus>({ mode: "default", tags: [], trackName: "" });

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState<ConfigData | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TrackData[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Download
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<TrackData | null>(null);
  const forwardRef = useRef<((fb: { type: "skip" | "trackFinished"; time: number } | null, autoPlay?: boolean) => void) | null>(null);
  const previewingRef = useRef(false);
  const savedTimeRef = useRef(0);
  const savedTrackIdRef = useRef("");
  const savedStreamUrlRef = useRef("");

  // --- Audio element ---

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => { setCurrentTime(audio.currentTime); };
    audio.onloadedmetadata = () => { console.log(`[Audio] loadedmetadata: duration=${audio.duration}`); setDuration(audio.duration); };
    audio.onerror = () => {
      if (previewingRef.current) return;
      console.error(`[Audio] error: code=${audio.error?.code} message=${audio.error?.message ?? "unknown"}`);
      if (forwardRef.current) forwardRef.current(null);
    };

    audio.onended = () => {
      if (previewingRef.current) return;
      const track = currentTrackRef.current;
      if (track && forwardRef.current) {
        forwardRef.current({ type: "trackFinished", time: track.ym.duration });
      }
    };

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // --- Play track helper ---

  const playTrack = useCallback((track: TrackData) => {
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    previewingRef.current = false; // real track — re-enable ended/error handlers
    // Update feedback state — track уже приходит с feedback из attachFeedback
    if (track.feedback !== undefined) {
      setFeedback(track.feedback);
    } else {
      window.api.feedbackStatus().then(setFeedback).catch(() => setFeedback("none"));
    }

    const audio = audioRef.current;
    if (!audio || !track.streamUrl) {
      console.log(`[playTrack] no audio or no streamUrl: audio=${!!audio}, streamUrl=${!!track.streamUrl}`);
      return;
    }

    const url = track.streamUrl;
    console.log(`[playTrack] "${track.ym.artist} - ${track.ym.title}" url=${url.slice(0, 80)}...`);

    audio.src = url;
    audio.currentTime = 0;
    audio.play()
      .then(() => {
        console.log(`[playTrack] play OK`);
        if (track.yt?.videoId) {
          console.log(`  ▶ https://music.youtube.com/watch?v=${track.yt.videoId}`);
        }
      })
      .catch((err) => {
        console.log(`[playTrack] play failed: ${err.message}`);
        setIsPlaying(false);
      });
  }, []);

  // --- Init queue & play (after auth) ---

  const initQueueAndPlay = useCallback(async () => {
    setStatus("loading");
    console.log(`[App] calling queueInit...`);
    try {
      const track = await window.api.queueInit();
      console.log(`[App] queueInit returned: ${track ? `"${track.ym.artist} - ${track.ym.title}" state=${track.state} hasStream=${!!track.streamUrl} hasYT=${!!track.yt}` : 'null'}`);

      // Load volume from config
      const config: ConfigData = await window.api.getConfig();
      const savedVolume = config.player.volume;
      volumeRef.current = savedVolume;
      setVolume(savedVolume);
      const audio = audioRef.current;
      if (audio) audio.volume = savedVolume;

      if (track) {
        setCurrentTrack(track);
        currentTrackRef.current = track;
        setStatus("playing");
        playTrack(track);
      } else {
        setError("No tracks available");
        setStatus("idle");
      }
    } catch (e: any) {
      setError(e.message ?? "Init failed");
      setStatus("idle");
    }
  }, [playTrack]);

  // --- Ping ---

  const checkPing = useCallback(async () => {
    setStatus("pinging");
    setError(null);
    try {
      const result = await window.api.ping();
      if (result.ym && result.yt) {
        setPingOk(true);

        // Try auto-login with saved token
        const restored = await window.api.ymRestoreSession();
        if (restored) {
          setUserInfo(restored);
          await initQueueAndPlay();
          return;
        }

        setStatus("idle");
      } else {
        const failed = [];
        if (!result.ym) failed.push("Yandex Music");
        if (!result.yt) failed.push("YouTube Music");
        setError(`Unavailable: ${failed.join(", ")}`);
        setStatus("idle");
      }
    } catch (e: any) {
      setError(e.message ?? "Ping failed");
      setStatus("idle");
    }
  }, [initQueueAndPlay]);

  useEffect(() => { checkPing(); }, [checkPing]);

  // --- Login ---

  const handleLogin = useCallback(async () => {
    setAuthing(true);
    setError(null);
    try {
      await window.api.ymLoginOAuth();
      const info = await window.api.getUserInfo();
      setUserInfo(info);
      await initQueueAndPlay();
    } catch (e: any) {
      setError(e.message === "Auth window closed" ? "Sign in cancelled" : e.message ?? "Auth failed");
    }
    setAuthing(false);
  }, [initQueueAndPlay]);

  // --- Forward / Back ---

  const doForward = useCallback(async (feedback: { type: "skip" | "trackFinished"; time: number } | null, autoPlay = true) => {
    try {
      const track = await window.api.queueForward(feedback);
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        if (autoPlay) playTrack(track);
      }
      const state: QueueState = await window.api.queueState();
      setCanPrev(state.canPrev);
      setCanNext(state.canNext);
    } catch (e: any) {
      console.error("forward error:", e.message ?? e);
    }
  }, [playTrack]);

  const doBack = useCallback(async () => {
    try {
      const track = await window.api.queueBack();
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        playTrack(track);
      }
      const state: QueueState = await window.api.queueState();
      setCanPrev(state.canPrev);
      setCanNext(state.canNext);
    } catch (e: any) {
      console.error("back error:", e.message ?? e);
    }
  }, [playTrack]);

  forwardRef.current = doForward;

  // --- Play/pause toggle ---

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) { console.log(`[togglePlay] no audio element`); return; }
    console.log(`[togglePlay] paused=${audio.paused}, readyState=${audio.readyState}`);
    if (audio.paused) {
      audio.play()
        .then(() => { console.log(`[togglePlay] play OK`); setIsPlaying(true); })
        .catch((err) => {
          console.log(`[togglePlay] play rejected: ${err.message}`);
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
      console.log(`[togglePlay] paused by user`);
    }
  }, []);

  // --- Seek ---

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  // --- Volume ---

  const handleVolume = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    volumeRef.current = v;
    setVolume(v);
    const audio = audioRef.current;
    if (audio) audio.volume = v;
    window.api.setVolume(v);
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    const next = Math.round(Math.min(1, Math.max(0, volumeRef.current + delta)) * 100) / 100;
    volumeRef.current = next;
    setVolume(next);
    const audio = audioRef.current;
    if (audio) audio.volume = next;
    window.api.setVolume(next);
  }, []);

  // --- Like / Dislike ---

  const handleLike = useCallback(async () => {
    try {
      if (feedback === "liked") {
        await window.api.unlike();
        setFeedback("none");
      } else {
        if (feedback === "disliked") await window.api.undislike();
        await window.api.like();
        setFeedback("liked");
      }
    } catch (e: any) {
      console.error("like error:", e.message ?? e);
    }
  }, [feedback]);

  const handleDislike = useCallback(async () => {
    try {
      if (feedback === "disliked") {
        await window.api.undislike();
        setFeedback("none");
      } else {
        if (feedback === "liked") await window.api.unlike();
        await window.api.dislike();
        setFeedback("disliked");
      }
    } catch (e: any) {
      console.error("dislike error:", e.message ?? e);
    }
  }, [feedback]);

  // --- Skip button handler with feedback ---

  const handleSkip = useCallback(() => {
    const audio = audioRef.current;
    const time = audio ? audio.currentTime : 0;
    console.log(`[handleSkip] skip at time=${time}`);
    doForward({ type: "skip", time });
  }, [doForward]);

  // --- Auto-update queue state ---

  useEffect(() => {
    if (!currentTrack) return;
    window.api.queueState().then((state: QueueState) => {
      setCanPrev(state.canPrev);
      setCanNext(state.canNext);
    }).catch(() => {});
    window.api.queueRadioStatus().then(setRadioStatus).catch(() => {});
  }, [currentTrack]);

  // --- Match menu ---

  const openMatchMenu = useCallback(async () => {
    if (!currentTrack) return;
    // Pause and save current track state
    const audio = audioRef.current;
    if (audio) {
      savedTimeRef.current = audio.currentTime;
      savedTrackIdRef.current = currentTrack.ym.id;
      savedStreamUrlRef.current = audio.src;
      audio.pause();
      setIsPlaying(false);
    }
    setMatchLoading(true);
    setMatchOpen(true);
    try {
      const result = await window.api.getMatchCandidates(5);
      setMatchResult(result);
    } catch (e: any) {
      console.error("match candidates error:", e.message ?? e);
      setMatchResult(null);
    }
    setMatchLoading(false);
  }, [currentTrack]);

  const previewCandidate = useCallback((candidate: { track: YtMatchTrack; streamUrl: string }) => {
    const audio = audioRef.current;
    if (!audio) return;
    console.log(`[Match] preview: ${candidate.track.artist} - ${candidate.track.title}`);
    previewingRef.current = true;
    setPreviewingId(candidate.track.id);
    setIsPlaying(true);
    audio.src = candidate.streamUrl;
    audio.currentTime = 0;
    audio.play().catch(err => console.log(`[Match] preview play failed: ${err.message}`));
  }, []);

  const stopPreview = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    console.log(`[Match] stop preview`);
    setPreviewingId(null);
    audio.pause();
    // Keep previewingRef = true to block onended/onerror while menu is open
    previewingRef.current = true;
  }, []);

  const selectCandidate = useCallback(async (candidate: { track: YtMatchTrack; streamUrl: string }) => {
    try {
      const updated = await window.api.applyManualMatch({
        ytTrack: candidate.track,
        streamUrl: candidate.streamUrl,
      });
      console.log(`[Match] selected: ${candidate.track.artist} - ${candidate.track.title}`);
      previewingRef.current = false;
      setPreviewingId(null);
      setCurrentTrack(updated);
      currentTrackRef.current = updated;
      setMatchOpen(false);
      savedTrackIdRef.current = "";
      savedStreamUrlRef.current = "";
      playTrack(updated);
    } catch (e: any) {
      console.error("match apply error:", e.message ?? e);
    }
  }, [playTrack]);

  const closeMatchMenu = useCallback(() => {
    setMatchOpen(false);
    setPreviewingId(null);
    previewingRef.current = true;
    const audio = audioRef.current;
    if (!audio) { savedTrackIdRef.current = ""; return; }
    audio.pause();
    // Resume from saved position if same track, no selection made
    const currentId = currentTrackRef.current?.ym.id;
    if (currentId && currentId === savedTrackIdRef.current && savedStreamUrlRef.current) {
      audio.src = savedStreamUrlRef.current;
      audio.currentTime = savedTimeRef.current;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    savedTrackIdRef.current = "";
    savedStreamUrlRef.current = "";
  }, []);

  // --- Track radio (wave by track) ---

  const handleTrackRadio = useCallback(async () => {
    try {
      const track = await window.api.queueTrackRadio();
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        playTrack(track);
        const state: QueueState = await window.api.queueState();
        setCanPrev(state.canPrev);
        setCanNext(state.canNext);
      }
    } catch (e: any) {
      console.error("trackRadio error:", e.message ?? e);
    }
  }, [playTrack]);

  // --- Reset wave to default ---

  const handleResetWave = useCallback(async () => {
    try {
      const track = await window.api.queueResetWave();
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        playTrack(track);
        const state: QueueState = await window.api.queueState();
        setCanPrev(state.canPrev);
        setCanNext(state.canNext);
      }
    } catch (e: any) {
      console.error("resetWave error:", e.message ?? e);
    }
  }, [playTrack]);

  // --- Settings ---

  const openSettings = useCallback(async () => {
    setSettingsOpen(true);
    try {
      const config = await window.api.getConfig();
      setPendingSettings(config);
    } catch (e: any) {
      console.error("getConfig error:", e.message ?? e);
    }
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setPendingSettings(null);
  }, []);

  const handleSaveSettings = useCallback(async (config: ConfigData) => {
    try {
      await window.api.saveAllSettings({
        player: config.player,
        download: config.download,
      });
      closeSettings();
    } catch (e: any) {
      console.error("saveSettings error:", e.message ?? e);
    }
  }, [closeSettings]);

  const handleSettingsLogout = useCallback(async () => {
    closeSettings();
    // Delay so overlay closes first
    setTimeout(async () => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      setIsPlaying(false);
      setCurrentTrack(null);
      currentTrackRef.current = null;
      setStatus("idle");
      setUserInfo(null);
      await window.api.ymLogout();
    }, 100);
  }, [closeSettings]);

  // --- Download ---

  const handleDownload = useCallback(async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const result = await window.api.downloadTrack();
      if (result.status === "done") {
        setDownloadMsg("✅ Скачано");
      } else if (result.status === "error") {
        setDownloadMsg(`❌ ${result.message}`);
      }
      // cancelled — ничего не показываем
    } catch (e: any) {
      setDownloadMsg(`❌ ${e.message ?? "Ошибка"}`);
    }
    setDownloading(false);
    setTimeout(() => setDownloadMsg(null), 4000);
  }, [downloading]);

  // --- Search ---

  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchRef.current) clearTimeout(searchRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await window.api.search(query.trim());
        setSearchResults(results);
        setSearchOpen(results.length > 0);
      } catch (e: any) {
        console.error("search error:", e.message ?? e);
      }
      setSearching(false);
    }, 400);
  }, []);

  const handleSearchSelect = useCallback(async (index: number) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    try {
      const track = await window.api.selectSearchTrack(index);
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        playTrack(track);
      }
    } catch (e: any) {
      console.error("selectSearchTrack error:", e.message ?? e);
    }
  }, [playTrack]);

  // --- Wave settings ---

  const openWaveMenu = useCallback(async () => {
    setWaveMenuOpen(true);
    try {
      const current = await window.api.getWaveSettings();
      setWaveSettings(current);
      setPendingWaveSettings(current);
    } catch (e: any) {
      console.error("getWaveSettings error:", e.message ?? e);
    }
  }, []);

  const closeWaveMenu = useCallback(() => {
    setWaveMenuOpen(false);
  }, []);

  const handleWaveOk = useCallback(async () => {
    setWaveLoading(true);
    try {
      const track = await window.api.setWaveSettings(pendingWaveSettings);
      setWaveSettings(pendingWaveSettings);
      setWaveMenuOpen(false);
      if (track) {
        currentTrackRef.current = track;
        setCurrentTrack(track);
        playTrack(track);
        const state: QueueState = await window.api.queueState();
        setCanPrev(state.canPrev);
        setCanNext(state.canNext);
      }
    } catch (e: any) {
      console.error("setWaveSettings error:", e.message ?? e);
    }
    setWaveLoading(false);
  }, [pendingWaveSettings, playTrack]);

  // --- Derive display values ---

  const displayTitle = displayMode === "yt" && currentTrack?.yt
    ? currentTrack.yt.title
    : currentTrack?.ym.title ?? "";
  const displayArtist = displayMode === "yt" && currentTrack?.yt
    ? currentTrack.yt.artist
    : currentTrack?.ym.artist ?? "";
  const displayCover = displayMode === "yt" && currentTrack?.yt?.coverUrl
    ? currentTrack.yt.coverUrl
    : currentTrack?.ym.coverUri
      ? coverUrl(currentTrack.ym.coverUri)
      : null;

  const toggleDisplay = useCallback(() => {
    setDisplayMode(prev => prev === "ym" ? "yt" : "ym");
  }, []);

  // ================================================================
  // Render
  // ================================================================

  // --- Ping screen ---

  if (status === "pinging") {
    return (
      <div className="app">
        <header className="header">
          <h1>Zeet Player</h1>
        </header>
        <main className="login-center">
          <p className="ping-text">Connecting to services...</p>
        </main>
      </div>
    );
  }

  // --- Login / Retry screen ---

  if (status !== "loading" && status !== "playing") {
    const showRetry = !pingOk;
    return (
      <div className="app">
        <header className="header">
          <h1>Zeet Player</h1>
        </header>
        <main className="login-center">
          <div className="login-card">
            <h2>Yandex Music</h2>
            {showRetry ? (
              <>
                <p className="login-sub login-sub--error">
                  {error ?? "Services unavailable"}
                </p>
                <button className="login-btn" onClick={checkPing}>Retry</button>
              </>
            ) : (
              <>
                <p className="login-sub">Sign in with your Yandex account</p>
                <button className="login-btn" onClick={handleLogin} disabled={authing}>
                  {authing ? "Opening browser..." : "Sign in with Yandex"}
                </button>
                {error && <p className="login-error">{error}</p>}
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // --- Loading screen (after auth, before first track) ---

  if (status === "loading" || !currentTrack) {
    return (
      <div className="app">
        <header className="header">
          <h1>Zeet Player</h1>
          {userInfo && <span className="badge">{userInfo.displayName}</span>}
        </header>
        <main className="login-center">
          <p className="ping-text">Loading your radio...</p>
        </main>
      </div>
    );
  }

  // --- Player screen ---

  return (
    <div className="app">
      <header className="header">
        <button className="settings-btn" onClick={openSettings} title="Settings">⚙</button>
        <div className="search-area">
          <input
            className="search-input"
            type="text"
            placeholder="🔍 Поиск треков..."
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          />
          {searchOpen && (
            <div className="search-dropdown">
              {searching && <div className="search-loading">Поиск...</div>}
              {!searching && searchResults.map((track, i) => (
                <div className="search-item" key={i} onMouseDown={() => handleSearchSelect(i)}>
                  <img
                    className="search-item-img"
                    src={coverUrl(track.ym.coverUri, "40x40")}
                    alt=""
                  />
                  <div className="search-item-text">
                    <div className="search-item-title">{track.ym.title}</div>
                    <div className="search-item-artist">{track.ym.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="header-controls">
          <button className="wave-btn" onClick={openWaveMenu} title="Wave settings">
            ~
          </button>
          {currentTrack?.yt && (
            <button
              className={`source-toggle source-toggle--${displayMode}`}
              onClick={toggleDisplay}
            >
              {displayMode === "ym" ? "YM" : "YT"}
            </button>
          )}
          {userInfo && <span className="badge">{userInfo.displayName}</span>}
        </div>
      </header>

      <div className="radio-bar">
        <span className="radio-label">
          {radioStatus.mode === "track"
            ? `Волна по треку: ${radioStatus.trackName}`
            : radioStatus.mode === "custom"
              ? `Волна — ${radioStatus.tags.join(" — ")}`
              : "Моя волна"}
        </span>
        {radioStatus.mode !== "default" && (
          <button className="radio-reset" onClick={handleResetWave} title="Reset to default wave">✕</button>
        )}
      </div>

      <main className="main">
        <section className="now-playing">
          <div className="cover-art">
            {displayCover ? (
              <img className="cover-img" src={displayCover} alt={displayTitle} />
            ) : (
              <div className="cover-placeholder">
                <span>{displayArtist[0] ?? "?"}</span>
              </div>
            )}
          </div>

          <div className="title-row">
            <button className="match-btn" onClick={openMatchMenu} title="Выбрать YT трек">
              ≡
            </button>
            <button className="match-btn" onClick={handleTrackRadio} title="Волна по треку">
              ↻
            </button>
            <button className="match-btn" onClick={handleDownload} disabled={downloading} title="Скачать трек">
              {downloading ? "⏳" : "⬇"}
            </button>
            <div className="title-text">
              <h2 className="track-title">{displayTitle}</h2>
              <p className="track-artist">{displayArtist}</p>
            </div>
          </div>

          <div className="seek-row">
            <span className="time">{fmt(currentTime)}</span>
            <input
              type="range"
              className="seek-bar"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
            />
            <span className="time">{duration ? fmt(duration) : "--:--"}</span>
          </div>

          <div className="controls">
            <button
              className="ctrl-btn"
              onClick={doBack}
              disabled={!canPrev}
              title="Previous"
            >
              ⏮
            </button>
            <button
              className="ctrl-btn primary"
              onClick={togglePlay}
              disabled={!currentTrack.streamUrl}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              className="ctrl-btn"
              onClick={handleSkip}
              disabled={!canNext}
              title="Next"
            >
              ⏭
            </button>
          </div>

          <div className="feedback-row">
            <button
              className={`fb-btn ${feedback === "liked" ? "fb-btn--liked" : ""}`}
              onClick={handleLike}
              title={feedback === "liked" ? "Убрать лайк" : "Лайк"}
            >
              {feedback === "liked" ? "❤️" : "🤍"}
            </button>
            <button
              className={`fb-btn ${feedback === "disliked" ? "fb-btn--disliked" : ""}`}
              onClick={handleDislike}
              title={feedback === "disliked" ? "Убрать дизлайк" : "Дизлайк"}
            >
              {feedback === "disliked" ? "💔" : "🖤"}
            </button>
          </div>

          <div className="volume-row">
            <button className="vol-btn" onClick={() => adjustVolume(-0.01)} title="-1%">−</button>
            <input
              type="range"
              className="volume-bar"
              min={0}
              max={1}
              step={0.02}
              value={volume}
              onChange={handleVolume}
            />
            <button className="vol-btn" onClick={() => adjustVolume(0.01)} title="+1%">+</button>
            <span className="vol-pct">{Math.round(volume * 100)}%</span>
          </div>

          {downloadMsg && (
            <div className="download-msg">{downloadMsg}</div>
          )}
        </section>
      </main>

      {/* Match menu overlay */}
      {matchOpen && (
        matchLoading ? (
          <div className="match-overlay">
            <div className="match-panel">
              <div className="match-loading">Загрузка...</div>
            </div>
          </div>
        ) : matchResult ? (
          <MatchMenu
            result={matchResult}
            previewingId={previewingId}
            onPreview={previewCandidate}
            onStopPreview={stopPreview}
            onSelect={selectCandidate}
            onClose={closeMatchMenu}
          />
        ) : null
      )}

      {/* Wave settings overlay */}
      {waveMenuOpen && waveSettings && (
        <WaveSettingsMenu
          settings={pendingWaveSettings}
          onChange={setPendingWaveSettings}
          onCancel={closeWaveMenu}
          onOk={handleWaveOk}
          loading={waveLoading}
        />
      )}

      {/* Settings overlay */}
      {settingsOpen && pendingSettings && (
        <SettingsMenu
          config={pendingSettings}
          onSave={handleSaveSettings}
          onCancel={closeSettings}
          onLogout={handleSettingsLogout}
          onOpenFolder={() => window.api.openFolderDialog()}
        />
      )}
    </div>
  );
}
