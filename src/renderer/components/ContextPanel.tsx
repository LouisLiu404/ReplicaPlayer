import type { LyricPayload, TrackDetail, TrackListItem } from "../../shared/types";
import type { ActivePanelTab } from "./ui-types";
import { formatDuration, formatNumber, lyricsSourceLabel } from "../utils";
import { EmptyState } from "./EmptyState";
import { CloseIcon, DiscIcon, InfoIcon, LyricsIcon, MusicNoteIcon, QueueIcon } from "./icons";

interface ContextPanelProps {
  isOverlay: boolean;
  isOpen: boolean;
  activeTab: ActivePanelTab;
  selectedTrackId: string | null;
  queueTracks: TrackListItem[];
  trackDetail: TrackDetail | null;
  lyrics: LyricPayload;
  activeLyricLine: number;
  onClose: () => void;
  onSelectTrack: (trackId: string) => void;
  onTabChange: (tab: ActivePanelTab) => void;
  setLyricRef: (index: number, element: HTMLDivElement | null) => void;
}

const TABS: Array<{ id: ActivePanelTab; label: string; icon: typeof QueueIcon }> = [
  { id: "queue", label: "Up Next", icon: QueueIcon },
  { id: "lyrics", label: "Lyrics", icon: LyricsIcon },
  { id: "details", label: "Details", icon: InfoIcon }
];

export function ContextPanel({
  isOverlay,
  isOpen,
  activeTab,
  selectedTrackId,
  queueTracks,
  trackDetail,
  lyrics,
  activeLyricLine,
  onClose,
  onSelectTrack,
  onTabChange,
  setLyricRef
}: ContextPanelProps) {
  return (
    <aside className={`context-panel ${isOverlay ? "overlay" : ""} ${isOpen ? "open" : ""}`}>
      <div className="context-panel-head">
        <div>
          <p className="section-kicker">Now Playing</p>
          <h2>{trackDetail?.title ?? "Nothing selected"}</h2>
          <p>{trackDetail ? `${trackDetail.artist} • ${trackDetail.album}` : "Choose a track from the library."}</p>
        </div>
        <button type="button" className="context-close-button" onClick={onClose} aria-label="Close side panel">
          <CloseIcon />
        </button>
      </div>

      <div className="context-summary-card">
        <div className="context-summary-art">
          {trackDetail?.artworkUrl ? (
            <img src={trackDetail.artworkUrl} alt={trackDetail.title} className="context-summary-image" />
          ) : (
            <div className="context-summary-fallback">
              <DiscIcon className="context-summary-glyph" />
            </div>
          )}
        </div>
        <div className="context-summary-copy">
          <strong>{trackDetail?.title ?? "Queue, lyrics, and track details live here."}</strong>
          <span>{trackDetail?.artist ?? "Replica Player keeps the library context on the right."}</span>
        </div>
      </div>

      <div className="context-tab-row" role="tablist" aria-label="Context panel">
        {TABS.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={`context-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="context-tab-icon" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="context-panel-body">
        {activeTab === "queue" ? (
          queueTracks.length === 0 ? (
            <EmptyState
              compact
              title="Queue is empty"
              description="Select a track to build the up next stack from the current filtered library view."
              icon={<QueueIcon className="empty-state-glyph" />}
            />
          ) : (
            <div className="queue-list">
              {queueTracks.map((track, index) => (
                <button
                  key={track.id}
                  type="button"
                  className={`queue-row ${selectedTrackId === track.id ? "active" : ""}`}
                  onClick={() => onSelectTrack(track.id)}
                >
                  <span className="queue-index">{index === 0 ? "Now" : index}</span>
                  <div className="queue-copy">
                    <strong title={track.title}>{track.title}</strong>
                    <span title={track.artist}>{track.artist}</span>
                  </div>
                  <span className="queue-duration">{formatDuration(track.durationMs)}</span>
                </button>
              ))}
            </div>
          )
        ) : null}

        {activeTab === "lyrics" ? (
          lyrics.mode === "none" ? (
            <EmptyState
              compact
              title="No local lyrics"
              description="Replica Player looks for adjacent LRC/TXT files and embedded lyric tags."
              icon={<LyricsIcon className="empty-state-glyph" />}
            />
          ) : lyrics.mode === "plain" ? (
            <div className="lyrics-panel">
              <div className="context-meta-row">
                <span>{lyricsSourceLabel(lyrics.source)}</span>
              </div>
              <pre className="plain-lyrics">{lyrics.text}</pre>
            </div>
          ) : (
            <div className="lyrics-panel">
              <div className="context-meta-row">
                <span>{lyricsSourceLabel(lyrics.source)}</span>
              </div>
              <div className="synced-lyrics">
                {lyrics.lines.map((line, index) => (
                  <div
                    key={`${line.startMs}-${index}`}
                    ref={(element) => {
                      setLyricRef(index, element);
                    }}
                    className={`lyric-line ${activeLyricLine === index ? "active" : ""}`}
                  >
                    {line.text || "…"}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : null}

        {activeTab === "details" ? (
          trackDetail ? (
            <div className="details-panel">
              <div className="context-meta-row">
                <span>{trackDetail.format}</span>
                <span>{formatDuration(trackDetail.durationMs)}</span>
              </div>

              <div className="detail-grid">
                <div>
                  <span>Format</span>
                  <strong>{trackDetail.format}</strong>
                </div>
                <div>
                  <span>Bitrate</span>
                  <strong>{formatNumber(trackDetail.bitrate, "bps")}</strong>
                </div>
                <div>
                  <span>Sample Rate</span>
                  <strong>{formatNumber(trackDetail.sampleRate, "Hz")}</strong>
                </div>
                <div>
                  <span>Bit Depth</span>
                  <strong>{formatNumber(trackDetail.bitDepth, "bit")}</strong>
                </div>
                <div>
                  <span>Track / Disc</span>
                  <strong>{`${trackDetail.trackNo ?? "—"} / ${trackDetail.discNo ?? "—"}`}</strong>
                </div>
                <div>
                  <span>Year</span>
                  <strong>{trackDetail.year ?? "—"}</strong>
                </div>
                <div>
                  <span>Album Artist</span>
                  <strong>{trackDetail.albumArtist || "—"}</strong>
                </div>
                <div>
                  <span>Availability</span>
                  <strong>{trackDetail.availability}</strong>
                </div>
              </div>

              <div className="detail-path-card">
                <span>File</span>
                <strong>{trackDetail.fileName}</strong>
                <small>{trackDetail.path}</small>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              title="No track details"
              description="Choose a track from the library to inspect metadata and file location."
              icon={<MusicNoteIcon className="empty-state-glyph" />}
            />
          )
        ) : null}
      </div>
    </aside>
  );
}
