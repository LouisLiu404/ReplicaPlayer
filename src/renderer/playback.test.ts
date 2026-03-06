import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYBACK_MODE,
  PLAYBACK_MODE_STORAGE_KEY,
  cyclePlaybackMode,
  readStoredPlaybackMode
} from "./playback";

describe("playback helpers", () => {
  it("defaults playback mode to repeat-all", () => {
    expect(DEFAULT_PLAYBACK_MODE).toBe("repeat-all");
    expect(readStoredPlaybackMode(null)).toBe("repeat-all");
  });

  it("reads persisted playback mode when it is valid", () => {
    const storage = {
      getItem(key: string) {
        return key === PLAYBACK_MODE_STORAGE_KEY ? "shuffle" : null;
      }
    };

    expect(readStoredPlaybackMode(storage)).toBe("shuffle");
  });

  it("falls back to repeat-all for invalid persisted values", () => {
    const storage = {
      getItem() {
        return "normal";
      }
    };

    expect(readStoredPlaybackMode(storage)).toBe("repeat-all");
  });

  it("cycles repeat-all, repeat-one, and shuffle in order", () => {
    expect(cyclePlaybackMode("repeat-all")).toBe("repeat-one");
    expect(cyclePlaybackMode("repeat-one")).toBe("shuffle");
    expect(cyclePlaybackMode("shuffle")).toBe("repeat-all");
  });
});
