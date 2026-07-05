import { useState, useEffect, useRef } from "react";
import type { ConfigData, PlayerConfig } from "../types";
import "./SettingsMenu.css";

interface SettingsNumFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function SettingsNumField(props: SettingsNumFieldProps) {
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

interface SettingsMenuProps {
  config: ConfigData;
  onSave: (config: ConfigData) => void;
  onCancel: () => void;
  onLogout: () => void;
  onOpenFolder: () => Promise<string | null>;
}

export default function SettingsMenu(props: SettingsMenuProps) {
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
            <SettingsNumField
              label="Max Queue Size"
              value={pending.player.maxHistoryLength}
              min={5} max={70}
              onChange={v => updatePlayer({ maxHistoryLength: v })}
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
