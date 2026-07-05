import { useState } from "react";
import { usePlayer } from "./hooks/usePlayer";
import { useAuth } from "./hooks/useAuth";
import PingScreen from "./components/PingScreen";
import LoginScreen from "./components/LoginScreen";
import LoadingScreen from "./components/LoadingScreen";
import PlayerScreen from "./components/PlayerScreen";
import "./App.css";

// Forward console.log to main process terminal
{
  const origLog = console.log.bind(console);
  console.log = (...args: any[]) => {
    origLog(...args);
    try {
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      window.api.log(msg);
    } catch {}
  };
}

export default function App() {
  const [status, setStatus] = useState<"pinging" | "idle" | "loading" | "playing">("pinging");
  const player = usePlayer(setStatus);
  const auth = useAuth(setStatus, player.initQueueAndPlay);

  // Ping screen
  if (status === "pinging") {
    return <PingScreen />;
  }

  // Login / Retry screen
  if (status !== "loading" && status !== "playing") {
    return (
      <LoginScreen
        showRetry={!auth.pingOk}
        error={auth.error}
        authing={auth.authing}
        onRetry={auth.checkPing}
        onLogin={auth.handleLogin}
      />
    );
  }

  // Loading screen (after auth, before first track)
  if (status === "loading" || !player.currentTrack) {
    return <LoadingScreen userDisplayName={auth.userInfo?.displayName} />;
  }

  // Player screen
  return (
    <PlayerScreen
      // Player state
      currentTrack={player.currentTrack}
      isPlaying={player.isPlaying}
      currentTime={player.currentTime}
      duration={player.duration}
      canPrev={player.canPrev}
      canNext={player.canNext}
      volume={player.volume}
      feedback={player.feedback}
      radioStatus={player.radioStatus}
      downloading={player.downloading}
      downloadMsg={player.downloadMsg}
      physicalMatchMsg={player.physicalMatchMsg}
      displayTitle={player.displayTitle}
      displayArtist={player.displayArtist}
      displayCover={player.displayCover}
      displayMode={player.displayMode}
      // Match menu
      matchOpen={player.matchOpen}
      matchResult={player.matchResult}
      matchLoading={player.matchLoading}
      previewingId={player.previewingId}
      // Physical match
      physicalMatchOpen={player.physicalMatchOpen}
      physicalMatchExisting={player.physicalMatchExisting}
      isPhysicalMatch={player.isPhysicalMatch}
      // Wave settings
      waveMenuOpen={player.waveMenuOpen}
      waveSettings={player.waveSettings}
      pendingWaveSettings={player.pendingWaveSettings}
      waveLoading={player.waveLoading}
      // Settings
      settingsOpen={player.settingsOpen}
      pendingSettings={player.pendingSettings}
      // Search
      searchQuery={player.searchQuery}
      searchResults={player.searchResults}
      searching={player.searching}
      searchOpen={player.searchOpen}
      // User
      userInfo={auth.userInfo}
      // Hooks
      setSearchOpen={player.setSearchOpen}
      // Actions
      onPlay={player.togglePlay}
      onBack={player.doBack}
      onSkip={player.handleSkip}
      onSeek={player.handleSeek}
      onVolume={player.handleVolume}
      onAdjustVolume={player.adjustVolume}
      onLike={player.handleLike}
      onDislike={player.handleDislike}
      onOpenMatchMenu={player.openMatchMenu}
      onPreviewCandidate={player.previewCandidate}
      onStopPreview={player.stopPreview}
      onSelectCandidate={player.selectCandidate}
      onCloseMatchMenu={player.closeMatchMenu}
      onOpenPhysicalMatch={player.openPhysicalMatch}
      onClosePhysicalMatch={player.closePhysicalMatch}
      onSavePhysicalMatch={player.savePhysicalMatch}
      onTrackRadio={player.handleTrackRadio}
      onResetWave={player.handleResetWave}
      onOpenSettings={player.openSettings}
      onSaveSettings={player.handleSaveSettings}
      onCloseSettings={player.closeSettings}
      onSettingsLogout={player.handleSettingsLogout}
      onDownload={player.handleDownload}
      onSearchInput={player.handleSearchInput}
      onSearchSelect={player.handleSearchSelect}
      onOpenWaveMenu={player.openWaveMenu}
      onCloseWaveMenu={player.closeWaveMenu}
      onWaveChange={player.setPendingWaveSettings}
      onWaveOk={player.handleWaveOk}
      onToggleDisplay={player.toggleDisplay}
    />
  );
}
