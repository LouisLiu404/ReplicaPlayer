import type { LyricPayload, ScanPhase, TrackAvailability } from "../shared/types";

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatNumber(value: number | null, suffix: string): string {
  return value == null ? "—" : `${value.toLocaleString()} ${suffix}`;
}

export function availabilityLabel(value: TrackAvailability): string {
  switch (value) {
    case "available":
      return "Ready";
    case "offline":
      return "Unavailable";
    case "missing":
      return "Missing";
  }
}

export function availabilityDescription(value: TrackAvailability): string {
  switch (value) {
    case "available":
      return "On disk";
    case "offline":
      return "Folder unavailable";
    case "missing":
      return "Missing";
  }
}

export function formatSampleRateCompact(sampleRate: number | null): string | null {
  if (sampleRate == null) {
    return null;
  }

  const kiloHertz = sampleRate / 1000;
  const precision = Number.isInteger(kiloHertz) ? 0 : 1;
  return `${kiloHertz.toFixed(precision)} kHz`;
}

export function formatBitDepthCompact(bitDepth: number | null): string | null {
  return bitDepth == null ? null : `${bitDepth}-bit`;
}

export function lyricsSourceLabel(source: LyricPayload["source"]): string {
  switch (source) {
    case "external-lrc":
      return "Adjacent LRC";
    case "embedded-synced":
      return "Embedded Synced";
    case "embedded-plain":
      return "Embedded Text";
    case "external-text":
      return "Adjacent Text";
    case "none":
      return "No Lyrics";
  }
}

export function scanPhaseLabel(phase?: ScanPhase): string {
  switch (phase) {
    case "queued":
      return "Queued";
    case "scanning-root":
      return "Scanning";
    case "parsing-file":
      return "Parsing";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

export function scanPhaseTone(phase?: ScanPhase): "idle" | "active" | "success" | "error" {
  switch (phase) {
    case "queued":
    case "scanning-root":
    case "parsing-file":
      return "active";
    case "completed":
      return "success";
    case "error":
      return "error";
    default:
      return "idle";
  }
}
