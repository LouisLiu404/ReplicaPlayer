import {
  startTransition,
  type CSSProperties,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";

import type {
  LibraryRoot,
  ScanProgress,
  TrackListItem,
  TrackSortOption
} from "../shared/types";
import { BottomPlayer } from "./components/BottomPlayer";
import { ExpandedPlayer } from "./components/ExpandedPlayer";
import { ChevronDownIcon } from "./components/icons";
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
  DEFAULT_STREAMER_VARS,
  extractStreamerVars,
  type StreamerVars
} from "./streamer";
import {
  DEFAULT_EXPANDED_TAB_STORAGE_KEY,
  readStoredDefaultExpandedTab
} from "./panel-preferences";
import { LruCache } from "./lru-cache";
import { appendRecentScanFile } from "./scan-progress";
import {
  readStoredTrackSort,
  TRACK_SORT_STORAGE_KEY
} from "./sort-preferences";
import {
  type VisualEffectKey,
  readStoredVisualEffects,
  VISUAL_EFFECTS_STORAGE_KEY
} from "./visual-effects-preferences";
import { useAudioPlayback } from "./use-audio-playback";
import { useVisualizer } from "./use-visualizer";

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

const EXPANDED_PLAYER_TRANSITION_MS = 280;
type ExpandedPlayerPhase = "closed" | "entering" | "open" | "closing";

function toScanFileLabel(filePath: string): string {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] || filePath;
}

function trackQueryCacheKey(rootId: string, search: string, sort: TrackSortOption): string {
  return `${rootId}::${search.trim().toLowerCase()}::${sort}`;
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
  const lyricRefs = useRef(new Map<number, HTMLDivElement | null>());
  const lyricsScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const panelExpandButtonRef = useRef<HTMLButtonElement | null>(null);
  const activePanelTabRef = useRef<ActivePanelTab>("details");
  const trackQueryCacheRef = useRef(new LruCache<string, TrackListItem[]>(32));
  const streamerCacheRef = useRef(new LruCache<string, StreamerVars>(128));
  const scanModalSeenFilesRef = useRef(new Map<string, Set<string>>());

  const [isWindowActive, setIsWindowActive] = useState(true);
  const [activeView, setActiveView] = useState<AppView>("library");
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<TrackListItem[]>([]);
  const [selectedRootId, setSelectedRootId] = useState<string>("");
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
  const [defaultExpandedTab, setDefaultExpandedTab] = useState<ActivePanelTab>(() =>
    readStoredDefaultExpandedTab(window.localStorage)
  );
  const [activePanelTab, setActivePanelTab] = useState<ActivePanelTab>(() =>
    readStoredDefaultExpandedTab(window.localStorage)
  );
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [renderExpandedPlayer, setRenderExpandedPlayer] = useState(false);
  const [expandedPlayerPhase, setExpandedPlayerPhase] = useState<ExpandedPlayerPhase>("closed");
  const [scanModal, setScanModal] = useState<ManualScanModalState | null>(null);
  const [streamerVars, setStreamerVars] = useState<StreamerVars>(DEFAULT_STREAMER_VARS);
  const [visualEffects, setVisualEffects] = useState(() =>
    readStoredVisualEffects(window.localStorage)
  );

  const deferredSearch = useDeferredValue(search);

  const collapseExpandedPlayer = useCallback((restoreFocus = false): void => {
    setIsPlayerExpanded(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        panelExpandButtonRef.current?.focus();
      });
    }
  }, []);

  activePanelTabRef.current = activePanelTab;

  const availabilityCounts = countAvailabilities(libraryTracks);
  const visibleTracks = filterTracks(libraryTracks, availabilityFilter);

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

  const handleTrackNotFound = useCallback(() => {
    setReloadTick((value) => value + 1);
  }, []);

  const {
    audioRef,
    selectedTrackId,
    trackDetail,
    lyrics,
    isPlaying,
    playbackPositionMs,
    durationMs,
    playbackError,
    activeLyricLine,
    playbackMode,
    volumePercent,
    setSelectedTrackId,
    handleTogglePlay: baseHandleTogglePlay,
    handleSeek,
    handleCyclePlaybackMode,
    handleVolumeChange,
    stepTrack,
    setActiveLyricLine,
    setPlaybackError
  } = useAudioPlayback(visibleTracks, chooseRandomTrack, handleTrackNotFound);

  useVisualizer(audioRef, appShellRef, true);

  useEffect(() => {
    const handleWindowFocus = () => setIsWindowActive(true);
    const handleWindowBlur = () => setIsWindowActive(false);

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  // Keyboard shortcuts
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
        collapseExpandedPlayer(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [collapseExpandedPlayer, isPlayerExpanded]);

  // Load library roots
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

  // Load library tracks
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

  // Clear query cache on library change
  useEffect(() => {
    trackQueryCacheRef.current.clear();
  }, [reloadTick]);

  const selectedTrackIndex = visibleTracks.findIndex((track) => track.id === selectedTrackId);
  const currentRoot = roots.find((root) => root.id === selectedRootId) ?? null;
  const currentRootLabel = currentRoot?.displayName ?? "All folders";
  const allFoldersTrackCount = hasLoadedRoots
    ? roots.reduce((total, root) => total + root.trackCount, 0)
    : null;

  // Auto-select first track
  useEffect(() => {
    if (!selectedTrackId && visibleTracks.length > 0) {
      setSelectedTrackId(visibleTracks[0].id);
    }
  }, [selectedTrackId, setSelectedTrackId, visibleTracks]);

  // Close expanded player when switching to settings
  useEffect(() => {
    if (activeView === "settings") {
      setIsPlayerExpanded(false);
    }
  }, [activeView]);

  // Expanded player enter/exit animation
  useEffect(() => {
    let frameA = 0;
    let frameB = 0;
    let timeoutId = 0;

    if (isPlayerExpanded) {
      setRenderExpandedPlayer(true);
      setExpandedPlayerPhase("entering");
      frameA = window.requestAnimationFrame(() => {
        frameB = window.requestAnimationFrame(() => {
          setExpandedPlayerPhase("open");
        });
      });
    } else if (renderExpandedPlayer) {
      setExpandedPlayerPhase("closing");
      timeoutId = window.setTimeout(() => {
        setRenderExpandedPlayer(false);
        setExpandedPlayerPhase("closed");
      }, EXPANDED_PLAYER_TRANSITION_MS);
    } else {
      setExpandedPlayerPhase("closed");
    }

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
      window.clearTimeout(timeoutId);
    };
  }, [isPlayerExpanded, renderExpandedPlayer]);

  useEffect(() => {
    if (isPlayerExpanded) {
      return;
    }

    if (!renderExpandedPlayer && expandedPlayerPhase !== "closed") {
      setExpandedPlayerPhase("closed");
    }
  }, [expandedPlayerPhase, isPlayerExpanded, renderExpandedPlayer]);

  // Scan progress listener
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

        let seenFiles = scanModalSeenFilesRef.current.get(progress.jobId);
        if (!seenFiles) {
          seenFiles = new Set<string>();
          scanModalSeenFilesRef.current.set(progress.jobId, seenFiles);
        }

        const nextFiles =
          appendRecentScanFile(
            current.files,
            progress.currentFile,
            seenFiles
          );

        if (progress.phase === "completed") {
          scanModalSeenFilesRef.current.delete(progress.jobId);
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
          scanModalSeenFilesRef.current.delete(progress.jobId);
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

  // Persist preferences
  useEffect(() => {
    try {
      window.localStorage.setItem(DEFAULT_EXPANDED_TAB_STORAGE_KEY, defaultExpandedTab);
    } catch {
      // Ignore storage failures
    }
  }, [defaultExpandedTab]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRACK_SORT_STORAGE_KEY, trackSort);
    } catch {
      // Ignore storage failures
    }
  }, [trackSort]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VISUAL_EFFECTS_STORAGE_KEY, JSON.stringify(visualEffects));
    } catch {
      // Ignore storage failures
    }
  }, [visualEffects]);

  // Extract streamer vars from artwork
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

  // Apply streamer CSS variables
  useEffect(() => {
    const appShell = appShellRef.current;
    if (!appShell) {
      return;
    }

    for (const [key, value] of Object.entries(streamerVars)) {
      appShell.style.setProperty(key, value);
    }

    appShell.style.setProperty("--streamer-play-state", isPlaying ? "running" : "paused");
    appShell.style.setProperty("--main-glow-enabled", visualEffects.mainBackground ? "1" : "0");
    appShell.style.setProperty("--footer-glow-enabled", visualEffects.bottomPlayer ? "1" : "0");
    appShell.style.setProperty("--lyrics-glow-enabled", visualEffects.lyrics ? "1" : "0");
  }, [isPlaying, streamerVars, visualEffects]);

  // Reset availability filter when counts drop to zero
  useEffect(() => {
    if (availabilityFilter === "missing" && availabilityCounts.missing === 0) {
      setAvailabilityFilter("all");
      return;
    }

    if (availabilityFilter === "offline" && availabilityCounts.offline === 0) {
      setAvailabilityFilter("all");
    }
  }, [availabilityCounts.missing, availabilityCounts.offline, availabilityFilter]);

  // Synced lyrics timing
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
  }, [activePanelTab, audioRef, isPlayerExpanded, lyrics, selectedTrackId, setActiveLyricLine]);

  // Auto-scroll lyrics
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

  // Clear lyric refs on track change
  useEffect(() => {
    lyricRefs.current.clear();
  }, [selectedTrackId, lyrics.mode]);

  // Library management handlers
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
        if (!scanModalSeenFilesRef.current.has(jobId)) {
          scanModalSeenFilesRef.current.set(jobId, new Set<string>());
        }
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
      if (!scanModalSeenFilesRef.current.has(jobId)) {
        scanModalSeenFilesRef.current.set(jobId, new Set<string>());
      }
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

  // Wrapped toggle play to add panel tab behavior
  function handleTogglePlay(): void {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      if (activePanelTabRef.current !== "lyrics") {
        setActivePanelTab("queue");
      }
    }

    baseHandleTogglePlay();
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

    collapseExpandedPlayer(true);
  }, [collapseExpandedPlayer, defaultExpandedTab, isPlayerExpanded]);

  const handleSetLyricRef = useCallback((index: number, element: HTMLDivElement | null): void => {
    lyricRefs.current.set(index, element);
  }, []);

  const handleSetLyricsScrollRef = useCallback((element: HTMLDivElement | null): void => {
    lyricsScrollRef.current = element;
  }, []);

  const handlePlayTrack = useCallback((trackId: string): void => {
    if (activePanelTabRef.current !== "lyrics") {
      setActivePanelTab("queue");
    }

    if (selectedTrackId !== trackId) {
      setSelectedTrackId(trackId);
      return;
    }

    // Same track — always restart from beginning
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (trackDetail && trackDetail.availability !== "available") {
      setPlaybackError(
        trackDetail.availability === "missing"
          ? "This file is missing from disk. Run Rescan to refresh the library."
          : "This track is in a saved folder that is currently unavailable."
      );
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Playback blocked by browser autoplay policy
    });
  }, [audioRef, selectedTrackId, setSelectedTrackId, setPlaybackError, trackDetail]);

  const handleDefaultExpandedTabChange = useCallback((tab: ActivePanelTab): void => {
    setDefaultExpandedTab(tab);
    if (!isPlayerExpanded) {
      setActivePanelTab(tab);
    }
  }, [isPlayerExpanded]);

  const handleTrackSortChange = useCallback((sort: TrackSortOption): void => {
    setTrackSort(sort);
  }, []);

  const handleVisualEffectChange = useCallback((effect: VisualEffectKey, enabled: boolean): void => {
    setVisualEffects((current) => ({
      ...current,
      [effect]: enabled
    }));
  }, []);

  const canPlaySelectedTrack = trackDetail?.availability === "available";
  const isSettingsView = activeView === "settings" && !isPlayerExpanded;
  const selectedMissingTrack = trackDetail?.availability === "missing"
    ? trackDetail
    : availabilityFilter === "missing"
      ? visibleTracks.find((track) => track.availability === "missing") ?? null
      : null;

  return (
    <div
      ref={appShellRef}
      className={`app-shell ${isWindowActive ? "window-active" : "window-inactive"}`}
    >
      <audio ref={audioRef} />
      <ScanProgressModal
        scan={scanModal}
        onClose={() => {
          if (scanModal) {
            scanModalSeenFilesRef.current.delete(scanModal.jobId);
          }
          setScanModal(null);
        }}
        toFileLabel={toScanFileLabel}
      />

      <div className="window-drag-strip">
        {isPlayerExpanded ? (
          <button
            type="button"
            className="window-collapse-button"
            onClick={() => collapseExpandedPlayer(true)}
            aria-label="Collapse expanded player"
          >
            <ChevronDownIcon />
          </button>
        ) : null}
      </div>

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
            className={`main-view-shell ${isSettingsView ? "settings-main-shell" : "library-main-shell"} ${isPlayerExpanded ? "panel-open" : ""}`}
          >
            {!isPlayerExpanded ? (
              <div className={`main-view-stage ${renderExpandedPlayer ? "revealed-under-overlay" : ""}`}>
                {libraryError ? <div className="error-banner">{libraryError}</div> : null}
                {playbackError ? <div className="error-banner">{playbackError}</div> : null}
                {!isSettingsView && selectedMissingTrack ? (
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

                {isSettingsView ? (
                  <SettingsView
                    roots={roots}
                    scanProgress={scanProgress}
                    defaultExpandedTab={defaultExpandedTab}
                    trackSort={trackSort}
                    visualEffects={visualEffects}
                    onAddRoots={() => void handleAddRoots()}
                    onRescan={() => void handleRescan()}
                    onRemoveRoot={(rootId) => void handleRemoveRoot(rootId)}
                    onDefaultExpandedTabChange={handleDefaultExpandedTabChange}
                    onTrackSortChange={handleTrackSortChange}
                    onVisualEffectChange={handleVisualEffectChange}
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
              </div>
            ) : null}

          </main>
        </div>

        {renderExpandedPlayer ? (
          <div
            className={`expanded-player-overlay ${expandedPlayerPhase}`}
            style={{ "--expanded-player-transition-ms": `${EXPANDED_PLAYER_TRANSITION_MS}ms` } as CSSProperties}
          >
            {libraryError ? <div className="error-banner overlay-banner">{libraryError}</div> : null}
            {playbackError ? <div className="error-banner overlay-banner">{playbackError}</div> : null}
            <div className="expanded-player-view">
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
            </div>
          </div>
        ) : null}
      </div>

      <BottomPlayer
        track={trackDetail}
        isPlaying={isPlaying}
        isExpanded={isPlayerExpanded}
        isSettingsView={isSettingsView}
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
        panelExpandButtonRef={panelExpandButtonRef}
      />
    </div>
  );
}
