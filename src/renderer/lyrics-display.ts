import type { LyricPayload, LyricSource } from "../shared/types";

export type LyricDisplayParts = {
  primary: string;
  secondary: string[];
};

export function splitLyricDisplayParts(text: string): LyricDisplayParts {
  const normalized = text.trim();
  if (!normalized) {
    return { primary: "…", secondary: [] };
  }

  const lineBreakParts = normalized
    .split(/\r?\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (lineBreakParts.length > 1) {
    return {
      primary: lineBreakParts[0] ?? normalized,
      secondary: lineBreakParts.slice(1)
    };
  }

  const latinThenCjk = normalized.match(
    /^(.+?\p{Script=Latin}[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Symbol}\s]*?)\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}].+)$/u
  );
  if (latinThenCjk) {
    return {
      primary: latinThenCjk[1].trim(),
      secondary: [latinThenCjk[2].trim()]
    };
  }

  const cjkThenLatin = normalized.match(
    /^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Punctuation}\s]+)\s+(.+?\p{Script=Latin}.+)$/u
  );
  if (cjkThenLatin) {
    return {
      primary: cjkThenLatin[1].trim(),
      secondary: [cjkThenLatin[2].trim()]
    };
  }

  return { primary: normalized, secondary: [] };
}

export function hasLyricTranslations(lyrics: LyricPayload): boolean {
  if (lyrics.mode !== "synced") {
    return false;
  }

  return lyrics.lines.some((line) => splitLyricDisplayParts(line.text).secondary.length > 0);
}

export function lyricSourceBadge(source: LyricSource): "Embed" | "External" | null {
  if (source.startsWith("embedded")) {
    return "Embed";
  }

  if (source.startsWith("external")) {
    return "External";
  }

  return null;
}
