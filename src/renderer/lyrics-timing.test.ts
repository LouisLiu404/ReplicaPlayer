import { describe, expect, it } from "vitest";

import type { LyricPayload } from "../shared/types";
import { currentLyricIndex, nextLyricDelayMs } from "./lyrics-timing";

const SYNCED_LYRICS: LyricPayload = {
  mode: "synced",
  source: "embedded-synced",
  offsetMs: 100,
  lines: [
    { startMs: 500, text: "line one" },
    { startMs: 1250, text: "line two" },
    { startMs: 2400, text: "line three" }
  ]
};

describe("lyrics timing helpers", () => {
  it("finds the current lyric line using the offset", () => {
    expect(currentLyricIndex(SYNCED_LYRICS, 0)).toBe(-1);
    expect(currentLyricIndex(SYNCED_LYRICS, 450)).toBe(0);
    expect(currentLyricIndex(SYNCED_LYRICS, 1200)).toBe(1);
  });

  it("calculates the delay until the next lyric change", () => {
    expect(nextLyricDelayMs(SYNCED_LYRICS, 0)).toBe(400);
    expect(nextLyricDelayMs(SYNCED_LYRICS, 600)).toBe(550);
    expect(nextLyricDelayMs(SYNCED_LYRICS, 2400)).toBeNull();
  });
});
