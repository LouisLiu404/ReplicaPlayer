import { describe, expect, it } from "vitest";
import { TimestampFormat } from "music-metadata/lib/type.js";

import { normalizeLyrics, parseLrc } from "./lyrics";

describe("parseLrc", () => {
  it("parses repeated timestamps and offset tags", () => {
    const parsed = parseLrc("[offset:+125]\n[00:10.50][00:12.00]Hello");

    expect(parsed).toEqual({
      offsetMs: 125,
      lines: [
        { startMs: 10_500, text: "Hello" },
        { startMs: 12_000, text: "Hello" }
      ]
    });
  });
});

describe("normalizeLyrics", () => {
  it("prefers adjacent lrc over embedded lyrics", () => {
    const lyrics = normalizeLyrics({
      externalLrcText: "[00:01.00]External line",
      embeddedLyrics: [
        {
          contentType: 1,
          timeStampFormat: TimestampFormat.milliseconds,
          syncText: [{ text: "Embedded line", timestamp: 500 }],
          descriptor: "",
          language: "eng"
        }
      ]
    });

    expect(lyrics).toEqual({
      mode: "synced",
      source: "external-lrc",
      offsetMs: 0,
      lines: [{ startMs: 1000, text: "External line" }]
    });
  });

  it("uses embedded synchronized lyrics when external lrc is missing", () => {
    const lyrics = normalizeLyrics({
      embeddedLyrics: [
        {
          contentType: 1,
          timeStampFormat: TimestampFormat.milliseconds,
          syncText: [
            { text: "First line", timestamp: 1000 },
            { text: "Second line", timestamp: 2500 }
          ],
          descriptor: "",
          language: "eng"
        }
      ]
    });

    expect(lyrics).toEqual({
      mode: "synced",
      source: "embedded-synced",
      offsetMs: 0,
      lines: [
        { startMs: 1000, text: "First line" },
        { startMs: 2500, text: "Second line" }
      ]
    });
  });

  it("parses embedded lrc text when mp3 lyrics do not include syncText", () => {
    const lyrics = normalizeLyrics({
      embeddedLyrics: [
        {
          contentType: 0,
          descriptor: "",
          language: "XXX",
          text: "[00:00.24]别辜负眼前季节\n[00:04.92]花踌躇柳轻叹敢问情何以堪"
        } as any
      ]
    });

    expect(lyrics).toEqual({
      mode: "synced",
      source: "embedded-synced",
      offsetMs: 0,
      lines: [
        { startMs: 240, text: "别辜负眼前季节" },
        { startMs: 4920, text: "花踌躇柳轻叹敢问情何以堪" }
      ]
    });
  });

  it("falls back to plain text lyrics", () => {
    const lyrics = normalizeLyrics({
      externalTxtText: "plain local lyrics"
    });

    expect(lyrics).toEqual({
      mode: "plain",
      source: "external-text",
      text: "plain local lyrics"
    });
  });
});
