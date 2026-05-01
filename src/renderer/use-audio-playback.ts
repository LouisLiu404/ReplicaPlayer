import type React from "react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState
} from "react";

import type {
  LyricPayload,
  TrackDetail,
  TrackListItem
} from "../shared/types";
import { LruCache } from "./lru-cache";
import {
  cyclePlaybackMode,
  PLAYBACK_MODE_STORAGE_KEY,
  readStoredPlaybackMode,
  type PlaybackMode
} from "./playback";

const VOLUME_STORAGE_KEY = "replica-player:volume-percent";

class ResourceRequestError extends Error {
  constructor(readonly status: number) {
    super(`Resource request failed with status ${status}`);
  }
}

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

function isAudioActivelyPlaying(audio: HTMLAudioElement): boolean {
  return !audio.paused && !audio.ended;
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

async function loadObjectUrl(resourceUrl: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(resourceUrl, { signal });
  if (!response.ok) {
    throw new ResourceRequestError(response.status);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export type AudioPlaybackState = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  selectedTrackId: string | null;
  trackDetail: TrackDetail | null;
  lyrics: LyricPayload;
  isPlaying: boolean;
  playbackPositionMs: number;
  durationMs: number;
  playbackError: string | null;
  activeLyricLine: number;
  playbackMode: PlaybackMode;
  volumePercent: number;
  setSelectedTrackId: React.Dispatch<React.SetStateAction<string | null>>;
  handleTogglePlay: () => void;
  handleSeek: (nextPositionMs: number) => void;
  handleCyclePlaybackMode: () => void;
  handleVolumeChange: (nextVolumePercent: number) => void;
  stepTrack: (direction: -1 | 1) => void;
  setActiveLyricLine: React.Dispatch<React.SetStateAction<number>>;
  setPlaybackError: React.Dispatch<React.SetStateAction<string | null>>;
  clearTrackDetailCaches: () => void;
  removeTrackDetailFromCache: (trackId: string) => void;
};

export function useAudioPlayback(
  visibleTracks: TrackListItem[],
  chooseRandomTrack: (excludeTrackId: string | null) => TrackListItem | null
): AudioPlaybackState {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackIntentRef = useRef(false);
  const trackObjectUrlRef = useRef<string | null>(null);
  const sourceLoadStateRef = useRef<"idle" | "loading" | "ready">("idle");
  const trackDetailCacheRef = useRef(new LruCache<string, TrackDetail | null>(256));
  const lyricsCacheRef = useRef(new LruCache<string, LyricPayload>(256));

  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [trackDetail, setTrackDetail] = useState<TrackDetail | null>(null);
  const [lyrics, setLyrics] = useState<LyricPayload>({ mode: "none", source: "none" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPositionMs, setPlaybackPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [activeLyricLine, setActiveLyricLine] = useState(-1);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() =>
    readStoredPlaybackMode(window.localStorage)
  );
  const [volumePercent, setVolumePercent] = useState<number>(() => readStoredVolume());

  function clearTrackObjectUrl(): void {
    if (trackObjectUrlRef.current) {
      URL.revokeObjectURL(trackObjectUrlRef.current);
      trackObjectUrlRef.current = null;
    }
  }

  function syncPlaybackStateFromAudio(): void {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setIsPlaying(isAudioActivelyPlaying(audio));
  }

  // Load track details and lyrics when selectedTrackId changes
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

          setTrackDetail(cachedTrackDetail);
          setLyrics(cachedLyrics);
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

        setTrackDetail(nextTrackDetail);
        setLyrics(nextLyrics);
      } catch (error) {
        if (!ignore) {
          setPlaybackError(error instanceof Error ? error.message : "Unable to load track details");
        }
      }
    }

    void loadTrack();

    return () => {
      ignore = true;
    };
  }, [selectedTrackId]);

  // Load audio source when selectedTrackId changes
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
          syncPlaybackStateFromAudio();
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
            syncPlaybackStateFromAudio();
          }
        } catch (error) {
          if (!ignore && !(error instanceof DOMException && error.name === "AbortError")) {
            sourceLoadStateRef.current = "idle";
            playbackIntentRef.current = false;
            setIsPlaying(false);
            if (error instanceof ResourceRequestError && error.status === 404) {
              // Trigger a reload to detect missing tracks
              setTrackDetail((current) => current);
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

  // Stop playback for unavailable tracks
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

  // Sync volume to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volumePercent / 100;
    audio.muted = volumePercent === 0;
  }, [volumePercent]);

  // Persist volume
  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volumePercent));
    } catch {
      // Ignore storage failures
    }
  }, [volumePercent]);

  // Persist playback mode
  useEffect(() => {
    try {
      window.localStorage.setItem(PLAYBACK_MODE_STORAGE_KEY, playbackMode);
    } catch {
      // Ignore storage failures
    }
  }, [playbackMode]);

  // Sync volume from audio element
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

  // Audio event handlers using useEffectEvent for stable references
  const handleAudioPlay = useEffectEvent(() => {
    syncPlaybackStateFromAudio();
    setPlaybackError(null);
  });

  const handleAudioPause = useEffectEvent(() => {
    syncPlaybackStateFromAudio();
  });

  const handleAudioPlaying = useEffectEvent(() => {
    syncPlaybackStateFromAudio();
    setPlaybackError(null);
  });

  const handleAudioLoadedMetadata = useEffectEvent(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setPlaybackError(null);
    setDurationMs(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0);
    setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
    syncPlaybackStateFromAudio();
  });

  const handleAudioTimeUpdate = useEffectEvent(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setPlaybackPositionMs(Math.round(audio.currentTime * 1000));
    syncPlaybackStateFromAudio();
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

  // Register audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.addEventListener("play", handleAudioPlay);
    audio.addEventListener("playing", handleAudioPlaying);
    audio.addEventListener("pause", handleAudioPause);
    audio.addEventListener("loadedmetadata", handleAudioLoadedMetadata);
    audio.addEventListener("timeupdate", handleAudioTimeUpdate);
    audio.addEventListener("seeked", handleAudioTimeUpdate);
    audio.addEventListener("ended", handleAudioEnded);
    audio.addEventListener("error", handleAudioError);

    return () => {
      audio.removeEventListener("play", handleAudioPlay);
      audio.removeEventListener("playing", handleAudioPlaying);
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
    handleAudioPlaying,
    handleAudioTimeUpdate
  ]);

  const handleTogglePlay = useCallback((): void => {
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
      void audio.play()
        .then(() => {
          syncPlaybackStateFromAudio();
        })
        .catch((error) => {
          playbackIntentRef.current = false;
          setPlaybackError(playbackRejectionMessage(trackDetail, error));
        });
      return;
    }

    playbackIntentRef.current = false;
    audio.pause();
  }, [selectedTrackId, trackDetail, visibleTracks]);

  const handleSeek = useCallback((nextPositionMs: number): void => {
    const audio = audioRef.current;
    const maxDuration = Math.max(durationMs, trackDetail?.durationMs ?? 0, 1);
    const clampedPosition = Math.min(Math.max(nextPositionMs, 0), maxDuration);
    setPlaybackPositionMs(clampedPosition);
    if (audio) {
      audio.currentTime = clampedPosition / 1000;
    }
  }, [durationMs, trackDetail?.durationMs]);

  const handleCyclePlaybackMode = useCallback((): void => {
    setPlaybackMode((current) => cyclePlaybackMode(current));
  }, []);

  const handleVolumeChange = useCallback((nextVolumePercent: number): void => {
    const clampedVolume = Math.min(Math.max(nextVolumePercent, 0), 100);
    setVolumePercent(clampedVolume);
  }, []);

  const stepTrack = useCallback((direction: -1 | 1): void => {
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
  }, [chooseRandomTrack, handleSeek, playbackMode, playbackPositionMs, selectedTrackId, visibleTracks]);

  const clearTrackDetailCaches = useCallback(() => {
    trackDetailCacheRef.current.clear();
    lyricsCacheRef.current.clear();
  }, []);

  const removeTrackDetailFromCache = useCallback((trackId: string) => {
    trackDetailCacheRef.current.delete(trackId);
    lyricsCacheRef.current.delete(trackId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTrackObjectUrl();
    };
  }, []);

  return {
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
    handleTogglePlay,
    handleSeek,
    handleCyclePlaybackMode,
    handleVolumeChange,
    stepTrack,
    setActiveLyricLine,
    setPlaybackError,
    clearTrackDetailCaches,
    removeTrackDetailFromCache
  };
}
