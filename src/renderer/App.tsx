import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";

import type {
  LibraryRoot,
  LyricPayload,
  ScanProgress,
  TrackDetail,
  TrackListItem
} from "../shared/types";

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatNumber(value: number | null, suffix: string): string {
  return value == null ? "—" : `${value.toLocaleString()} ${suffix}`;
}

function availabilityLabel(value: TrackListItem["availability"]): string {
  switch (value) {
    case "available":
      return "Ready";
    case "offline":
      return "Offline";
    case "missing":
      return "Missing";
  }
}

function playbackErrorMessage(format: string): string {
  if (format === "Ogg") {
    return "This Ogg file could not be decoded by Chromium. The container is supported, but this codec variant is not.";
  }

  return "This track could not be played.";
}

function playbackRejectionMessage(format: string, error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Playback is blocked until you press Play.";
  }

  return playbackErrorMessage(format);
}

function currentLyricIndex(lyrics: LyricPayload, positionMs: number): number {
  if (lyrics.mode !== "synced") {
    return -1;
  }

  const playbackPosition = positionMs + lyrics.offsetMs;
  let low = 0;
  let high = lyrics.lines.length - 1;
  let match = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (playbackPosition >= lyrics.lines[mid].startMs) {
      match = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return match;
}

export function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricRefs = useRef(new Map<number, HTMLDivElement | null>());
  const playbackIntentRef = useRef(false);
  const trackObjectUrlRef = useRef<string | null>(null);
  const artworkObjectUrlRef = useRef<string | null>(null);

  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [tracks, setTracks] = useState<TrackListItem[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [trackDetail, setTrackDetail] = useState<TrackDetail | null>(null);
  const [lyrics, setLyrics] = useState<LyricPayload>({ mode: "none", source: "none" });
  const [search, setSearch] = useState("");
  const [includeMissing, setIncludeMissing] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [libraryMessage, setLibraryMessage] = useState("Choose a folder to start building your library.");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeLyricLine, setActiveLyricLine] = useState(-1);
  const [artworkDisplayUrl, setArtworkDisplayUrl] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);

  function clearTrackObjectUrl(): void {
    if (trackObjectUrlRef.current) {
      URL.revokeObjectURL(trackObjectUrlRef.current);
      trackObjectUrlRef.current = null;
    }
  }

  function clearArtworkObjectUrl(): void {
    if (artworkObjectUrlRef.current) {
      URL.revokeObjectURL(artworkObjectUrlRef.current);
      artworkObjectUrlRef.current = null;
    }
  }

  async function loadObjectUrl(resourceUrl: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(resourceUrl, { signal });
    if (!response.ok) {
      throw new Error(`Resource request failed with status ${response.status}`);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  useEffect(() => {
    let ignore = false;

    async function loadRoots(): Promise<void> {
      try {
        setLibraryError(null);
        const nextRoots = await window.library.getRoots();
        if (ignore) {
          return;
        }

        startTransition(() => {
          setRoots(nextRoots);
        });
      } catch (error) {
        if (!ignore) {
          setLibraryError(error instanceof Error ? error.message : "Unable to load library roots");
        }
      }
    }

    void loadRoots();

    return () => {
      ignore = true;
    };
  }, [reloadTick]);

  useEffect(() => {
    let ignore = false;

    async function loadTracks(): Promise<void> {
      setIsLoadingLibrary(true);
      setLibraryError(null);

      try {
        const nextTracks = await window.library.queryTracks({
          search: deferredSearch,
          rootId: selectedRootId || undefined,
          includeMissing
        });

        if (ignore) {
          return;
        }

        startTransition(() => {
          setTracks(nextTracks);
          setSelectedTrackId((current) => (
            nextTracks.some((track) => track.id === current) ? current : (nextTracks[0]?.id ?? null)
          ));
        });

        if (roots.length === 0) {
          setLibraryMessage("Choose one or more music folders. Replica Player keeps them indexed between launches.");
        } else if (nextTracks.length === 0) {
          setLibraryMessage("No supported audio files were found yet. Add more folders or run a rescan.");
        } else {
          setLibraryMessage(`${nextTracks.length} tracks indexed across ${roots.length} folder${roots.length === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        if (!ignore) {
          setLibraryError(error instanceof Error ? error.message : "Unable to load library");
        }
      } finally {
        if (!ignore) {
          setIsLoadingLibrary(false);
        }
      }
    }

    void loadTracks();

    return () => {
      ignore = true;
    };
  }, [deferredSearch, includeMissing, reloadTick, roots.length, selectedRootId]);

  useEffect(() => {
    if (!selectedTrackId) {
      const audio = audioRef.current;
      playbackIntentRef.current = false;
      clearTrackObjectUrl();
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      setTrackDetail(null);
      setLyrics({ mode: "none", source: "none" });
      setPlaybackPositionMs(0);
      setDurationMs(0);
      setIsPlaying(false);
      setPlaybackError(null);
      setActiveLyricLine(-1);
      return;
    }

    const trackId = selectedTrackId;
    let ignore = false;

    async function loadTrack(): Promise<void> {
      try {
        const [nextTrackDetail, nextLyrics] = await Promise.all([
          window.library.getTrack(trackId),
          window.library.getLyrics(trackId)
        ]);

        if (ignore) {
          return;
        }

        startTransition(() => {
          setTrackDetail(nextTrackDetail);
          setLyrics(nextLyrics);
        });
      } catch (error) {
        if (!ignore) {
          setLibraryError(error instanceof Error ? error.message : "Unable to load track details");
        }
      }
    }

    void loadTrack();

    return () => {
      ignore = true;
    };
  }, [selectedTrackId]);

  useEffect(() => {
    const unsubscribe = window.library.onScanProgress((progress) => {
      setScanProgress(progress);
      if (progress.message) {
        setLibraryMessage(progress.message);
      }

      if (progress.phase === "completed") {
        setReloadTick((value) => value + 1);
      }

      if (progress.phase === "error" && progress.message) {
        setLibraryError(progress.message);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedTrackId || !audioRef.current) {
      return;
    }

    const trackId = selectedTrackId;
    const audio = audioRef.current;
    const controller = new AbortController();
    let ignore = false;

    setPlaybackError(null);
    setPlaybackPositionMs(0);

    async function loadTrackSource(): Promise<void> {
      try {
        const objectUrl = await loadObjectUrl(
          `replica-media://track/${encodeURIComponent(trackId)}`,
          controller.signal
        );

        if (ignore) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        clearTrackObjectUrl();
        trackObjectUrlRef.current = objectUrl;
        audio.src = objectUrl;
        audio.load();

        if (playbackIntentRef.current) {
          await audio.play();
        }
      } catch (error) {
        if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
          playbackIntentRef.current = false;
          setIsPlaying(false);
          setPlaybackError(playbackRejectionMessage(trackDetail?.format ?? "", error));
        }
      }
    }

    void loadTrackSource();

    return () => {
      ignore = true;
      controller.abort();
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      clearTrackObjectUrl();
    };
  }, [selectedTrackId]);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    const artworkUrl = trackDetail?.artworkUrl;

    if (!artworkUrl) {
      clearArtworkObjectUrl();
      setArtworkDisplayUrl(null);
      return () => {
        controller.abort();
      };
    }

    const resolvedArtworkUrl = artworkUrl;

    async function loadArtwork(): Promise<void> {
      try {
        const objectUrl = await loadObjectUrl(resolvedArtworkUrl, controller.signal);
        if (ignore) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        clearArtworkObjectUrl();
        artworkObjectUrlRef.current = objectUrl;
        setArtworkDisplayUrl(objectUrl);
      } catch (error) {
        if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
          clearArtworkObjectUrl();
          setArtworkDisplayUrl(null);
        }
      }
    }

    void loadArtwork();

    return () => {
      ignore = true;
      controller.abort();
      clearArtworkObjectUrl();
    };
  }, [trackDetail?.artworkUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handlePlay = () => {
      setIsPlaying(true);
      setPlaybackError(null);
    };
    const handlePause = () => setIsPlaying(false);
    const handleLoadedMetadata = () => {
      setPlaybackError(null);
      setDurationMs(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
      setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
    };
    const handleTimeUpdate = () => {
      setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
    };
    const handleEnded = () => {
      setIsPlaying(false);
      const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
      const nextTrack = tracks[currentIndex + 1];
      if (nextTrack) {
        setSelectedTrackId(nextTrack.id);
      } else {
        playbackIntentRef.current = false;
      }
    };
    const handleError = () => {
      playbackIntentRef.current = false;
      setIsPlaying(false);
      setPlaybackError(playbackErrorMessage(trackDetail?.format ?? ""));
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("seeked", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("seeked", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [selectedTrackId, trackDetail, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || lyrics.mode !== "synced") {
      setActiveLyricLine(-1);
      return;
    }

    let frame = 0;

    const syncLyricLine = () => {
      const nextIndex = currentLyricIndex(lyrics, Math.round(audio.currentTime * 1000));
      setActiveLyricLine((current) => (current === nextIndex ? current : nextIndex));
    };

    const updateLyricLine = () => {
      syncLyricLine();
      if (!audio.paused && !audio.ended) {
        frame = window.requestAnimationFrame(updateLyricLine);
      }
    };

    const start = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateLyricLine);
    };

    const stop = () => {
      window.cancelAnimationFrame(frame);
    };

    audio.addEventListener("play", start);
    audio.addEventListener("seeked", start);
    audio.addEventListener("pause", stop);
    audio.addEventListener("ended", stop);

    if (!audio.paused) {
      start();
    } else {
      syncLyricLine();
    }

    return () => {
      stop();
      audio.removeEventListener("play", start);
      audio.removeEventListener("seeked", start);
      audio.removeEventListener("pause", stop);
      audio.removeEventListener("ended", stop);
    };
  }, [lyrics, selectedTrackId]);

  useEffect(() => {
    const activeElement = lyricRefs.current.get(activeLyricLine);
    if (activeElement) {
      activeElement.scrollIntoView({
        block: "center",
        behavior: "smooth"
      });
    }
  }, [activeLyricLine]);

  useEffect(() => {
    return () => {
      clearTrackObjectUrl();
      clearArtworkObjectUrl();
    };
  }, []);

  async function handleAddRoots(): Promise<void> {
    try {
      setLibraryError(null);
      const selectedPaths = await window.library.pickRoots();
      if (selectedPaths.length === 0) {
        return;
      }

      const summary = await window.library.addRoots(selectedPaths);
      setReloadTick((value) => value + 1);

      if (summary.invalidPaths.length > 0) {
        setLibraryError(summary.invalidPaths[0].error);
      }

      if (summary.addedRoots.length > 0) {
        setLibraryMessage(`Added ${summary.addedRoots.length} folder${summary.addedRoots.length === 1 ? "" : "s"}. Scanning now.`);
        await window.library.rescan();
      } else if (summary.duplicatePaths.length > 0) {
        setLibraryMessage("Those folders are already in the library.");
      }
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Unable to add library folders");
    }
  }

  async function handleRescan(): Promise<void> {
    try {
      setLibraryError(null);
      await window.library.rescan();
      setLibraryMessage("Rescanning library…");
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Unable to rescan library");
    }
  }

  async function handleRemoveRoot(rootId: string): Promise<void> {
    try {
      setLibraryError(null);
      await window.library.removeRoot(rootId);
      if (selectedRootId === rootId) {
        setSelectedRootId("");
      }
      setReloadTick((value) => value + 1);
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Unable to remove library folder");
    }
  }

  function handleTogglePlay(): void {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!selectedTrackId && tracks.length > 0) {
      playbackIntentRef.current = true;
      setSelectedTrackId(tracks[0].id);
      return;
    }

    if (audio.paused) {
      playbackIntentRef.current = true;
      setPlaybackError(null);
      void audio.play().catch((error) => {
        playbackIntentRef.current = false;
        setPlaybackError(playbackRejectionMessage(trackDetail?.format ?? "", error));
      });
      return;
    }

    playbackIntentRef.current = false;
    audio.pause();
  }

  function handleSeek(event: React.ChangeEvent<HTMLInputElement>): void {
    const nextPosition = Number.parseInt(event.target.value, 10);
    setPlaybackPositionMs(nextPosition);
    if (audioRef.current) {
      audioRef.current.currentTime = nextPosition / 1000;
    }
  }

  function stepTrack(direction: -1 | 1): void {
    if (tracks.length === 0) {
      return;
    }

    const currentIndex = tracks.findIndex((track) => track.id === selectedTrackId);
    const targetIndex = currentIndex >= 0 ? currentIndex + direction : 0;
    const targetTrack = tracks[targetIndex];
    if (targetTrack) {
      setSelectedTrackId(targetTrack.id);
    }
  }

  return (
    <div className="app-shell">
      <audio ref={audioRef} />

      <aside className="sidebar">
        <div className="sidebar-header">
          <p className="eyebrow">Replica Player</p>
          <h1>Local library, persistent by default.</h1>
          <p className="sidebar-copy">
            Import folders once, keep metadata cached, and rescan only when your library changes.
          </p>
        </div>

        <div className="sidebar-actions">
          <button className="primary-button" onClick={() => void handleAddRoots()}>
            Add Folders
          </button>
          <button className="ghost-button" onClick={() => void handleRescan()} disabled={roots.length === 0}>
            Rescan Library
          </button>
        </div>

        <label className="search-field">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, artist, album, file name"
          />
        </label>

        <label className="toggle-row">
          <input
            type="checkbox"
            checked={includeMissing}
            onChange={(event) => setIncludeMissing(event.target.checked)}
          />
          <span>Show missing tracks</span>
        </label>

        <div className="roots-panel">
          <div className="section-heading">
            <span>Library Roots</span>
            <span>{roots.length}</span>
          </div>
          {roots.length === 0 ? (
            <div className="empty-card">No folders added yet.</div>
          ) : (
            <div className="roots-list">
              <button
                className={`root-card ${selectedRootId === "" ? "selected" : ""}`}
                onClick={() => setSelectedRootId("")}
              >
                <span>All folders</span>
                <small>{tracks.length} visible tracks</small>
              </button>
              {roots.map((root) => (
                <div
                  key={root.id}
                  className={`root-card ${selectedRootId === root.id ? "selected" : ""}`}
                >
                  <button className="root-select" onClick={() => setSelectedRootId(root.id)}>
                    <span>{root.displayName}</span>
                    <small>{root.status === "available" ? "Available" : "Offline"}</small>
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => void handleRemoveRoot(root.id)}
                    title={`Remove ${root.displayName}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="status-card">
          <div className="section-heading">
            <span>Status</span>
            <span>{scanProgress?.phase ?? "idle"}</span>
          </div>
          <p>{libraryMessage}</p>
          {scanProgress ? (
            <small>
              {scanProgress.processedFiles} processed / {scanProgress.discoveredFiles} discovered
            </small>
          ) : null}
          {libraryError ? <p className="error-text">{libraryError}</p> : null}
        </div>
      </aside>

      <main className="library-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Library</p>
            <h2>{isLoadingLibrary ? "Loading…" : `${tracks.length} Tracks`}</h2>
          </div>
          <div className="player-controls">
            <button className="transport-button" onClick={() => stepTrack(-1)} disabled={tracks.length === 0}>
              Prev
            </button>
            <button className="transport-button primary" onClick={handleTogglePlay} disabled={tracks.length === 0}>
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button className="transport-button" onClick={() => stepTrack(1)} disabled={tracks.length === 0}>
              Next
            </button>
          </div>
        </header>

        <div className="playback-strip">
          <div className="playback-meta">
            <strong>{trackDetail?.title ?? "Nothing selected"}</strong>
            <span>
              {trackDetail ? `${trackDetail.artist} • ${trackDetail.album}` : "Choose a track to begin playback"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(durationMs, trackDetail?.durationMs ?? 0, 1)}
            value={Math.min(playbackPositionMs, Math.max(durationMs, trackDetail?.durationMs ?? 0, 1))}
            onChange={handleSeek}
            disabled={!selectedTrackId}
          />
          <div className="time-row">
            <span>{formatDuration(playbackPositionMs)}</span>
            <span>{formatDuration(durationMs || trackDetail?.durationMs || 0)}</span>
          </div>
        </div>

        {playbackError ? <div className="error-banner">{playbackError}</div> : null}

        <div className="track-list">
          {tracks.length === 0 ? (
            <div className="empty-state">
              <h3>Nothing to play yet.</h3>
              <p>Add folders containing MP3, FLAC, or Ogg audio files.</p>
            </div>
          ) : (
            tracks.map((track) => (
              <button
                key={track.id}
                className={`track-row ${selectedTrackId === track.id ? "active" : ""}`}
                onClick={() => setSelectedTrackId(track.id)}
              >
                <div className="track-row-main">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>
                <div className="track-row-meta">
                  <span>{track.album}</span>
                  <small>{track.format}</small>
                </div>
                <div className="track-row-status">
                  <span>{availabilityLabel(track.availability)}</span>
                  <small>{formatDuration(track.durationMs)}</small>
                </div>
              </button>
            ))
          )}
        </div>
      </main>

      <section className="detail-panel">
        <div className="artwork-card">
          {artworkDisplayUrl ? (
            <img src={artworkDisplayUrl} alt={trackDetail?.title ?? "Artwork"} className="artwork-image" />
          ) : (
            <div className="artwork-placeholder">No Art</div>
          )}
        </div>

        <div className="metadata-card">
          <p className="eyebrow">Now Playing</p>
          <h2>{trackDetail?.title ?? "No track selected"}</h2>
          <p className="metadata-subtitle">
            {trackDetail ? `${trackDetail.artist} • ${trackDetail.album}` : "Select a track from the library."}
          </p>

          <div className="metadata-grid">
            <div>
              <span>Format</span>
              <strong>{trackDetail?.format ?? "—"}</strong>
            </div>
            <div>
              <span>Bitrate</span>
              <strong>{formatNumber(trackDetail?.bitrate ?? null, "bps")}</strong>
            </div>
            <div>
              <span>Sample Rate</span>
              <strong>{formatNumber(trackDetail?.sampleRate ?? null, "Hz")}</strong>
            </div>
            <div>
              <span>Bit Depth</span>
              <strong>{formatNumber(trackDetail?.bitDepth ?? null, "bit")}</strong>
            </div>
            <div>
              <span>Track / Disc</span>
              <strong>{trackDetail ? `${trackDetail.trackNo ?? "—"} / ${trackDetail.discNo ?? "—"}` : "—"}</strong>
            </div>
            <div>
              <span>Year</span>
              <strong>{trackDetail?.year ?? "—"}</strong>
            </div>
          </div>

          <div className="path-block">
            <span>File</span>
            <strong>{trackDetail?.fileName ?? "—"}</strong>
            <small>{trackDetail?.path ?? ""}</small>
          </div>
        </div>

        <div className="lyrics-card">
          <div className="section-heading">
            <span>Lyrics</span>
            <span>{lyrics.source}</span>
          </div>

          {lyrics.mode === "none" ? (
            <div className="empty-card">No embedded or adjacent local lyrics were found for this track.</div>
          ) : null}

          {lyrics.mode === "plain" ? (
            <pre className="plain-lyrics">{lyrics.text}</pre>
          ) : null}

          {lyrics.mode === "synced" ? (
            <div className="synced-lyrics">
              {lyrics.lines.map((line, index) => (
                <div
                  key={`${line.startMs}-${index}`}
                  ref={(element) => {
                    lyricRefs.current.set(index, element);
                  }}
                  className={`lyric-line ${index === activeLyricLine ? "active" : ""}`}
                >
                  {line.text || "…"}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
