import { useEffect, useRef } from "react";
import type { WaveSettings } from "../types";
import "./WaveSettingsMenu.css";

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

interface WaveSettingsMenuProps {
  settings: WaveSettings;
  onChange: (s: WaveSettings) => void;
  onCancel: () => void;
  onOk: () => void;
  loading: boolean;
}

export default function WaveSettingsMenu(props: WaveSettingsMenuProps) {
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
