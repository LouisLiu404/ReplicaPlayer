import { describe, expect, it } from "vitest";

import type { LyricPayload } from "../shared/types";
import {
  hasLyricTranslations,
  lyricSourceBadge,
  splitLyricDisplayParts
} from "./lyrics-display";

describe("splitLyricDisplayParts", () => {
  it("keeps single-language lines intact", () => {
    expect(splitLyricDisplayParts("The cold never bothered me anyway")).toEqual({
      primary: "The cold never bothered me anyway",
      secondary: []
    });
  });

  it("extracts translation lines when latin and CJK text share the same lyric line", () => {
    expect(splitLyricDisplayParts("Let it go 严寒再也无法干扰我")).toEqual({
      primary: "Let it go",
      secondary: ["严寒再也无法干扰我"]
    });
  });
});

describe("hasLyricTranslations", () => {
  it("detects synced lyrics with translation segments", () => {
    const lyrics: LyricPayload = {
      mode: "synced",
      source: "embedded-synced",
      offsetMs: 0,
      lines: [{ startMs: 0, text: "Let it go 严寒再也无法干扰我" }]
    };

    expect(hasLyricTranslations(lyrics)).toBe(true);
  });

  it("ignores plain lyrics", () => {
    const lyrics: LyricPayload = {
      mode: "plain",
      source: "embedded-plain",
      text: "Some plain lyric"
    };

    expect(hasLyricTranslations(lyrics)).toBe(false);
  });
});

describe("lyricSourceBadge", () => {
  it("maps embedded and external sources to the compact badge labels", () => {
    expect(lyricSourceBadge("embedded-synced")).toBe("Embed");
    expect(lyricSourceBadge("external-lrc")).toBe("External");
    expect(lyricSourceBadge("none")).toBeNull();
  });
});
