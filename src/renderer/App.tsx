import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState
} from "react";

import type {
  LibraryRoot,
  LyricPayload,
  ScanProgress,
  TrackDetail,
  TrackListItem,
  TrackSortOption
} from "../shared/types";
import { BottomPlayer } from "./components/BottomPlayer";
import { ExpandedPlayer } from "./components/ExpandedPlayer";
import { LibraryHero } from "./components/LibraryHero";
import { NavigationRail } from "./components/NavigationRail";
import { ScanProgressModal } from "./components/ScanProgressModal";
import { SettingsView } from "./components/SettingsView";
import { TopBar } from "./components/TopBar";
import { TrackTable } from "./components/TrackTable";
import type { ActivePanelTab, AppView, AvailabilityFilter } from "./components/ui-types";
import { currentLyricIndex, nextLyricDelayMs } from "./lyrics-timing";
import { scrollLyricsContainer } from "./lyrics-scroll";
import {
  cyclePlaybackMode,
  PLAYBACK_MODE_STORAGE_KEY,
  readStoredPlaybackMode,
  type PlaybackMode
} from "./playback";
import {
  DEFAULT_STREAMER_VARS,
  extractStreamerVars,
  type StreamerVars
} from "./streamer";
import {
  DEFAULT_EXPANDED_TAB_STORAGE_KEY,
  readStoredDefaultExpandedTab
} from "./panel-preferences";
import {
  DEFAULT_TRACK_SORT,
  readStoredTrackSort,
  TRACK_SORT_STORAGE_KEY
} from "./sort-preferences";
import { calculatePulseLevel, smoothPulse } from "./visualizer";

type AvailabilityCounts = {
  all: number;
  available: number;
  missing: number;
  offline: number;
};

type ManualScanModalState = {
  jobId: string;
  status: "scanning" | "completed" | "error";
  processedFiles: number;
  discoveredFiles: number;
  message: string;
  files: string[];
};

const VOLUME_STORAGE_KEY = "replica-player:volume-percent";

function readStoredVolume(): number {
  try {
    const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) {
      return 100;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
      return 100;
    }

    return Math.min(Math.max(parsed, 0), 100);
  } catch {
    return 100;
  }
}

function toScanFileLabel(filePath: string): string {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] || filePath;
}

function trackQueryCacheKey(rootId: string, search: string, sort: TrackSortOption): string {
  return `${rootId}::${search.trim().toLowerCase()}::${sort}`;
}

class ResourceRequestError extends Error {
  constructor(readonly status: number) {
    super(`Resource request failed with status ${status}`);
  }
}

function playbackErrorMessage(format: string): string {
  if (format === "Ogg") {
    return "This Ogg file could not be decoded by Chromium. The container is supported, but this codec variant is not.";
  }

  return "This track could not be played.";
}

function unavailableTrackMessage(track: TrackDetail | null): string {
  if (!track) {
    return "This track could not be played.";
  }

  switch (track.availability) {
    case "missing":
      return "This file is missing from disk. Run Rescan to refresh the library.";
    case "offline":
      return "This track is in a saved folder that is currently unavailable.";
    case "available":
      return playbackErrorMessage(track.format);
  }
}

function playbackRejectionMessage(track: TrackDetail | null, error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Playback is blocked until you press Play.";
  }

  if (error instanceof ResourceRequestError && error.status === 404) {
    if (track?.availability === "offline") {
      return unavailableTrackMessage(track);
    }

    return "This file is no longer available. Run Rescan to refresh the library.";
  }

  return unavailableTrackMessage(track);
}

async function waitForAudioSourceReady(
  audio: HTMLAudioElement,
  signal: AbortSignal
): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading audio source"));
    }, 4000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", handleAbort);
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("canplay", handleReady);
      audio.removeEventListener("error", handleError);
    };

    const handleReady = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Audio source failed to load"));
    };

    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    audio.addEventListener("loadedmetadata", handleReady);
    audio.addEventListener("canplay", handleReady);
    audio.addEventListener("error", handleError);
  });
}

async function assignAudioSource(
  audio: HTMLAudioElement,
  sourceUrl: string,
  signal: AbortSignal
): Promise<void> {
  audio.src = sourceUrl;
  audio.load();
  await waitForAudioSourceReady(audio, signal);
}

function filterTracks(tracks: TrackListItem[], filter: AvailabilityFilter): TrackListItem[] {
  switch (filter) {
    case "available":
      return tracks.filter((track) => track.availability === "available");
    case "missing":
      return tracks.filter((track) => track.availability === "missing");
    case "offline":
      return tracks.filter((track) => track.availability === "offline");
    case "all":
      return tracks;
  }
}

function countAvailabilities(tracks: TrackListItem[]): AvailabilityCounts {
  return tracks.reduce<AvailabilityCounts>((counts, track) => {
    counts.all += 1;
    counts[track.availability] += 1;
    return counts;
  }, {
    all: 0,
    available: 0,
    missing: 0,
    offline: 0
  });
}

export function App() {
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const libraryViewRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricRefs = useRef(new Map<number, HTMLDivElement | null>());
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const playbackIntentRef = useRef(false);
  const trackObjectUrlRef = useRef<string | null>(null);
  const sourceLoadStateRef = useRef<"idle" | "loading" | "ready">("idle");
  const activePanelTabRef = useRef<ActivePanelTab>("details");
  const trackQueryCacheRef = useRef(new Map<string, TrackListItem[]>());
  const trackDetailCacheRef = useRef(new Map<string, TrackDetail | null>());
  const lyricsCacheRef = useRef(new Map<string, LyricPayload>());
  const streamerCacheRef = useRef(new Map<string, StreamerVars>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const pulseFrameRef = useRef<number | null>(null);
  const mainPulseRef = useRef(0);
  const footerPulseRef = useRef(0);

  const [activeView, setActiveView] = useState<AppView>("library");
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<TrackListItem[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<string>("");
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [trackDetail, setTrackDetail] = useState<TrackDetail | null>(null);
  const [lyrics, setLyrics] = useState<LyricPayload>({ mode: "none", source: "none" });
  const [search, setSearch] = useState("");
  const [trackSort, setTrackSort] = useState<TrackSortOption>(() =>
    readStoredTrackSort(window.localStorage)
  );
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [libraryMessage, setLibraryMessage] = useState("Choose a folder to start building your library.");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [hasLoadedRoots, setHasLoadedRoots] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [activeLyricLine, setActiveLyricLine] = useState(-1);
  const [defaultExpandedTab, setDefaultExpandedTab] = useState<ActivePanelTab>(() =>
    readStoredDefaultExpandedTab(window.localStorage)
  );
  const [activePanelTab, setActivePanelTab] = useState<ActivePanelTab>(() =>
    readStoredDefaultExpandedTab(window.localStorage)
  );
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() =>
    readStoredPlaybackMode(window.localStorage)
  );
  const [volumePercent, setVolumePercent] = useState<number>(() => readStoredVolume());
  const [scanModal, setScanModal] = useState<ManualScanModalState | null>(null);
  const [streamerVars, setStreamerVars] = useState<StreamerVars>(DEFAULT_STREAMER_VARS);

  const deferredSearch = useDeferredValue(search);

  activePanelTabRef.current = activePanelTab;

  function applyShellPulse(mainPulse: number, footerPulse: number): void {
    const appShell = appShellRef.current;
    if (!appShell) {
      return;
    }

    appShell.style.setProperty("--streamer-main-pulse", mainPulse.toFixed(3));
    appShell.style.setProperty("--streamer-footer-pulse", footerPulse.toFixed(3));
  }

  function clearTrackObjectUrl(): void {
    if (trackObjectUrlRef.current) {
      URL.revokeObjectURL(trackObjectUrlRef.current);
      trackObjectUrlRef.current = null;
    }
  }

  async function loadObjectUrl(resourceUrl: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(resourceUrl, { signal });
    if (!response.ok) {
      throw new ResourceRequestError(response.status);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTextInput =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const wantsSearchFocus =
        (!isTextInput && event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) ||
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");

      if (wantsSearchFocus) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === "Escape" && isPlayerExpanded) {
        setIsPlayerExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlayerExpanded]);

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
        setHasLoadedRoots(true);
      } catch (error) {
        if (!ignore) {
          setHasLoadedRoots(true);
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
      setLibraryMessage(`Loading ${selectedRootId ? "folder" : "library"}…`);

      const queryKey = trackQueryCacheKey(selectedRootId, deferredSearch, trackSort);
      const cachedTracks = trackQueryCacheRef.current.get(queryKey);
      if (cachedTracks) {
        if (!ignore) {
          startTransition(() => {
            setLibraryTracks(cachedTracks);
          });
          if (roots.length === 0) {
            setLibraryMessage("Choose one or more music folders. Replica Player keeps them indexed between launches.");
          } else if (cachedTracks.length === 0) {
            setLibraryMessage("No supported audio files were found in this view. Try another folder or a broader search.");
          } else {
            setLibraryMessage(`${cachedTracks.length} indexed tracks are in the current library scope.`);
          }
          setIsLoadingLibrary(false);
        }
        return;
      }

      try {
        const nextTracks = await window.library.queryTracks({
          search: deferredSearch,
          rootId: selectedRootId || undefined,
          includeMissing: true,
          sort: trackSort
        });

        if (ignore) {
          return;
        }

        startTransition(() => {
          setLibraryTracks(nextTracks);
        });
        trackQueryCacheRef.current.set(queryKey, nextTracks);

        if (roots.length === 0) {
          setLibraryMessage("Choose one or more music folders. Replica Player keeps them indexed between launches.");
        } else if (nextTracks.length === 0) {
          setLibraryMessage("No supported audio files were found in this view. Try another folder or a broader search.");
        } else {
          setLibraryMessage(`${nextTracks.length} indexed tracks are in the current library scope.`);
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
  }, [deferredSearch, reloadTick, roots.length, selectedRootId, trackSort]);

  useEffect(() => {
    trackQueryCacheRef.current.clear();
    trackDetailCacheRef.current.clear();
    lyricsCacheRef.current.clear();
  }, [reloadTick]);

  const availabilityCounts = countAvailabilities(libraryTracks);
  const visibleTracks = filterTracks(libraryTracks, availabilityFilter);
  const selectedTrackIndex = visibleTracks.findIndex((track) => track.id === selectedTrackId);
  const currentRoot = roots.find((root) => root.id === selectedRootId) ?? null;
  const currentRootLabel = currentRoot?.displayName ?? "All folders";
  const allFoldersTrackCount = hasLoadedRoots
    ? roots.reduce((total, root) => total + root.trackCount, 0)
    : null;

  useEffect(() => {
    if (!selectedTrackId && visibleTracks.length > 0) {
      setSelectedTrackId(visibleTracks[0].id);
    }
  }, [selectedTrackId, visibleTracks]);

  useEffect(() => {
    if (activeView === "settings") {
      setIsPlayerExpanded(false);
    }
  }, [activeView]);

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
      sourceLoadStateRef.current = "idle";
      return;
    }

    const trackId = selectedTrackId;
    let ignore = false;

    async function loadTrack(): Promise<void> {
      try {
        const hasCachedTrackDetail = trackDetailCacheRef.current.has(trackId);
        const hasCachedLyrics = lyricsCacheRef.current.has(trackId);
        if (hasCachedTrackDetail && hasCachedLyrics) {
          const cachedTrackDetail = trackDetailCacheRef.current.get(trackId) ?? null;
          const cachedLyrics = lyricsCacheRef.current.get(trackId) ?? { mode: "none", source: "none" };

          if (!cachedTrackDetail) {
            setSelectedTrackId((current) => (current === trackId ? null : current));
            return;
          }

          startTransition(() => {
            setTrackDetail(cachedTrackDetail);
            setLyrics(cachedLyrics);
          });
          return;
        }

        const [nextTrackDetail, nextLyrics] = await Promise.all([
          window.library.getTrack(trackId),
          window.library.getLyrics(trackId)
        ]);

        if (ignore) {
          return;
        }

        if (!nextTrackDetail) {
          trackDetailCacheRef.current.set(trackId, null);
          lyricsCacheRef.current.set(trackId, { mode: "none", source: "none" });
          setSelectedTrackId((current) => (current === trackId ? null : current));
          return;
        }

        trackDetailCacheRef.current.set(trackId, nextTrackDetail);
        lyricsCacheRef.current.set(trackId, nextLyrics);

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
      const isActiveScan =
        progress.phase === "queued" ||
        progress.phase === "scanning-root" ||
        progress.phase === "parsing-file";

      setScanProgress(isActiveScan ? progress : null);

      if (progress.phase === "scanning-root" && progress.currentRootPath) {
        setLibraryMessage(`Scanning ${progress.currentRootPath}`);
      }

      if (progress.phase === "completed") {
        setLibraryMessage(progress.message ?? "Library scan completed.");
        setReloadTick((value) => value + 1);
      }

      if (progress.phase === "error" && progress.message) {
        setLibraryError(progress.message);
      }

      setScanModal((current) => {
        if (!current || current.jobId !== progress.jobId) {
          return current;
        }

        const nextFiles =
          progress.currentFile && !current.files.includes(progress.currentFile)
            ? [...current.files, progress.currentFile]
            : current.files;

        if (progress.phase === "completed") {
          return {
            ...current,
            status: "completed",
            processedFiles: progress.processedFiles,
            discoveredFiles: progress.discoveredFiles,
            message: progress.message ?? "Scan completed.",
            files: nextFiles
          };
        }

        if (progress.phase === "error") {
          return {
            ...current,
            status: "error",
            processedFiles: progress.processedFiles,
            discoveredFiles: progress.discoveredFiles,
            message: progress.message ?? "Scan failed.",
            files: nextFiles
          };
        }

        return {
          ...current,
          status: "scanning",
          processedFiles: progress.processedFiles,
          discoveredFiles: progress.discoveredFiles,
          message: progress.message ?? current.message,
          files: nextFiles
        };
      });
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
      const mediaUrl = `replica-media://track/${encodeURIComponent(trackId)}`;
      sourceLoadStateRef.current = "loading";

      try {
        clearTrackObjectUrl();
        await assignAudioSource(audio, mediaUrl, controller.signal);
        if (ignore) {
          return;
        }
        sourceLoadStateRef.current = "ready";
        if (playbackIntentRef.current) {
          await audio.play();
        }
        return;
      } catch (directError) {
        if (ignore || (directError instanceof DOMException && directError.name === "AbortError")) {
          return;
        }

        try {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();

          const objectUrl = await loadObjectUrl(mediaUrl, controller.signal);
          if (ignore) {
            URL.revokeObjectURL(objectUrl);
            return;
          }

          clearTrackObjectUrl();
          trackObjectUrlRef.current = objectUrl;
          await assignAudioSource(audio, objectUrl, controller.signal);
          if (ignore) {
            return;
          }

          sourceLoadStateRef.current = "ready";
          if (playbackIntentRef.current) {
            await audio.play();
          }
        } catch (error) {
          if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
            sourceLoadStateRef.current = "idle";
            playbackIntentRef.current = false;
            setIsPlaying(false);
            if (error instanceof ResourceRequestError && error.status === 404) {
              setReloadTick((value) => value + 1);
            }
            setPlaybackError(playbackRejectionMessage(trackDetail, error));
          }
        }
      }
    }

    void loadTrackSource();

    return () => {
      ignore = true;
      controller.abort();
      sourceLoadStateRef.current = "idle";
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      clearTrackObjectUrl();
    };
  }, [selectedTrackId]);

  useEffect(() => {
    if (!trackDetail || trackDetail.availability === "available") {
      return;
    }

    const audio = audioRef.current;
    playbackIntentRef.current = false;
    clearTrackObjectUrl();
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setIsPlaying(false);
    setPlaybackError(unavailableTrackMessage(trackDetail));
  }, [trackDetail]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volumePercent / 100;
    audio.muted = volumePercent === 0;
  }, [volumePercent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volumePercent));
    } catch {
      // Ignore storage failures; runtime volume still works.
    }
  }, [volumePercent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, playbackMode);
    } catch {
      // Ignore storage failures; runtime playback mode still works.
    }
  }, [playbackMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULT_EXPANDED_TAB_STORAGE_KEY, defaultExpandedTab);
    } catch {
      // Ignore storage failures; runtime preference still works.
    }
  }, [defaultExpandedTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACK_SORT_STORAGE_KEY, trackSort);
    } catch {
      // Ignore storage failures; runtime preference still works.
    }
  }, [trackSort]);

  useEffect(() => {
    const artworkUrl = trackDetail?.artworkUrl;
    if (!artworkUrl) {
      setStreamerVars(DEFAULT_STREAMER_VARS);
      return;
    }

    const cached = streamerCacheRef.current.get(artworkUrl);
    if (cached) {
      setStreamerVars(cached);
      return;
    }

    const controller = new AbortController();
    let ignore = false;

    void extractStreamerVars(artworkUrl, controller.signal)
      .then((nextVars) => {
        if (ignore) {
          return;
        }

        streamerCacheRef.current.set(artworkUrl, nextVars);
        setStreamerVars(nextVars);
      })
      .catch(() => {
        if (!ignore) {
          setStreamerVars(DEFAULT_STREAMER_VARS);
        }
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [trackDetail?.artworkUrl]);

  useEffect(() => {
    const appShell = appShellRef.current;
    if (!appShell) {
      return;
    }

    for (const [key, value] of Object.entries(streamerVars)) {
      appShell.style.setProperty(key, value);
    }

    appShell.style.setProperty("--streamer-play-state", isPlaying ? "running" : "paused");
  }, [isPlaying, streamerVars]);

  useEffect(() => {
    const audio = audioRef.current;
    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!audio || !AudioContextCtor) {
      applyShellPulse(0, 0);
      return;
    }

    const ensureAnalyser = (): boolean => {
      if (analyserRef.current && audioContextRef.current) {
        return true;
      }

      try {
        const context = new AudioContextCtor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.82;

        const source = context.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(context.destination);

        audioContextRef.current = context;
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
        mediaSourceRef.current = source;
        return true;
      } catch {
        return false;
      }
    };

    const stopLoop = () => {
      if (pulseFrameRef.current != null) {
        window.cancelAnimationFrame(pulseFrameRef.current);
        pulseFrameRef.current = null;
      }
    };

    const tick = () => {
      pulseFrameRef.current = null;

      const analyser = analyserRef.current;
      const data = analyserDataRef.current;
      const context = audioContextRef.current;
      const isActive =
        !audio.paused &&
        !audio.ended &&
        analyser != null &&
        data != null &&
        context?.state === "running";

      let targetPulse = 0;

      if (isActive && analyser && data) {
        analyser.getByteFrequencyData(data);
        targetPulse = calculatePulseLevel(data);
      }

      mainPulseRef.current = smoothPulse(mainPulseRef.current, targetPulse, isActive);
      footerPulseRef.current = smoothPulse(
        footerPulseRef.current,
        Math.min(targetPulse * 1.18, 1),
        isActive
      );

      applyShellPulse(mainPulseRef.current, footerPulseRef.current);

      if (isActive || mainPulseRef.current > 0 || footerPulseRef.current > 0) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const startLoop = async () => {
      if (!ensureAnalyser()) {
        return;
      }

      if (audioContextRef.current?.state === "suspended") {
        try {
          await audioContextRef.current.resume();
        } catch {
          // Ignore resume failures and leave pulse idle.
        }
      }

      if (pulseFrameRef.current == null) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const decayLoop = () => {
      if (pulseFrameRef.current == null) {
        pulseFrameRef.current = window.requestAnimationFrame(tick);
      }
    };

    const handlePlay = () => {
      void startLoop();
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("playing", handlePlay);
    audio.addEventListener("pause", decayLoop);
    audio.addEventListener("ended", decayLoop);

    if (!audio.paused) {
      void startLoop();
    } else {
      applyShellPulse(0, 0);
    }

    return () => {
      stopLoop();
      applyShellPulse(0, 0);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("playing", handlePlay);
      audio.removeEventListener("pause", decayLoop);
      audio.removeEventListener("ended", decayLoop);
      audioContextRef.current?.close().catch(() => {});
      mediaSourceRef.current?.disconnect();
      analyserRef.current?.disconnect();
      mediaSourceRef.current = null;
      analyserRef.current = null;
      analyserDataRef.current = null;
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleVolumeChange = () => {
      setVolumePercent(Math.round((audio.muted ? 0 : audio.volume) * 100));
    };

    audio.addEventListener("volumechange", handleVolumeChange);
    return () => {
      audio.removeEventListener("volumechange", handleVolumeChange);
    };
  }, []);

  useEffect(() => {
    if (availabilityFilter === "missing" && availabilityCounts.missing === 0) {
      setAvailabilityFilter("all");
      return;
    }

    if (availabilityFilter === "offline" && availabilityCounts.offline === 0) {
      setAvailabilityFilter("all");
    }
  }, [availabilityCounts.missing, availabilityCounts.offline, availabilityFilter]);

  function chooseRandomTrack(excludeTrackId: string | null): TrackListItem | null {
    if (visibleTracks.length === 0) {
      return null;
    }

    if (visibleTracks.length === 1) {
      return visibleTracks[0];
    }

    const candidates = visibleTracks.filter((track) => track.id !== excludeTrackId);
    if (candidates.length === 0) {
      return visibleTracks[0];
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex] ?? candidates[0];
  }

  const handleAudioPlay = useEffectEvent(() => {
    setIsPlaying(true);
    setPlaybackError(null);
  });

  const handleAudioPause = useEffectEvent(() => {
    setIsPlaying(false);
  });

  const handleAudioLoadedMetadata = useEffectEvent(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setPlaybackError(null);
    setDurationMs(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
    setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
  });

  const handleAudioTimeUpdate = useEffectEvent(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
  });

  const handleAudioEnded = useEffectEvent(() => {
    setIsPlaying(false);
    const audio = audioRef.current;
    if (playbackMode === "repeat-one" && selectedTrackId) {
      playbackIntentRef.current = true;
      if (audio) {
        audio.currentTime = 0;
        void audio.play().catch((error) => {
          playbackIntentRef.current = false;
          setPlaybackError(playbackRejectionMessage(trackDetail, error));
        });
      }
      return;
    }

    if (playbackMode === "shuffle") {
      const nextTrack = chooseRandomTrack(selectedTrackId);
      if (nextTrack) {
        playbackIntentRef.current = true;
        setSelectedTrackId(nextTrack.id);
        return;
      }
    }

    const currentIndex = visibleTracks.findIndex((track) => track.id === selectedTrackId);
    const nextTrack = visibleTracks[currentIndex + 1];
    if (nextTrack) {
      playbackIntentRef.current = true;
      setSelectedTrackId(nextTrack.id);
      return;
    }

    if (playbackMode === "repeat-all" && visibleTracks.length > 0) {
      playbackIntentRef.current = true;
      setSelectedTrackId(visibleTracks[0].id);
      return;
    }

    playbackIntentRef.current = false;
  });

  const handleAudioError = useEffectEvent(() => {
    if (sourceLoadStateRef.current === "loading") {
      return;
    }

    playbackIntentRef.current = false;
    setIsPlaying(false);
    setPlaybackError(playbackErrorMessage(trackDetail?.format ?? ""));
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.addEventListener("play", handleAudioPlay);
    audio.addEventListener("pause", handleAudioPause);
    audio.addEventListener("loadedmetadata", handleAudioLoadedMetadata);
    audio.addEventListener("timeupdate", handleAudioTimeUpdate);
    audio.addEventListener("seeked", handleAudioTimeUpdate);
    audio.addEventListener("ended", handleAudioEnded);
    audio.addEventListener("error", handleAudioError);

    return () => {
      audio.removeEventListener("play", handleAudioPlay);
      audio.removeEventListener("pause", handleAudioPause);
      audio.removeEventListener("loadedmetadata", handleAudioLoadedMetadata);
      audio.removeEventListener("timeupdate", handleAudioTimeUpdate);
      audio.removeEventListener("seeked", handleAudioTimeUpdate);
      audio.removeEventListener("ended", handleAudioEnded);
      audio.removeEventListener("error", handleAudioError);
    };
  }, [
    handleAudioEnded,
    handleAudioError,
    handleAudioLoadedMetadata,
    handleAudioPause,
    handleAudioPlay,
    handleAudioTimeUpdate
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || lyrics.mode !== "synced") {
      setActiveLyricLine(-1);
      return;
    }

    if (!isPlayerExpanded || activePanelTab !== "lyrics") {
      setActiveLyricLine(currentLyricIndex(lyrics, Math.round(audio.currentTime * 1000)));
      return;
    }

    let timeoutId = 0;

    const syncLyricLine = () => {
      const nextIndex = currentLyricIndex(lyrics, Math.round(audio.currentTime * 1000));
      setActiveLyricLine((current) => (current === nextIndex ? current : nextIndex));
      return nextIndex;
    };

    const scheduleNext = () => {
      window.clearTimeout(timeoutId);
      const delay = nextLyricDelayMs(lyrics, Math.round(audio.currentTime * 1000));
      if (delay == null || audio.paused || audio.ended) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        syncLyricLine();
        scheduleNext();
      }, delay);
    };

    const start = () => {
      syncLyricLine();
      scheduleNext();
    };

    const stop = () => {
      window.clearTimeout(timeoutId);
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
  }, [activePanelTab, isPlayerExpanded, lyrics, selectedTrackId]);

  useEffect(() => {
    if (!isPlayerExpanded || activePanelTab !== "lyrics" || activeLyricLine < 0) {
      return;
    }

    const scrollContainer = lyricsScrollRef.current;
    const activeElement = lyricRefs.current.get(activeLyricLine);
    if (scrollContainer && activeElement) {
      scrollLyricsContainer(scrollContainer, activeElement);
    }
  }, [activeLyricLine, activePanelTab, isPlayerExpanded]);

  useEffect(() => {
    lyricRefs.current.clear();
  }, [selectedTrackId, lyrics.mode]);

  useEffect(() => {
    return () => {
      clearTrackObjectUrl();
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
        const jobId = await window.library.rescan();
        setScanModal({
          jobId,
          status: "scanning",
          processedFiles: 0,
          discoveredFiles: 0,
          message: "Scanning library…",
          files: []
        });
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
      const jobId = await window.library.rescan();
      setScanModal({
        jobId,
        status: "scanning",
        processedFiles: 0,
        discoveredFiles: 0,
        message: "Scanning library…",
        files: []
      });
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

  async function handleRemoveTrack(trackId: string): Promise<void> {
    try {
      setLibraryError(null);

      const currentIndex = visibleTracks.findIndex((track) => track.id === trackId);
      const fallbackTrackId =
        visibleTracks[currentIndex + 1]?.id ??
        visibleTracks[currentIndex - 1]?.id ??
        null;

      await window.library.removeTrack(trackId);

      setSelectedTrackId((current) => (current === trackId ? fallbackTrackId : current));
      setReloadTick((value) => value + 1);
      setLibraryMessage("Removed missing track from the library.");
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Unable to remove missing track");
    }
  }

  function handleTogglePlay(): void {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!selectedTrackId && visibleTracks.length > 0) {
      playbackIntentRef.current = true;
      setSelectedTrackId(visibleTracks[0].id);
      return;
    }

    if (trackDetail && trackDetail.availability !== "available") {
      playbackIntentRef.current = false;
      setPlaybackError(unavailableTrackMessage(trackDetail));
      return;
    }

    if (audio.paused) {
      playbackIntentRef.current = true;
      setPlaybackError(null);
      if (activePanelTabRef.current !== "lyrics") {
        setActivePanelTab("queue");
      }
      void audio.play().catch((error) => {
        playbackIntentRef.current = false;
        setPlaybackError(playbackRejectionMessage(trackDetail, error));
      });
      return;
    }

    playbackIntentRef.current = false;
    audio.pause();
  }

  function handleSeek(nextPositionMs: number): void {
    const audio = audioRef.current;
    const maxDuration = Math.max(durationMs, trackDetail?.durationMs ?? 0, 1);
    const clampedPosition = Math.min(Math.max(nextPositionMs, 0), maxDuration);
    setPlaybackPositionMs(clampedPosition);
    if (audio) {
      audio.currentTime = clampedPosition / 1000;
    }
  }

  function stepTrack(direction: -1 | 1): void {
    if (direction === -1 && playbackPositionMs >= 3000) {
      handleSeek(0);
      return;
    }

    if (visibleTracks.length === 0) {
      return;
    }

    if (playbackMode === "shuffle") {
      const randomTrack = chooseRandomTrack(selectedTrackId);
      if (randomTrack) {
        setSelectedTrackId(randomTrack.id);
      }
      return;
    }

    const currentIndex = visibleTracks.findIndex((track) => track.id === selectedTrackId);
    let targetIndex = currentIndex >= 0 ? currentIndex + direction : 0;

    if (playbackMode === "repeat-all" && visibleTracks.length > 0) {
      if (targetIndex < 0) {
        targetIndex = visibleTracks.length - 1;
      } else if (targetIndex >= visibleTracks.length) {
        targetIndex = 0;
      }
    }

    const targetTrack = visibleTracks[targetIndex];
    if (targetTrack) {
      setSelectedTrackId(targetTrack.id);
    }
  }

  const handlePanelTabChange = useCallback((tab: ActivePanelTab): void => {
    setActivePanelTab(tab);
    setIsPlayerExpanded(true);
  }, []);

  const handleSelectRoot = useCallback((rootId: string): void => {
    if (selectedRootId === rootId && activeView === "library") {
      return;
    }
    startTransition(() => {
      setIsPlayerExpanded(false);
      setSelectedRootId(rootId);
      setActiveView("library");
    });
  }, [activeView, selectedRootId]);

  const handleAvailabilityFilterChange = useCallback((filter: AvailabilityFilter): void => {
    setAvailabilityFilter((current) => (current === filter ? "all" : filter));
  }, []);

  const handleOpenSettings = useCallback((): void => {
    setActiveView("settings");
  }, []);

  const handleTogglePanel = useCallback((): void => {
    if (!isPlayerExpanded) {
      setActivePanelTab(defaultExpandedTab);
      setIsPlayerExpanded(true);
      return;
    }

    setIsPlayerExpanded(false);
  }, [defaultExpandedTab, isPlayerExpanded]);

  const handleCyclePlaybackMode = useCallback((): void => {
    setPlaybackMode((current) => cyclePlaybackMode(current));
  }, []);

  const handleVolumeChange = useCallback((nextVolumePercent: number): void => {
    const clampedVolume = Math.min(Math.max(nextVolumePercent, 0), 100);
    setVolumePercent(clampedVolume);
  }, []);

  const handleSetLyricRef = useCallback((index: number, element: HTMLDivElement | null): void => {
    lyricRefs.current.set(index, element);
  }, []);

  const handleSetLyricsScrollRef = useCallback((element: HTMLDivElement | null): void => {
    lyricsScrollRef.current = element;
  }, []);

  const handlePlayTrack = useCallback((trackId: string): void => {
    playbackIntentRef.current = true;
    setPlaybackError(null);

    if (selectedTrackId !== trackId) {
      setSelectedTrackId(trackId);
      return;
    }

    if (trackDetail && trackDetail.availability !== "available") {
      playbackIntentRef.current = false;
      setPlaybackError(unavailableTrackMessage(trackDetail));
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    void audio.play().catch((error) => {
      playbackIntentRef.current = false;
      setPlaybackError(playbackRejectionMessage(trackDetail, error));
    });
  }, [selectedTrackId, trackDetail]);

  const handleDefaultExpandedTabChange = useCallback((tab: ActivePanelTab): void => {
    setDefaultExpandedTab(tab);
    if (!isPlayerExpanded) {
      setActivePanelTab(tab);
    }
  }, [isPlayerExpanded]);

  const handleTrackSortChange = useCallback((sort: TrackSortOption): void => {
    setTrackSort(sort);
  }, []);

  const canPlaySelectedTrack = trackDetail?.availability === "available";
  const isSettingsView = activeView === "settings" && !isPlayerExpanded;
  const selectedMissingTrack = trackDetail?.availability === "missing"
    ? trackDetail
    : availabilityFilter === "missing"
      ? visibleTracks.find((track) => track.availability === "missing") ?? null
      : null;

  return (
    <div ref={appShellRef} className="app-shell">
      <audio ref={audioRef} />
      <ScanProgressModal
        scan={scanModal}
        onClose={() => setScanModal(null)}
        toFileLabel={toScanFileLabel}
      />

      <div className={`app-workspace ${isPlayerExpanded ? "expanded" : ""}`}>
        <NavigationRail
          activeView={activeView}
          roots={roots}
          selectedRootId={selectedRootId}
          allFoldersTrackCount={allFoldersTrackCount}
          onSelectRoot={handleSelectRoot}
          onOpenSettings={handleOpenSettings}
        />

        <div className={`app-main ${isPlayerExpanded ? "expanded" : ""} ${isSettingsView ? "settings" : ""}`}>
          {!isSettingsView ? (
            <TopBar
              search={search}
              searchInputRef={searchInputRef}
              scanProgress={scanProgress}
              onSearchChange={setSearch}
            />
          ) : null}

          <main
            ref={(element) => {
              if (!isPlayerExpanded && !isSettingsView) {
                libraryViewRef.current = element;
              } else if (libraryViewRef.current === element) {
                libraryViewRef.current = null;
              }
            }}
            className={isPlayerExpanded ? "expanded-player-view" : isSettingsView ? "settings-main" : "library-view"}
          >
            {libraryError ? <div className="error-banner">{libraryError}</div> : null}
            {playbackError ? <div className="error-banner">{playbackError}</div> : null}
            {!isPlayerExpanded && !isSettingsView && selectedMissingTrack ? (
              <div className="action-banner">
                <div>
                  <strong>{selectedMissingTrack.title} is missing from disk.</strong>
                  <span>Remove it from the library if you no longer want to track it.</span>
                </div>
                <button
                  type="button"
                  className="cta-button secondary"
                  onClick={() => void handleRemoveTrack(selectedMissingTrack.id)}
                >
                  Remove Track
                </button>
              </div>
            ) : null}

            {isPlayerExpanded ? (
              <ExpandedPlayer
                activeTab={activePanelTab}
                selectedTrackId={selectedTrackId}
                queueTracks={visibleTracks}
                queueStartIndex={selectedTrackIndex}
                trackDetail={trackDetail}
                lyrics={lyrics}
                activeLyricLine={activeLyricLine}
                streamerVars={streamerVars}
                isPlaying={isPlaying}
                onSelectTrack={setSelectedTrackId}
                onTabChange={handlePanelTabChange}
                setLyricRef={handleSetLyricRef}
                setLyricsScrollRef={handleSetLyricsScrollRef}
              />
            ) : isSettingsView ? (
              <SettingsView
                roots={roots}
                scanProgress={scanProgress}
                defaultExpandedTab={defaultExpandedTab}
                trackSort={trackSort}
                onAddRoots={() => void handleAddRoots()}
                onRescan={() => void handleRescan()}
                onRemoveRoot={(rootId) => void handleRemoveRoot(rootId)}
                onDefaultExpandedTabChange={handleDefaultExpandedTabChange}
                onTrackSortChange={handleTrackSortChange}
                onOpenExternal={(url) => void window.system.openExternal(url)}
              />
            ) : (
              <>
                <LibraryHero
                  currentRootLabel={currentRootLabel}
                  isLoading={isLoadingLibrary}
                  visibleTrackCount={visibleTracks.length}
                  filterCounts={availabilityCounts}
                  activeFilter={availabilityFilter}
                  libraryMessage={libraryMessage}
                  onFilterChange={handleAvailabilityFilterChange}
                />

                <TrackTable
                  tracks={visibleTracks}
                  selectedTrackId={selectedTrackId}
                  hasRoots={roots.length > 0}
                  isLoading={isLoadingLibrary}
                  showLoadingOverlay={isLoadingLibrary}
                  activeFilter={availabilityFilter}
                  scrollContainerRef={libraryViewRef}
                  onOpenSettings={handleOpenSettings}
                  onSelectTrack={setSelectedTrackId}
                  onPlayTrack={handlePlayTrack}
                />
              </>
            )}
          </main>
        </div>
      </div>

      <BottomPlayer
        track={trackDetail}
        isPlaying={isPlaying}
        isExpanded={isPlayerExpanded}
        canPlay={canPlaySelectedTrack}
        playbackMode={playbackMode}
        currentTimeMs={playbackPositionMs}
        durationMs={durationMs || trackDetail?.durationMs || 0}
        volumePercent={volumePercent}
        canStepPrev={
          playbackPositionMs >= 3000 ||
          (playbackMode === "shuffle"
            ? visibleTracks.length > 1
            : playbackMode === "repeat-all"
              ? visibleTracks.length > 0
              : selectedTrackIndex > 0)
        }
        canStepNext={
          playbackMode === "shuffle"
            ? visibleTracks.length > 1
            : playbackMode === "repeat-all"
              ? visibleTracks.length > 0
              : selectedTrackIndex >= 0 && selectedTrackIndex < visibleTracks.length - 1
        }
        onStepPrev={() => stepTrack(-1)}
        onStepNext={() => stepTrack(1)}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onCyclePlaybackMode={handleCyclePlaybackMode}
        onTogglePanel={handleTogglePanel}
      />
    </div>
  );
}
