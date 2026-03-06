import type { LyricPayload, TrackDetail, TrackListItem } from "../../shared/types";
import {
  availabilityDescription,
  formatBitDepthCompact,
  formatDuration,
  formatNumber,
  formatSampleRateCompact,
  lyricsSourceLabel
} from "../utils";
import type { ActivePanelTab } from "./ui-types";
import { DiscIcon, LyricsIcon, MusicNoteIcon, QueueIcon } from "./icons";
import { EmptyState } from "./EmptyState";

interface ExpandedPlayerProps {
  activeTab: ActivePanelTab;
  selectedTrackId: string | null;
  queueTracks: TrackListItem[];
  trackDetail: TrackDetail | null;
  lyrics: LyricPayload;
  activeLyricLine: number;
  onSelectTrack: (trackId: string) => void;
  onTabChange: (tab: ActivePanelTab) => void;
  setLyricRef: (index: number, element: HTMLDivElement | null) => void;
}

const TABS: Array<{ id: ActivePanelTab; label: string }> = [
  { id: "queue", label: "Up Next" },
  { id: "lyrics", label: "Lyrics" },
  { id: "details", label: "Details" }
];

export function ExpandedPlayer({
  activeTab,
  selectedTrackId,
  queueTracks,
  trackDetail,
  lyrics,
  activeLyricLine,
  onSelectTrack,
  onTabChange,
  setLyricRef
}: ExpandedPlayerProps) {
  const stageLabels = trackDetail
    ? [
        trackDetail.format,
        formatBitDepthCompact(trackDetail.bitDepth),
        formatSampleRateCompact(trackDetail.sampleRate),
        formatDuration(trackDetail.durationMs),
        availabilityDescription(trackDetail.availability)
      ].filter((value): value is string => Boolean(value))
    : [];

  return (
    <section className="expanded-player">
      <div className="expanded-player-grid">
        <div className="expanded-stage">
          <div className="expanded-stage-art">
            {trackDetail?.artworkUrl ? (
              <img
                src={trackDetail.artworkUrl}
                alt={trackDetail.title}
                className="expanded-stage-image"
              />
            ) : (
              <div className="expanded-stage-fallback">
                <DiscIcon className="expanded-stage-glyph" />
              </div>
            )}
          </div>

          {stageLabels.length > 0 ? (
            <div className="expanded-stage-meta">
              {stageLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="expanded-panel">
          <div className="expanded-tab-row" role="tablist" aria-label="Expanded player tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`expanded-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="expanded-panel-body">
            {activeTab === "queue" ? (
              queueTracks.length === 0 ? (
                <EmptyState
                  compact
                  title="Queue is empty"
                  description="Select a track from the current library view to build the queue."
                  icon={<QueueIcon className="empty-state-glyph" />}
                />
              ) : (
                <div className="expanded-scroll queue-list">
                  {queueTracks.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      className={`queue-row ${selectedTrackId === track.id ? "active" : ""}`}
                      onClick={() => onSelectTrack(track.id)}
                    >
                      <span className="queue-index">{index === 0 ? "Now" : index}</span>
                      <div className="queue-artwork">
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt=""
                            className="queue-artwork-image"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="queue-artwork-fallback">
                            <DiscIcon className="queue-artwork-glyph" />
                          </div>
                        )}
                      </div>
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
                  description="Replica Player looks for adjacent LRC or TXT files before embedded lyric tags."
                  icon={<LyricsIcon className="empty-state-glyph" />}
                />
              ) : lyrics.mode === "plain" ? (
                <section className="lyrics-stage">
                  <div className="lyrics-stage-head">
                    <div className="context-meta-row">
                      <span>{lyricsSourceLabel(lyrics.source)}</span>
                    </div>
                    <strong>{trackDetail?.title ?? "Lyrics"}</strong>
                    <p>{trackDetail?.artist ?? "Local lyrics"}</p>
                  </div>
                  <div className="lyrics-scroll">
                    <pre className="plain-lyrics">{lyrics.text}</pre>
                  </div>
                </section>
              ) : (
                <section className="lyrics-stage">
                  <div className="lyrics-stage-head">
                    <div className="context-meta-row">
                      <span>{lyricsSourceLabel(lyrics.source)}</span>
                    </div>
                    <strong>{trackDetail?.title ?? "Lyrics"}</strong>
                    <p>{trackDetail?.artist ?? "Local lyrics"}</p>
                  </div>
                  <div className="lyrics-scroll synced-lyrics">
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
                </section>
              )
            ) : null}

            {activeTab === "details" ? (
              trackDetail ? (
                <div className="expanded-scroll details-panel">
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
                      <span>Availability</span>
                      <strong>{availabilityDescription(trackDetail.availability)}</strong>
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
        </div>
      </div>
    </section>
  );
}
