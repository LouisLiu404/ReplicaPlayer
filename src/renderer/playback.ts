export type PlaybackMode = "repeat-all" | "repeat-one" | "shuffle";

export const DEFAULT_PLAYBACK_MODE: PlaybackMode = "repeat-all";
export const PLAYBACK_MODE_STORAGE_KEY = "replica-player:playback-mode";

export function readStoredPlaybackMode(storage: Pick<Storage, "getItem"> | null): PlaybackMode {
  if (!storage) {
    return DEFAULT_PLAYBACK_MODE;
  }

  try {
    const raw = storage.getItem(PLAYBACK_MODE_STORAGE_KEY);
    if (raw === "repeat-all" || raw === "repeat-one" || raw === "shuffle") {
      return raw;
    }
  } catch {
    return DEFAULT_PLAYBACK_MODE;
  }

  return DEFAULT_PLAYBACK_MODE;
}

export function cyclePlaybackMode(current: PlaybackMode): PlaybackMode {
  switch (current) {
    case "repeat-all":
      return "repeat-one";
    case "repeat-one":
      return "shuffle";
    case "shuffle":
      return "repeat-all";
  }
}
