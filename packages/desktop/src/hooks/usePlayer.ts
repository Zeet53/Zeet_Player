import { useState, useEffect, useRef, useCallback } from "react";
import type {
  TrackData, QueueState, MatchCandidatesResult, YtMatchTrack,
  WaveSettings, RadioStatus, ConfigData, FeedbackStatus,
  PhysicalMatchEntry,
} from "../types";

export function usePlayer(setStatus: (s: any) => void) {
  // ============================================================
  // State
  // ============================================================

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

  // Physical match
  const [physicalMatchOpen, setPhysicalMatchOpen] = useState(false);
  const [physicalMatchExisting, setPhysicalMatchExisting] = useState<PhysicalMatchEntry | null>(null);
  const physicalMatchActiveRef = useRef(false);
  const [isPhysicalMatch, setIsPhysicalMatch] = useState(false);
  const [physicalMatchTitle, setPhysicalMatchTitle] = useState("");
  const [physicalMatchArtist, setPhysicalMatchArtist] = useState("");
  const [physicalMatchCover, setPhysicalMatchCover] = useState<string | null>(null);

  // Wave settings
  const [waveMenuOpen, setWaveMenuOpen] = useState(false);
  const [waveSettings, setWaveSettings] = useState<WaveSettings | null>(null);
  const [pendingWaveSettings, setPendingWaveSettings] = useState<WaveSettings>({
    moodEnergy: "all", diversity: "default", language: "any",
  });
  const [waveLoading, setWaveLoading] = useState(false);
  const [radioStatus, setRadioStatus] = useState<RadioStatus>({
    mode: "default", tags: [], trackName: "",
  });

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

  // Physical match status
  const [physicalMatchMsg, setPhysicalMatchMsg] = useState<string | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<TrackData | null>(null);
  const forwardRef = useRef<((fb: { type: "skip" | "trackFinished"; time: number } | null, autoPlay?: boolean) => void) | null>(null);
  const previewingRef = useRef(false);
  const savedTimeRef = useRef(0);
  const savedTrackIdRef = useRef("");
  const savedStreamUrlRef = useRef("");
  const searchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ============================================================
  // Audio element
  // ============================================================

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => { setCurrentTime(audio.currentTime); };
    audio.onloadedmetadata = () => {
      console.log(`[Audio] loadedmetadata: duration=${audio.duration}`);
      setDuration(audio.duration);
    };
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

    return () => { audio.pause(); audio.src = ""; };
  }, []);

  // ============================================================
  // Play track
  // ============================================================

  const playTrack = useCallback(async (track: TrackData) => {
    currentTrackRef.current = track;
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    previewingRef.current = false;

    // Check for physical match first
    const physicalMatch = await window.api.physicalGetForTrack({
      artist: track.ym.artist,
      title: track.ym.title,
    });
    if (physicalMatch && physicalMatch.localFilePath) {
      console.log(`[playTrack] found physical match: ${physicalMatch.localFilePath}`);
      try {
        const fileData = await window.api.physicalReadFile(physicalMatch.localFilePath);
        if (fileData) {
          const fp = physicalMatch.localFilePath.toLowerCase();
          const mime = fp.endsWith(".flac") ? "audio/flac"
            : fp.endsWith(".wav") ? "audio/wav"
            : fp.endsWith(".ogg") ? "audio/ogg"
            : fp.endsWith(".m4a") ? "audio/mp4"
            : fp.endsWith(".aac") ? "audio/aac"
            : fp.endsWith(".wma") ? "audio/x-ms-wma"
            : "audio/mpeg";
          const blob = new Blob([fileData.audioData as BlobPart], { type: mime });
          const blobUrl = URL.createObjectURL(blob);
          const audio = audioRef.current;
          if (audio) {
            audio.src = blobUrl;
            audio.currentTime = 0;
            setIsPhysicalMatch(true);
            physicalMatchActiveRef.current = true;
            setPhysicalMatchTitle(physicalMatch.title);
            setPhysicalMatchArtist(physicalMatch.artist);
            // Load cover if available
            if (physicalMatch.coverPath) {
              try {
                const coverData = await window.api.physicalReadFile(physicalMatch.coverPath);
                if (coverData) {
                  const coverMime = physicalMatch.coverPath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
                  const coverBlob = new Blob([coverData.audioData as BlobPart], { type: coverMime });
                  setPhysicalMatchCover(URL.createObjectURL(coverBlob));
                } else {
                  setPhysicalMatchCover(null);
                }
              } catch { setPhysicalMatchCover(null); }
            } else {
              setPhysicalMatchCover(null);
            }
            audio.play().catch((err: any) => {
              console.error(`[playTrack] physical play failed: ${err.message}`);
              setIsPlaying(false);
            });
            console.log(`[playTrack] playing physical: ${physicalMatch.artist} - ${physicalMatch.title}`);
            return;
          }
        }
      } catch (e: any) {
        console.error(`[playTrack] physical match error: ${e.message}, falling back to stream`);
      }
    }

    // Reset physical match flag for normal playback
    setIsPhysicalMatch(false);
    physicalMatchActiveRef.current = false;
    setPhysicalMatchCover(null);

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

  // ============================================================
  // Init
  // ============================================================

  const initQueueAndPlay = useCallback(async (retries = 3) => {
    setStatus("loading");
    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`[App] calling queueInit (попытка ${attempt}/${retries})...`);
      try {
        const track = await window.api.queueInit();
        console.log(`[App] queueInit returned: ${track ? `"${track.ym.artist} - ${track.ym.title}" state=${track.state} hasStream=${!!track.streamUrl} hasYT=${!!track.yt}` : "null"}`);

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
          return;
        }

        if (attempt < retries) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`[App] Нет треков (${attempt}/${retries}), жду ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          setStatus("idle");
          return { error: "No tracks available" as const };
        }
      } catch (e: any) {
        if (attempt < retries) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`[App] Инициализация не удалась (${attempt}/${retries}): ${e.message ?? e}, жду ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else {
          setStatus("idle");
          return { error: e.message ?? "Init failed" as const };
        }
      }
    }
  }, [playTrack, setStatus]);

  // ============================================================
  // Forward / Back
  // ============================================================

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

  // ============================================================
  // Play / pause
  // ============================================================

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) { console.log("[togglePlay] no audio element"); return; }
    console.log(`[togglePlay] paused=${audio.paused}, readyState=${audio.readyState}`);
    if (audio.paused) {
      audio.play()
        .then(() => { console.log("[togglePlay] play OK"); setIsPlaying(true); })
        .catch((err) => {
          console.log(`[togglePlay] play rejected: ${err.message}`);
          setIsPlaying(false);
        });
    } else {
      audio.pause();
      setIsPlaying(false);
      console.log("[togglePlay] paused by user");
    }
  }, []);

  // ============================================================
  // Seek
  // ============================================================

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  // ============================================================
  // Volume
  // ============================================================

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

  // ============================================================
  // Like / Dislike
  // ============================================================

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

  // ============================================================
  // Skip
  // ============================================================

  const handleSkip = useCallback(() => {
    const audio = audioRef.current;
    const time = audio ? audio.currentTime : 0;
    console.log(`[handleSkip] skip at time=${time}`);
    doForward({ type: "skip", time });
  }, [doForward]);

  // ============================================================
  // Auto-update queue state
  // ============================================================

  useEffect(() => {
    if (!currentTrack) return;
    window.api.queueState().then((state: QueueState) => {
      setCanPrev(state.canPrev);
      setCanNext(state.canNext);
    }).catch(() => {});
    window.api.queueRadioStatus().then(setRadioStatus).catch(() => {});
  }, [currentTrack]);

  // ============================================================
  // Match menu
  // ============================================================

  const openMatchMenu = useCallback(async () => {
    if (!currentTrack) return;
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
    console.log("[Match] stop preview");
    setPreviewingId(null);
    audio.pause();
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

      // If there's a physical match for this track, remove it so YT takes over
      const pmKey = `${updated.ym.artist}:${updated.ym.title}`;
      const existing = await window.api.physicalGetForTrack({
        artist: updated.ym.artist,
        title: updated.ym.title,
      });
      if (existing) {
        await window.api.physicalDelete(pmKey);
        console.log(`[Match] removed physical match for "${pmKey}" (YT selected)`);
      }
      setIsPhysicalMatch(false);
      physicalMatchActiveRef.current = false;
      setPhysicalMatchCover(null);

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
    const currentId = currentTrackRef.current?.ym.id;
    if (currentId && currentId === savedTrackIdRef.current && savedStreamUrlRef.current) {
      audio.src = savedStreamUrlRef.current;
      audio.currentTime = savedTimeRef.current;
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
    savedTrackIdRef.current = "";
    savedStreamUrlRef.current = "";
  }, []);

  // ============================================================
  // Physical match
  // ============================================================

  const openPhysicalMatch = useCallback(async () => {
    if (!currentTrack) return;
    // Check if this track already has a physical match
    const key = `${currentTrack.ym.artist}:${currentTrack.ym.title}`;
    try {
      const existing = await window.api.physicalGetForTrack({
        artist: currentTrack.ym.artist,
        title: currentTrack.ym.title,
      });
      setPhysicalMatchExisting(existing);
    } catch {
      setPhysicalMatchExisting(null);
    }
    setMatchOpen(false);
    setPhysicalMatchOpen(true);
  }, [currentTrack]);

  const closePhysicalMatch = useCallback(() => {
    setPhysicalMatchOpen(false);
    setPhysicalMatchExisting(null);
  }, []);

  const savePhysicalMatch = useCallback(async (data: {
    audioPath: string;
    title: string;
    artist: string;
    coverPath?: string;
  }) => {
    if (!currentTrack) return;
    // Key by ORIGINAL YM artist:title so it always matches on reload
    const key = `${currentTrack.ym.artist}:${currentTrack.ym.title}`;
    try {
      setPhysicalMatchMsg("⏳ Сохранение...");
      const result = await window.api.physicalSave({
        key,
        audioPath: data.audioPath,
        title: data.title,
        artist: data.artist,
        coverPath: data.coverPath,
      });
      console.log(`[Physical] saved match: ${result.key}, size: ${result.audioData.byteLength} bytes`);

      // Detect MIME type from the saved file path
      const fp = result.entry.localFilePath.toLowerCase();
      const mimeType = fp.endsWith(".flac") ? "audio/flac"
        : fp.endsWith(".wav") ? "audio/wav"
        : fp.endsWith(".ogg") ? "audio/ogg"
        : fp.endsWith(".m4a") ? "audio/mp4"
        : fp.endsWith(".aac") ? "audio/aac"
        : fp.endsWith(".wma") ? "audio/x-ms-wma"
        : "audio/mpeg";
      const buf = result.audioData.buffer.slice(result.audioData.byteOffset, result.audioData.byteOffset + result.audioData.byteLength);
      const blob = new Blob([buf as ArrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = blobUrl;
        audio.currentTime = 0;
        setIsPhysicalMatch(true);
        physicalMatchActiveRef.current = true;
        setIsPlaying(true);
        setPhysicalMatchMsg("✅ Локальный файл");
        audio.play().catch((err: any) => {
          console.error(`[Physical] play failed: ${err.message}`);
          setPhysicalMatchMsg("❌ Ошибка воспроизведения");
          setIsPlaying(false);
        });
      }
      // Store display info for the physical match
      setPhysicalMatchTitle(data.title);
      setPhysicalMatchArtist(data.artist);
      // Set cover: uploaded file → blob URL, or null for default YM cover
      if (result.entry.coverPath) {
        const coverData = await window.api.physicalReadFile(result.entry.coverPath);
        if (coverData) {
          const coverMime = result.entry.coverPath!.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const coverBlob = new Blob([coverData.audioData as BlobPart], { type: coverMime });
          const coverBlobUrl = URL.createObjectURL(coverBlob);
          setPhysicalMatchCover(coverBlobUrl);
        } else {
          setPhysicalMatchCover(null);
        }
      } else {
        setPhysicalMatchCover(null);
      }
      // Save as existing for next dialog open
      setPhysicalMatchExisting(result.entry);
      // Update display — the Audio will handle duration/time normally
      console.log(`[Physical] now playing local: ${data.artist} - ${data.title}`);
      setTimeout(() => setPhysicalMatchMsg(null), 4000);
    } catch (e: any) {
      console.error("[Physical] save error:", e.message ?? e);
      setPhysicalMatchMsg(`❌ ${e.message ?? "Ошибка сохранения"}`);
      setTimeout(() => setPhysicalMatchMsg(null), 4000);
    }
  }, [currentTrack]);

  // ============================================================
  // Track radio / Wave
  // ============================================================

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

  // ============================================================
  // Settings
  // ============================================================

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
    setTimeout(async () => {
      const audio = audioRef.current;
      if (audio) { audio.pause(); audio.src = ""; }
      setIsPlaying(false);
      setCurrentTrack(null);
      currentTrackRef.current = null;
      setStatus("idle");
      await window.api.ymLogout();
    }, 100);
  }, [closeSettings, setStatus]);

  // ============================================================
  // Download
  // ============================================================

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
    } catch (e: any) {
      setDownloadMsg(`❌ ${e.message ?? "Ошибка"}`);
    }
    setDownloading(false);
    setTimeout(() => setDownloadMsg(null), 4000);
  }, [downloading]);

  // ============================================================
  // Search
  // ============================================================

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

  // ============================================================
  // Wave settings menu
  // ============================================================

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

  // ============================================================
  // Display mode
  // ============================================================

  const displayTitle = displayMode === "yt" && isPhysicalMatch && physicalMatchTitle
    ? physicalMatchTitle
    : displayMode === "yt" && currentTrack?.yt
      ? currentTrack.yt.title
      : (currentTrack?.ym.title || "");
  const displayArtist = displayMode === "yt" && isPhysicalMatch && physicalMatchArtist
    ? physicalMatchArtist
    : displayMode === "yt" && currentTrack?.yt
      ? currentTrack.yt.artist
      : (currentTrack?.ym.artist || "");
  const displayCover = displayMode === "yt" && isPhysicalMatch && physicalMatchCover
    ? physicalMatchCover
    : displayMode === "yt" && currentTrack?.yt?.coverUrl
      ? currentTrack.yt.coverUrl
      : null;

  const toggleDisplay = useCallback(() => {
    setDisplayMode(prev => prev === "ym" ? "yt" : "ym");
  }, []);

  return {
    // State
    currentTrack, isPlaying, currentTime, duration,
    canPrev, canNext, displayMode,
    volume, feedback,
    radioStatus,
    downloading, downloadMsg, physicalMatchMsg,
    searchQuery, searchResults, searching, searchOpen,
    matchOpen, matchResult, matchLoading, previewingId,
    physicalMatchOpen, physicalMatchExisting, isPhysicalMatch,
    waveMenuOpen, waveSettings, pendingWaveSettings, waveLoading,
    settingsOpen, pendingSettings,
    // Derived
    displayTitle, displayArtist, displayCover,
    // Refs
    audioRef, volumeRef, currentTrackRef,
    // Exposed setters (for presentational components)
    setSearchOpen,
    setPendingWaveSettings,
    // Actions
    playTrack, initQueueAndPlay,
    doForward, doBack,
    togglePlay, handleSeek,
    handleVolume, adjustVolume,
    handleLike, handleDislike, handleSkip,
    openMatchMenu, previewCandidate, stopPreview, selectCandidate, closeMatchMenu,
    openPhysicalMatch, closePhysicalMatch, savePhysicalMatch,
    handleTrackRadio, handleResetWave,
    openSettings, closeSettings, handleSaveSettings, handleSettingsLogout,
    handleDownload,
    handleSearchInput, handleSearchSelect,
    openWaveMenu, closeWaveMenu, handleWaveOk,
    toggleDisplay,
  };
}
