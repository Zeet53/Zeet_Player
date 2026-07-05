import type { TrackData, QueueState, MatchCandidatesResult, YtMatchTrack, WaveSettings, RadioStatus, ConfigData, FeedbackStatus, PhysicalMatchEntry } from "../types";
import MatchMenu from "./MatchMenu";
import WaveSettingsMenu from "./WaveSettingsMenu";
import SettingsMenu from "./SettingsMenu";
import PhysicalMatchMenu from "./PhysicalMatchMenu";
import { fmt, coverUrl } from "../helpers";
import "./PlayerScreen.css";

interface PlayerScreenProps {
  // Player state
  currentTrack: TrackData | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  canPrev: boolean;
  canNext: boolean;
  volume: number;
  feedback: FeedbackStatus;
  radioStatus: RadioStatus;
  downloading: boolean;
  downloadMsg: string | null;
  displayTitle: string;
  displayArtist: string;
  displayCover: string | null;
  displayMode: "ym" | "yt";
  // Match menu
  matchOpen: boolean;
  matchResult: MatchCandidatesResult | null;
  matchLoading: boolean;
  previewingId: string | null;
  // Physical match
  physicalMatchOpen: boolean;
  physicalMatchExisting: PhysicalMatchEntry | null;
  isPhysicalMatch: boolean;
  physicalMatchMsg: string | null;
  // Wave settings
  waveMenuOpen: boolean;
  waveSettings: WaveSettings | null;
  pendingWaveSettings: WaveSettings;
  waveLoading: boolean;
  // Settings
  settingsOpen: boolean;
  pendingSettings: ConfigData | null;
  // Search
  searchQuery: string;
  searchResults: TrackData[];
  searching: boolean;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  // User
  userInfo: { displayName: string } | null;
  // Actions
  onPlay: () => void;
  onBack: () => void;
  onSkip: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVolume: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAdjustVolume: (delta: number) => void;
  onLike: () => void;
  onDislike: () => void;
  onOpenMatchMenu: () => void;
  onPreviewCandidate: (c: { track: YtMatchTrack; streamUrl: string }) => void;
  onStopPreview: () => void;
  onSelectCandidate: (c: { track: YtMatchTrack; streamUrl: string }) => void;
  onCloseMatchMenu: () => void;
  onOpenPhysicalMatch: () => void;
  onClosePhysicalMatch: () => void;
  onSavePhysicalMatch: (data: { audioPath: string; title: string; artist: string; coverPath?: string }) => void;
  onTrackRadio: () => void;
  onResetWave: () => void;
  onOpenSettings: () => void;
  onSaveSettings: (config: ConfigData) => void;
  onCloseSettings: () => void;
  onSettingsLogout: () => void;
  onDownload: () => void;
  onSearchInput: (query: string) => void;
  onSearchSelect: (index: number) => void;
  onOpenWaveMenu: () => void;
  onCloseWaveMenu: () => void;
  onWaveChange: (s: WaveSettings) => void;
  onWaveOk: () => void;
  onToggleDisplay: () => void;
}

export default function PlayerScreen(props: PlayerScreenProps) {
  const {
    currentTrack, isPlaying, currentTime, duration,
    canPrev, canNext, volume, feedback, radioStatus,
    downloading, downloadMsg,
    displayTitle, displayArtist, displayCover, displayMode,
    searchQuery, searchResults, searching, searchOpen, setSearchOpen,
    matchOpen, matchResult, matchLoading, previewingId,
    physicalMatchOpen, physicalMatchExisting, isPhysicalMatch, physicalMatchMsg,
    waveMenuOpen, waveSettings, pendingWaveSettings, waveLoading,
    settingsOpen, pendingSettings,
    userInfo,
  } = props;

  return (
    <div className="app">
      <header className="header">
        <button className="settings-btn" onClick={props.onOpenSettings} title="Settings">⚙</button>
        <div className="search-area">
          <input
            className="search-input"
            type="text"
            placeholder="🔍 Поиск треков..."
            value={searchQuery}
            onChange={e => props.onSearchInput(e.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
          />
          {searchOpen && (
            <div className="search-dropdown">
              {searching && <div className="search-loading">Поиск...</div>}
              {!searching && searchResults.map((track, i) => (
                <div className="search-item" key={i} onMouseDown={() => props.onSearchSelect(i)}>
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
          <button className="wave-btn" onClick={props.onOpenWaveMenu} title="Wave settings">
            ~
          </button>
          {currentTrack?.yt && (
            <button
              className={`source-toggle source-toggle--${displayMode}`}
              onClick={props.onToggleDisplay}
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
          <button className="radio-reset" onClick={props.onResetWave} title="Reset to default wave">✕</button>
        )}
      </div>

      <main className="main">
        <section className="now-playing">
          <div className="cover-art">
            {displayCover ? (
              <img className="cover-img" src={displayCover} alt={displayTitle} />
            ) : currentTrack?.ym.coverUri ? (
              <img className="cover-img" src={coverUrl(currentTrack.ym.coverUri)} alt={displayTitle} />
            ) : (
              <div className="cover-placeholder">
                <span>{displayArtist[0] ?? "?"}</span>
              </div>
            )}
          </div>

          <div className="title-row">
            <button className="match-btn" onClick={props.onOpenMatchMenu} title="Выбрать YT трек">
              ≡
            </button>
            <button className="match-btn" onClick={props.onTrackRadio} title="Волна по треку">
              ↻
            </button>
            <button className="match-btn" onClick={props.onDownload} disabled={downloading} title="Скачать трек">
              {downloading ? "⏳" : "⬇"}
            </button>
            <div className="title-text">
              <h2 className="track-title">
                {displayTitle}
                {isPhysicalMatch && <span className="physical-badge">Local</span>}
              </h2>
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
              onChange={props.onSeek}
            />
            <span className="time">{duration ? fmt(duration) : "--:--"}</span>
          </div>

          <div className="controls">
            <button className="ctrl-btn" onClick={props.onBack} disabled={!canPrev} title="Previous">⏮</button>
            <button
              className="ctrl-btn primary"
              onClick={props.onPlay}
              disabled={!currentTrack?.streamUrl}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className="ctrl-btn" onClick={props.onSkip} disabled={!canNext} title="Next">⏭</button>
          </div>

          <div className="feedback-row">
            <button
              className={`fb-btn ${feedback === "liked" ? "fb-btn--liked" : ""}`}
              onClick={props.onLike}
              title={feedback === "liked" ? "Убрать лайк" : "Лайк"}
            >
              {feedback === "liked" ? "❤️" : "🤍"}
            </button>
            <button
              className={`fb-btn ${feedback === "disliked" ? "fb-btn--disliked" : ""}`}
              onClick={props.onDislike}
              title={feedback === "disliked" ? "Убрать дизлайк" : "Дизлайк"}
            >
              {feedback === "disliked" ? "💔" : "🖤"}
            </button>
          </div>

          <div className="volume-row">
            <button className="vol-btn" onClick={() => props.onAdjustVolume(-0.01)} title="-1%">−</button>
            <input
              type="range"
              className="volume-bar"
              min={0} max={1} step={0.02}
              value={volume}
              onChange={props.onVolume}
            />
            <button className="vol-btn" onClick={() => props.onAdjustVolume(0.01)} title="+1%">+</button>
            <span className="vol-pct">{Math.round(volume * 100)}%</span>
          </div>

          {downloadMsg && (
            <div className="download-msg">{downloadMsg}</div>
          )}
          {physicalMatchMsg && (
            <div className="download-msg">{physicalMatchMsg}</div>
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
            onPreview={props.onPreviewCandidate}
            onStopPreview={props.onStopPreview}
            onSelect={props.onSelectCandidate}
            onClose={props.onCloseMatchMenu}
            onOpenPhysical={props.onOpenPhysicalMatch}
          />
        ) : null
      )}

      {/* Physical match overlay */}
      {physicalMatchOpen && currentTrack && (
        <PhysicalMatchMenu
          ymCoverUri={currentTrack.ym.coverUri}
          existingMatch={physicalMatchExisting}
          onSave={props.onSavePhysicalMatch}
          onClose={props.onClosePhysicalMatch}
        />
      )}

      {/* Wave settings overlay */}
      {waveMenuOpen && waveSettings && (
        <WaveSettingsMenu
          settings={pendingWaveSettings}
          onChange={props.onWaveChange}
          onCancel={props.onCloseWaveMenu}
          onOk={props.onWaveOk}
          loading={waveLoading}
        />
      )}

      {/* Settings overlay */}
      {settingsOpen && pendingSettings && (
        <SettingsMenu
          config={pendingSettings}
          onSave={props.onSaveSettings}
          onCancel={props.onCloseSettings}
          onLogout={props.onSettingsLogout}
          onOpenFolder={() => window.api.openFolderDialog()}
        />
      )}
    </div>
  );
}

