import { memo } from "react";

import type { TrackListItem } from "../../shared/types";
import { availabilityLabel, formatDuration } from "../utils";
import { EmptyState } from "./EmptyState";
import { MusicNoteIcon } from "./icons";
import type { AvailabilityFilter } from "./ui-types";

interface TrackTableProps {
  tracks: TrackListItem[];
  selectedTrackId: string | null;
  hasRoots: boolean;
  isLoading: boolean;
  showLoadingOverlay: boolean;
  activeFilter: AvailabilityFilter;
  onOpenSettings: () => void;
  onSelectTrack: (trackId: string) => void;
  onPlayTrack: (trackId: string) => void;
}

export const TrackTable = memo(function TrackTable({
  tracks,
  selectedTrackId,
  hasRoots,
  isLoading,
  showLoadingOverlay,
  activeFilter,
  onOpenSettings,
  onSelectTrack,
  onPlayTrack
}: TrackTableProps) {
  if (isLoading && tracks.length === 0) {
    return (
      <section className="loading-surface" aria-live="polite">
        <div className="loading-spinner large" aria-hidden="true" />
        <div className="loading-copy">
          <strong>Loading tracks</strong>
          <span>Fetching the selected folder playlist.</span>
        </div>
      </section>
    );
  }

  if (tracks.length === 0) {
    if (!hasRoots) {
      return (
        <EmptyState
          title="Build your library"
          description="Open Settings to add one or more tracked folders."
          actionLabel="Open Settings"
          onAction={onOpenSettings}
          icon={<MusicNoteIcon className="empty-state-glyph" />}
        />
      );
    }

    return (
      <EmptyState
        title={isLoading ? "Loading library" : "Nothing matches this view"}
        description={isLoading
          ? "Scanning your current library selection."
          : activeFilter === "missing"
            ? "No missing tracks are currently indexed in this view."
            : activeFilter === "offline"
              ? "No tracks from unavailable folders are in this view."
              : "Try a different folder scope, availability filter, or search term."}
        icon={<MusicNoteIcon className="empty-state-glyph" />}
      />
    );
  }

  return (
    <section className="track-table-shell" aria-label="Track list">
      {showLoadingOverlay ? (
        <div className="track-table-loading" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          <span>Loading tracks…</span>
        </div>
      ) : null}
      <div className="track-table-header">
        <span>#</span>
        <span>Track</span>
        <span className="desktop-column">Album</span>
        <span className="desktop-column">Format</span>
        <span>Status</span>
        <span>Time</span>
      </div>

      <div className="track-table-body">
        {tracks.map((track, index) => (
          <button
            key={track.id}
            type="button"
            className={`track-list-row ${selectedTrackId === track.id ? "active" : ""}`}
            onClick={() => onSelectTrack(track.id)}
            onDoubleClick={() => onPlayTrack(track.id)}
            aria-label={`Select ${track.title} by ${track.artist}`}
          >
            <span className="track-index-cell">{index + 1}</span>

            <div className="track-primary-cell">
              <div className="track-artwork">
                {track.artworkUrl ? (
                  <img
                    src={track.artworkUrl}
                    alt=""
                    className="track-artwork-image"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="track-artwork-fallback">
                    <MusicNoteIcon className="track-artwork-glyph" />
                  </div>
                )}
              </div>
              <div className="track-copy">
                <strong title={track.title}>{track.title}</strong>
                <span title={track.artist}>{track.artist}</span>
              </div>
            </div>

            <div className="track-secondary-cell desktop-column" title={track.album}>
              {track.album}
            </div>
            <div className="track-secondary-cell desktop-column">{track.format}</div>
            <div className="track-status-cell">
              <span className={`availability-chip ${track.availability}`}>{availabilityLabel(track.availability)}</span>
            </div>
            <div className="track-duration-cell">{formatDuration(track.durationMs)}</div>
          </button>
        ))}
      </div>
    </section>
  );
});
