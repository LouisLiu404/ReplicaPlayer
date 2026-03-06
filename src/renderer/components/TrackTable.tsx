import type { TrackListItem } from "../../shared/types";
import { availabilityLabel, formatDuration } from "../utils";
import { EmptyState } from "./EmptyState";
import { MusicNoteIcon } from "./icons";

interface TrackTableProps {
  tracks: TrackListItem[];
  selectedTrackId: string | null;
  hasRoots: boolean;
  isLoading: boolean;
  onAddRoots: () => void;
  onSelectTrack: (trackId: string) => void;
}

export function TrackTable({
  tracks,
  selectedTrackId,
  hasRoots,
  isLoading,
  onAddRoots,
  onSelectTrack
}: TrackTableProps) {
  if (tracks.length === 0) {
    if (!hasRoots) {
      return (
        <EmptyState
          title="Build your library"
          description="Add one or more local folders to populate the library surface and queue."
          actionLabel="Add Folders"
          onAction={onAddRoots}
          icon={<MusicNoteIcon className="empty-state-glyph" />}
        />
      );
    }

    return (
      <EmptyState
        title={isLoading ? "Loading library" : "Nothing matches this view"}
        description={isLoading
          ? "Scanning your current library selection."
          : "Try a different folder scope, availability filter, or search term."}
        icon={<MusicNoteIcon className="empty-state-glyph" />}
      />
    );
  }

  return (
    <section className="track-table-shell" aria-label="Track list">
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
            aria-label={`Select ${track.title} by ${track.artist}`}
          >
            <span className="track-index-cell">{index + 1}</span>

            <div className="track-primary-cell">
              <div className="track-artwork">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="track-artwork-image" />
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
}
