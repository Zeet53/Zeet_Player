import { useEffect, useRef } from "react";
import type { MatchCandidatesResult, YtMatchTrack } from "../types";
import { coverUrl } from "../helpers";
import "./MatchMenu.css";

interface MatchMenuProps {
  result: MatchCandidatesResult;
  previewingId: string | null;
  onPreview: (candidate: { track: YtMatchTrack; streamUrl: string }) => void;
  onStopPreview: () => void;
  onSelect: (candidate: { track: YtMatchTrack; streamUrl: string }) => void;
  onClose: () => void;
  onOpenPhysical: () => void;
}

export default function MatchMenu(props: MatchMenuProps) {
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

        <div className="settings-actions">
          <button className="physical-file-btn" onClick={props.onOpenPhysical}>
            📁 Локальный файл...
          </button>
          <div />
        </div>
      </div>
    </div>
  );
}
