import { useState, useEffect, useRef } from "react";
import type { PhysicalMatchEntry } from "../types";
import { coverUrl } from "../helpers";
import "./PhysicalMatchMenu.css";

interface PhysicalMatchMenuProps {
  /** YM cover URI for default display */
  ymCoverUri: string;
  /** Pre-existing match data (null = new match) */
  existingMatch: PhysicalMatchEntry | null;
  onSave: (data: {
    audioPath: string;
    title: string;
    artist: string;
    coverPath?: string;
  }) => void;
  onClose: () => void;
}

export default function PhysicalMatchMenu(props: PhysicalMatchMenuProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // File pickers
  const [audioPath, setAudioPath] = useState(props.existingMatch?.localFilePath ?? "");
  const [audioName, setAudioName] = useState(
    props.existingMatch
      ? props.existingMatch.title
      : "",
  );

  // Fields
  const [title, setTitle] = useState(props.existingMatch?.title ?? "");
  const [artist, setArtist] = useState(props.existingMatch?.artist ?? "Unknown");

  // Cover
  const [coverPath, setCoverPath] = useState(props.existingMatch?.coverPath ?? "");
  const [coverPreview, setCoverPreview] = useState<string | null>(
    props.existingMatch?.coverPath ?? null,
  );

  // Validation
  const isEditing = !!props.existingMatch;

  // Close on Escape / outside click
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

  const handlePickAudio = async () => {
    const result = await window.api.physicalPickAudio();
    if (!result) return;
    setAudioPath(result.filePath);
    setAudioName(result.fileName);
    // Auto-fill title from filename if not manually changed
    if (!title || title === audioName) {
      setTitle(result.fileName);
    }
  };

  const handlePickCover = async () => {
    const result = await window.api.physicalPickCover();
    if (!result) return;
    setCoverPath(result);
    // Create object URL for preview
    setCoverPreview(result);
  };

  const handleSave = () => {
    if (!audioPath) return;
    props.onSave({
      audioPath,
      title: title.trim() || audioName || "Unknown",
      artist: artist.trim() || "Unknown",
      coverPath: coverPath || undefined,
    });
    props.onClose();
  };

  // Determine which cover to show
  const showCover = coverPreview
    ? coverPreview.startsWith("http") || coverPreview.startsWith("blob:") || coverPreview.startsWith("file://")
      ? coverPreview
      : `file:///${coverPreview.replace(/\\/g, "/")}`
    : null;

  return (
    <div className="match-overlay">
      <div className="match-panel physical-panel" ref={overlayRef}>
        <div className="match-header">
          <h3 style={{ flex: 1, color: "#fff", fontSize: 16, margin: 0 }}>
            {isEditing ? "Редактировать файл" : "Загрузить файл"}
          </h3>
          <button className="match-close" onClick={props.onClose}>✕</button>
        </div>

        <div className="physical-body">
          {/* Audio file picker */}
          <div className="physical-field">
            <span className="physical-field-label">Аудиофайл *</span>
            <div className="physical-file-row">
              <button
                className={`physical-file-btn ${audioPath ? "physical-file-btn--picked" : ""}`}
                onClick={handlePickAudio}
              >
                {audioPath ? "✓ Выбрано" : "📁 Выбрать файл..."}
              </button>
              <span className="physical-file-name" title={audioPath}>
                {audioName || "не выбран"}
              </span>
            </div>
          </div>

          {/* Title */}
          <div className="physical-field">
            <span className="physical-field-label">Название</span>
            <input
              className="physical-input"
              type="text"
              placeholder={audioName || "Название трека"}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Artist */}
          <div className="physical-field">
            <span className="physical-field-label">Исполнитель</span>
            <input
              className="physical-input"
              type="text"
              placeholder="Unknown"
              value={artist}
              onChange={e => setArtist(e.target.value)}
            />
          </div>

          {/* Cover picker */}
          <div className="physical-field">
            <span className="physical-field-label">Обложка</span>
            <div className="physical-cover-row">
              {showCover ? (
                <img className="physical-cover-preview" src={showCover} alt="cover" />
              ) : (
                <div className="physical-cover-placeholder">
                  {artist[0] ?? "?"}
                </div>
              )}
              <div>
                <button className="physical-file-btn" onClick={handlePickCover}>
                  {coverPath ? "🔄 Сменить..." : "🖼 Выбрать обложку..."}
                </button>
                <div className="physical-cover-info">
                  {coverPath
                    ? "Выбрана своя обложка"
                    : "Будет использована обложка трека"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <div />
          <div className="settings-actions-right">
            <button className="settings-action-btn" onClick={props.onClose}>
              Cancel
            </button>
            <button
              className="settings-action-btn settings-action-btn--save"
              onClick={handleSave}
              disabled={!audioPath}
            >
              {isEditing ? "Сохранить" : "Загрузить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
