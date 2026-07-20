import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { LyricPayload, TrackDetail, TrackListItem } from "../../shared/types";
import {
  hasLyricTranslations,
  lyricSourceBadge,
  splitLyricDisplayParts
} from "../lyrics-display";
import type { StreamerVars } from "../streamer";
import { calculateVirtualWindow, type VirtualWindow } from "../virtual-list";
import {
  availabilityDescription,
  formatBitDepthCompact,
  formatDuration,
  formatNumber,
  formatSampleRateCompact
} from "../utils";
import type { ActivePanelTab } from "./ui-types";
import { DiscIcon, LyricsIcon, MusicNoteIcon, QueueIcon } from "./icons";
import { EmptyState } from "./EmptyState";

interface ExpandedPlayerProps {
  activeTab: ActivePanelTab;
  selectedTrackId: string | null;
  queueTracks: TrackListItem[];
  queueStartIndex: number;
  trackDetail: TrackDetail | null;
  lyrics: LyricPayload;
  activeLyricLine: number;
  streamerVars: StreamerVars;
  isPlaying: boolean;
  onSelectTrack: (trackId: string) => void;
  onTabChange: (tab: ActivePanelTab) => void;
  setLyricRef: (index: number, element: HTMLDivElement | null) => void;
  setLyricsScrollRef: (element: HTMLDivElement | null) => void;
}

const TABS: Array<{ id: ActivePanelTab; label: string }> = [
  { id: "lyrics", label: "Lyrics" },
  { id: "queue", label: "Up Next" },
  { id: "details", label: "Details" }
];

const QUEUE_ROW_HEIGHT = 80;
const QUEUE_OVERSCAN = 8;

export const ExpandedPlayer = memo(function ExpandedPlayer({
  activeTab,
  selectedTrackId,
  queueTracks,
  queueStartIndex,
  trackDetail,
  lyrics,
  activeLyricLine,
  streamerVars,
  isPlaying,
  onSelectTrack,
  onTabChange,
  setLyricRef,
  setLyricsScrollRef
}: ExpandedPlayerProps) {
  const queueScrollRef = useRef<HTMLDivElement | null>(null);
  const queueBaseIndex = queueStartIndex >= 0 ? queueStartIndex : -1;
  const queueCount = queueBaseIndex >= 0 ? Math.max(0, queueTracks.length - queueBaseIndex) : 0;
  const [showLyricTranslations, setShowLyricTranslations] = useState(true);
  const [queueWindow, setQueueWindow] = useState<VirtualWindow>(() =>
    calculateVirtualWindow({
      itemCount: queueCount,
      itemHeight: QUEUE_ROW_HEIGHT,
      scrollOffset: 0,
      viewportHeight: QUEUE_ROW_HEIGHT * 10,
      overscan: QUEUE_OVERSCAN
    })
  );

  useEffect(() => {
    if (activeTab !== "queue") {
      return;
    }

    const scrollElement = queueScrollRef.current;
    if (!scrollElement) {
      return;
    }

    const measure = () => {
      const nextWindow = calculateVirtualWindow({
        itemCount: queueCount,
        itemHeight: QUEUE_ROW_HEIGHT,
        scrollOffset: scrollElement.scrollTop,
        viewportHeight: scrollElement.clientHeight,
        overscan: QUEUE_OVERSCAN
      });

      setQueueWindow((current) => (
        current.startIndex === nextWindow.startIndex &&
        current.endIndex === nextWindow.endIndex &&
        current.paddingTop === nextWindow.paddingTop &&
        current.paddingBottom === nextWindow.paddingBottom
      ) ? current : nextWindow);
    };

    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    scrollElement.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);

    const ResizeObserverCtor = window.ResizeObserver;
    const resizeObserver = ResizeObserverCtor
      ? new ResizeObserverCtor(() => {
          scheduleMeasure();
        })
      : null;
    resizeObserver?.observe(scrollElement);

    return () => {
      window.cancelAnimationFrame(frame);
      scrollElement.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [activeTab, queueCount]);

  const renderedQueueRows = useMemo(() => {
    if (queueCount === 0 || queueWindow.endIndex < queueWindow.startIndex) {
      return [];
    }

    const absoluteStartIndex = queueBaseIndex + queueWindow.startIndex;
    const absoluteEndIndex = queueBaseIndex + queueWindow.endIndex + 1;
    return queueTracks.slice(absoluteStartIndex, absoluteEndIndex);
  }, [queueBaseIndex, queueCount, queueTracks, queueWindow.endIndex, queueWindow.startIndex]);

  const stageLabels = trackDetail
    ? [
        trackDetail.format,
        formatBitDepthCompact(trackDetail.bitDepth),
        formatSampleRateCompact(trackDetail.sampleRate),
        formatDuration(trackDetail.durationMs),
        availabilityDescription(trackDetail.availability)
      ].filter((value): value is string => Boolean(value))
    : [];
  const identityLabels = trackDetail
    ? [trackDetail.artist, trackDetail.album, trackDetail.year?.toString()]
        .filter((value): value is string => Boolean(value))
    : [];
  const lyricsHaveTranslations = useMemo(() => hasLyricTranslations(lyrics), [lyrics]);
  const lyricsSource = useMemo(() => lyricSourceBadge(lyrics.source), [lyrics.source]);
  const lyricDisplayParts = useMemo(
    () => lyrics.mode === "synced" ? lyrics.lines.map((line) => splitLyricDisplayParts(line.text)) : [],
    [lyrics]
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabIndex: number): void => {
    const lastTabIndex = TABS.length - 1;
    const nextTabIndex =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (tabIndex + 1) % TABS.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (tabIndex - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastTabIndex
              : null;

    if (nextTabIndex == null) {
      return;
    }

    event.preventDefault();
    const nextTab = TABS[nextTabIndex];
    onTabChange(nextTab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`expanded-tab-${nextTab.id}`)?.focus();
    });
  };

  return (
    <section
      className="expanded-player"
      aria-label="Expanded player"
      style={{
        ...streamerVars,
        "--expanded-play-state": isPlaying ? "running" : "paused"
      } as CSSProperties}
    >
      <div className="expanded-player-grid">
        <div className="expanded-stage">
          <div className={`record-deck ${isPlaying ? "is-playing" : ""}`}>
            <div className="record-shadow" aria-hidden="true" />
            <div className="record-platter">
              <div className="record-grooves" aria-hidden="true" />
              <div className="record-label">
                {trackDetail?.artworkUrl ? (
                  <img
                    key={trackDetail.artworkUrl}
                    src={trackDetail.artworkUrl}
                    alt={trackDetail.title}
                    className="expanded-stage-image"
                  />
                ) : (
                  <div className="expanded-stage-fallback">
                    <DiscIcon className="expanded-stage-glyph" />
                  </div>
                )}
                <span className="record-spindle" aria-hidden="true" />
              </div>
            </div>
            <div className="record-tonearm" aria-hidden="true">
              <svg className="tonearm-assembly" viewBox="0 0 300 190" focusable="false">
                <circle
                  className="tonearm-pivot-housing"
                  cx="28"
                  cy="28"
                  r="27"
                  fill="rgba(0, 0, 0, 0.16)"
                  stroke="rgba(255, 255, 255, 0.075)"
                  strokeWidth="1.5"
                />
                <circle
                  className="tonearm-pivot-ring"
                  cx="28"
                  cy="28"
                  r="17"
                  fill="#eef0ef"
                  stroke="rgba(255, 255, 255, 0.74)"
                  strokeWidth="2"
                />
                <circle
                  className="tonearm-pivot-cap"
                  cx="28"
                  cy="28"
                  r="7"
                  fill="#d7dbdc"
                />
                <path
                  className="tonearm-rail-shadow"
                  d="M 31 31 C 73 70, 112 111, 158 134 C 187 149, 216 145, 246 151"
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.26)"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="tonearm-rail"
                  d="M 31 31 C 73 70, 112 111, 158 134 C 187 149, 216 145, 246 151"
                  fill="none"
                  stroke="#eef0ef"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="tonearm-collar"
                  d="M 242 150 L 263 154"
                  fill="none"
                  stroke="#f5f6f3"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <g className="tonearm-head" transform="translate(258 141) rotate(6)">
                  <rect
                    width="37"
                    height="27"
                    rx="5"
                    fill="#f3f4f2"
                    stroke="rgba(255, 255, 255, 0.8)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 7 4 H 29"
                    fill="none"
                    stroke="rgba(143, 149, 152, 0.32)"
                    strokeLinecap="round"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M 7 9 H 29"
                    fill="none"
                    stroke="rgba(143, 149, 152, 0.32)"
                    strokeLinecap="round"
                    strokeWidth="1.2"
                  />
                  <path
                    className="tonearm-stylus"
                    d="M 30 23 L 35 30"
                    fill="none"
                    stroke="rgba(245, 247, 250, 0.88)"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div className="expanded-panel">
          <header className="expanded-track-header">
            <h1 title={trackDetail?.title}>{trackDetail?.title ?? "Nothing selected"}</h1>
            {identityLabels.length > 0 ? (
              <p className="expanded-track-identity">
                {identityLabels.map((label, index) => (
                  <span key={`${label}-${index}`}>{label}</span>
                ))}
              </p>
            ) : null}
            {stageLabels.length > 0 ? (
              <div className="expanded-stage-meta" aria-label="Audio file summary">
                {stageLabels.map((label, index) => (
                  <span key={`${label}-${index}`}>{label}</span>
                ))}
              </div>
            ) : null}
          </header>

          <div className="expanded-tab-row" role="tablist" aria-label="Expanded player tabs">
            {TABS.map((tab, tabIndex) => (
              <button
                key={tab.id}
                id={`expanded-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`expanded-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={`expanded-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tabIndex)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            key={activeTab}
            id={`expanded-panel-${activeTab}`}
            className="expanded-panel-body"
            role="tabpanel"
            aria-labelledby={`expanded-tab-${activeTab}`}
          >
            {activeTab === "queue" ? (
              queueCount === 0 ? (
                <EmptyState
                  compact
                  title="Queue is empty"
                  description="Select a track from the current library view to build the queue."
                  icon={<QueueIcon className="empty-state-glyph" />}
                />
              ) : (
                <div ref={queueScrollRef} className="expanded-scroll queue-list">
                  {queueWindow.paddingTop > 0 ? (
                    <div
                      aria-hidden="true"
                      className="virtual-spacer"
                      style={{ height: `${queueWindow.paddingTop}px` }}
                    />
                  ) : null}
                  {renderedQueueRows.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      className={`queue-row ${selectedTrackId === track.id ? "active" : ""}`}
                      onClick={() => onSelectTrack(track.id)}
                    >
                      <span className="queue-index">
                        {queueWindow.startIndex + index === 0 ? "Now" : queueWindow.startIndex + index}
                      </span>
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
                  {queueWindow.paddingBottom > 0 ? (
                    <div
                      aria-hidden="true"
                      className="virtual-spacer"
                      style={{ height: `${queueWindow.paddingBottom}px` }}
                    />
                  ) : null}
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
                <section
                  className="lyrics-stage"
                >
                  <div className="lyrics-stage-head">
                    <div className="lyrics-stage-toolbar">
                      {lyricsSource ? (
                        <span className="lyrics-stage-badge">{lyricsSource.toLowerCase()}</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    ref={setLyricsScrollRef}
                    className="lyrics-scroll"
                  >
                    <pre className="plain-lyrics">{lyrics.text}</pre>
                  </div>
                </section>
              ) : (
                <section
                  className="lyrics-stage"
                >
                  <div className="lyrics-stage-head">
                    <div className="lyrics-stage-toolbar">
                      {lyricsHaveTranslations ? (
                        <button
                          type="button"
                          className={`lyrics-translation-toggle ${showLyricTranslations ? "active" : ""}`}
                          onClick={() => {
                            setShowLyricTranslations((current) => !current);
                          }}
                          aria-pressed={showLyricTranslations}
                          aria-label={showLyricTranslations ? "Hide lyric translation" : "Show lyric translation"}
                          title={showLyricTranslations ? "Hide lyric translation" : "Show lyric translation"}
                        >
                          译
                        </button>
                      ) : null}
                      {lyricsSource ? (
                        <span className="lyrics-stage-badge">{lyricsSource.toLowerCase()}</span>
                      ) : null}
                    </div>
                  </div>
                  <div
                    ref={setLyricsScrollRef}
                    className="lyrics-scroll synced-lyrics"
                  >
                    {lyrics.lines.map((line, index) => (
                      <div
                        key={`${line.startMs}-${index}`}
                        ref={(element) => {
                          setLyricRef(index, element);
                        }}
                        className={`lyric-line-group ${activeLyricLine === index ? "active" : ""}`}
                      >
                        <div className="lyric-line primary">{lyricDisplayParts[index].primary}</div>
                        {showLyricTranslations
                          ? lyricDisplayParts[index].secondary.map((part, partIndex) => (
                              <div
                                key={`${line.startMs}-${index}-${partIndex}`}
                                className="lyric-line secondary"
                              >
                                {part}
                              </div>
                            ))
                          : null}
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
});
