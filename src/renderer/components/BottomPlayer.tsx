import type { CSSProperties, PointerEvent } from "react";
import { useState } from "react";

import type { TrackDetail } from "../../shared/types";
import type { PlaybackMode } from "../playback";
import { formatDuration } from "../utils";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  DiscIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon
} from "./icons";

interface BottomPlayerProps {
  track: TrackDetail | null;
  isPlaying: boolean;
  isExpanded: boolean;
  canPlay: boolean;
  playbackMode: PlaybackMode;
  currentTimeMs: number;
  durationMs: number;
  volumePercent: number;
  canStepPrev: boolean;
  canStepNext: boolean;
  onStepPrev: () => void;
  onStepNext: () => void;
  onTogglePlay: () => void;
  onSeek: (nextPositionMs: number) => void;
  onVolumeChange: (nextVolumePercent: number) => void;
  onCyclePlaybackMode: () => void;
  onTogglePanel: () => void;
}

export function BottomPlayer({
  track,
  isPlaying,
  isExpanded,
  canPlay,
  playbackMode,
  currentTimeMs,
  durationMs,
  volumePercent,
  canStepPrev,
  canStepNext,
  onStepPrev,
  onStepNext,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onCyclePlaybackMode,
  onTogglePanel
}: BottomPlayerProps) {
  const totalDuration = Math.max(durationMs, track?.durationMs ?? 0, 1);
  const progressPercent = track ? Math.min(Math.max(currentTimeMs / totalDuration, 0), 1) : 0;
  const metaLine = track
    ? track.artist || track.album || "Unknown artist"
    : "Choose a track from the library.";
  const [progressPreview, setProgressPreview] = useState<{ timeMs: number; leftPercent: number } | null>(null);
  const modeLabel =
    playbackMode === "shuffle"
      ? "Shuffle"
      : playbackMode === "repeat-all"
        ? "Repeat current scope"
        : playbackMode === "repeat-one"
        ? "Repeat current track"
          : "Shuffle";

  function updateProgressPreview(event: PointerEvent<HTMLDivElement>): void {
    if (!track) {
      setProgressPreview(null);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width);
    const leftPercent = bounds.width > 0 ? relativeX / bounds.width : 0;

    setProgressPreview({
      timeMs: Math.round(totalDuration * leftPercent),
      leftPercent
    });
  }

  return (
    <footer
      className="bottom-player"
      style={{
        "--player-progress": `${progressPercent * 100}%`,
        "--volume-progress": `${volumePercent}%`
      } as CSSProperties}
    >
      <div
        className="bottom-player-progress-shell"
        onPointerEnter={updateProgressPreview}
        onPointerMove={updateProgressPreview}
        onPointerLeave={() => setProgressPreview(null)}
      >
        <input
          type="range"
          className="bottom-player-progress"
          min={0}
          max={totalDuration}
          value={Math.min(currentTimeMs, totalDuration)}
          onChange={(event) => onSeek(Number.parseInt(event.target.value, 10))}
          disabled={!track}
          aria-label="Seek"
        />
        {progressPreview ? (
          <div
            className="bottom-player-progress-tooltip"
            style={{ left: `${progressPreview.leftPercent * 100}%` }}
          >
            {formatDuration(progressPreview.timeMs)}
          </div>
        ) : null}
      </div>

      <div className="bottom-player-layout">
        <div className="bottom-player-current">
          <button
            type="button"
            className="bottom-player-art-button"
            onClick={onTogglePanel}
            disabled={!track}
            aria-label={isExpanded ? "Collapse expanded player" : "Expand player"}
          >
            <div className="bottom-player-art">
              {track?.artworkUrl ? (
                <img src={track.artworkUrl} alt={track.title} className="bottom-player-image" />
              ) : (
                <div className="bottom-player-fallback">
                  <DiscIcon className="bottom-player-glyph" />
                </div>
              )}
            </div>
          </button>

          <div className="bottom-player-copy">
            <strong>{track?.title ?? "Nothing selected"}</strong>
            <span>{metaLine}</span>
          </div>
        </div>

        <div className="bottom-player-center">
          <div className="transport-row">
            <button type="button" className="transport-icon-button" onClick={onStepPrev} disabled={!canStepPrev}>
              <PrevIcon />
            </button>
            <button
              type="button"
              className="transport-play-button"
              onClick={onTogglePlay}
              disabled={!track || !canPlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="transport-icon-button" onClick={onStepNext} disabled={!canStepNext}>
              <NextIcon />
            </button>
            <button
              type="button"
              className="transport-mode-button active"
              onClick={onCyclePlaybackMode}
              aria-label={modeLabel}
              title={modeLabel}
            >
              {playbackMode === "shuffle" ? <ShuffleIcon /> : <RepeatIcon />}
              {playbackMode === "repeat-one" ? <span className="transport-mode-badge">1</span> : null}
            </button>
          </div>
        </div>

        <div className="bottom-player-trailing">
          <div className="volume-control">
            <VolumeIcon className="volume-icon" />
            <input
              type="range"
              className="volume-slider"
              min={0}
              max={100}
              value={volumePercent}
              onChange={(event) => onVolumeChange(Number.parseInt(event.target.value, 10))}
              aria-label="Volume"
            />
          </div>

          <button
            type="button"
            className="panel-expand-button"
            onClick={onTogglePanel}
            disabled={!track}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse expanded player" : "Expand player"}
          >
            {isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </button>
        </div>
      </div>
    </footer>
  );
}
