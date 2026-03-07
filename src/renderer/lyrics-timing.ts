import type { LyricPayload } from "../shared/types";

export function currentLyricIndex(lyrics: LyricPayload, positionMs: number): number {
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

export function nextLyricDelayMs(lyrics: LyricPayload, positionMs: number): number | null {
  if (lyrics.mode !== "synced" || lyrics.lines.length === 0) {
    return null;
  }

  const activeIndex = currentLyricIndex(lyrics, positionMs);
  const nextIndex = activeIndex < 0 ? 0 : activeIndex + 1;
  const nextLine = lyrics.lines[nextIndex];

  if (!nextLine) {
    return null;
  }

  const playbackPosition = positionMs + lyrics.offsetMs;
  return Math.max(16, nextLine.startMs - playbackPosition);
}
