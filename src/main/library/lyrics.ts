import type { ILyricsTag } from "music-metadata/lib/type.js";
import { TimestampFormat } from "music-metadata/lib/type.js";

import type { LyricPayload, SyncedLyricLine } from "../../shared/types";

const TIMESTAMP_PATTERN = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_PATTERN = /^\[offset:([+-]?\d+)\]$/i;

function stripBom(input: string): string {
  return input.replace(/^\uFEFF/, "");
}

function fractionToMilliseconds(rawFraction: string | undefined): number {
  if (!rawFraction) {
    return 0;
  }

  if (rawFraction.length === 3) {
    return Number.parseInt(rawFraction, 10);
  }

  if (rawFraction.length === 2) {
    return Number.parseInt(rawFraction, 10) * 10;
  }

  return Number.parseInt(rawFraction, 10) * 100;
}

function timestampMatchToMs(
  minutesRaw: string,
  secondsRaw: string,
  fractionRaw?: string
): number {
  const minutes = Number.parseInt(minutesRaw, 10);
  const seconds = Number.parseInt(secondsRaw, 10);
  const fraction = fractionToMilliseconds(fractionRaw);
  return (minutes * 60 * 1000) + (seconds * 1000) + fraction;
}

export function parseLrc(input: string): { lines: SyncedLyricLine[]; offsetMs: number } | null {
  const text = stripBom(input);
  const lines = text.split(/\r?\n/);
  const syncedLines: SyncedLyricLine[] = [];
  let offsetMs = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const offsetMatch = line.match(OFFSET_PATTERN);
    if (offsetMatch) {
      offsetMs = Number.parseInt(offsetMatch[1], 10);
      continue;
    }

    const timestamps = [...line.matchAll(TIMESTAMP_PATTERN)];
    if (timestamps.length === 0) {
      continue;
    }

    const textContent = line.replace(TIMESTAMP_PATTERN, "").trim();
    for (const timestamp of timestamps) {
      syncedLines.push({
        startMs: timestampMatchToMs(timestamp[1], timestamp[2], timestamp[3]),
        text: textContent
      });
    }
  }

  if (syncedLines.length === 0) {
    return null;
  }

  syncedLines.sort((left, right) => left.startMs - right.startMs);
  return { lines: syncedLines, offsetMs };
}

function normalizePlainText(input: string): string {
  return stripBom(input).trim();
}

function toPlainLyrics(source: "external-lrc" | "embedded-plain" | "external-text", text: string): LyricPayload {
  return {
    mode: "plain",
    source,
    text: normalizePlainText(text)
  };
}

function toSyncedLyrics(
  source: "external-lrc" | "embedded-synced",
  lines: SyncedLyricLine[],
  offsetMs: number
): LyricPayload {
  return {
    mode: "synced",
    source,
    lines,
    offsetMs
  };
}

function normalizeEmbeddedSyncedLyrics(lyrics: ILyricsTag[]): LyricPayload | null {
  for (const lyricTag of lyrics) {
    if (lyricTag.syncText.length > 0 && lyricTag.timeStampFormat === TimestampFormat.milliseconds) {
      const syncedLines = lyricTag.syncText
        .filter((line) => typeof line.timestamp === "number" && line.text.trim().length > 0)
        .map((line) => ({
          startMs: line.timestamp ?? 0,
          text: line.text.trim()
        }));

      if (syncedLines.length > 0) {
        return toSyncedLyrics("embedded-synced", syncedLines, 0);
      }
    }

    if (lyricTag.text) {
      const parsedLrc = parseLrc(lyricTag.text);
      if (parsedLrc) {
        return toSyncedLyrics("embedded-synced", parsedLrc.lines, parsedLrc.offsetMs);
      }
    }
  }

  return null;
}

function normalizeEmbeddedPlainLyrics(lyrics: ILyricsTag[]): LyricPayload | null {
  const plainText = lyrics
    .map((lyricTag) => {
      if (lyricTag.text && lyricTag.text.trim().length > 0) {
        return lyricTag.text.trim();
      }

      const joinedSyncText = lyricTag.syncText
        .map((line) => line.text.trim())
        .filter(Boolean)
        .join("\n");

      return joinedSyncText;
    })
    .find((value) => value.length > 0);

  if (!plainText) {
    return null;
  }

  return toPlainLyrics("embedded-plain", plainText);
}

export function normalizeLyrics(args: {
  externalLrcText?: string | null;
  externalTxtText?: string | null;
  embeddedLyrics?: ILyricsTag[] | null;
}): LyricPayload {
  if (args.externalLrcText) {
    const parsedLrc = parseLrc(args.externalLrcText);
    if (parsedLrc) {
      return toSyncedLyrics("external-lrc", parsedLrc.lines, parsedLrc.offsetMs);
    }

    const plainText = normalizePlainText(args.externalLrcText);
    if (plainText) {
      return toPlainLyrics("external-lrc", plainText);
    }
  }

  if (args.embeddedLyrics && args.embeddedLyrics.length > 0) {
    const synced = normalizeEmbeddedSyncedLyrics(args.embeddedLyrics);
    if (synced) {
      return synced;
    }

    const plain = normalizeEmbeddedPlainLyrics(args.embeddedLyrics);
    if (plain) {
      return plain;
    }
  }

  if (args.externalTxtText) {
    const plainText = normalizePlainText(args.externalTxtText);
    if (plainText) {
      return toPlainLyrics("external-text", plainText);
    }
  }

  return { mode: "none", source: "none" };
}
