import type { TrackDetail } from "../../shared/types";
import { formatDuration } from "../utils";
import { DiscIcon, MusicNoteIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon, VolumeIcon } from "./icons";

interface BottomPlayerProps {
  track: TrackDetail | null;
  isPlaying: boolean;
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
}

export function BottomPlayer({
  track,
  isPlaying,
  currentTimeMs,
  durationMs,
  volumePercent,
  canStepPrev,
  canStepNext,
  onStepPrev,
  onStepNext,
  onTogglePlay,
  onSeek,
  onVolumeChange
}: BottomPlayerProps) {
  const totalDuration = Math.max(durationMs, track?.durationMs ?? 0, 1);

  return (
    <footer className="bottom-player">
      <div className="bottom-player-current">
        <div className="bottom-player-art">
          {track?.artworkUrl ? (
            <img src={track.artworkUrl} alt={track.title} className="bottom-player-image" />
          ) : (
            <div className="bottom-player-fallback">
              <DiscIcon className="bottom-player-glyph" />
            </div>
          )}
        </div>

        <div className="bottom-player-copy">
          <strong>{track?.title ?? "Nothing selected"}</strong>
          <span>{track ? `${track.artist} • ${track.album}` : "Choose a track from the library."}</span>
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
            disabled={!track}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="transport-icon-button" onClick={onStepNext} disabled={!canStepNext}>
            <NextIcon />
          </button>
        </div>

        <div className="player-timeline">
          <span>{formatDuration(currentTimeMs)}</span>
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={Math.min(currentTimeMs, totalDuration)}
            onChange={(event) => onSeek(Number.parseInt(event.target.value, 10))}
            disabled={!track}
            aria-label="Seek"
          />
          <span>{formatDuration(track ? totalDuration : 0)}</span>
        </div>
      </div>

      <div className="bottom-player-trailing">
        <div className="volume-control">
          <VolumeIcon className="volume-icon" />
          <input
            type="range"
            min={0}
            max={100}
            value={volumePercent}
            onChange={(event) => onVolumeChange(Number.parseInt(event.target.value, 10))}
            aria-label="Volume"
          />
        </div>

        <div className="bottom-player-meta">
          <span>{track?.format ?? "Local Library"}</span>
          <strong>{track ? formatDuration(totalDuration) : "0:00"}</strong>
        </div>
      </div>
    </footer>
  );
}
