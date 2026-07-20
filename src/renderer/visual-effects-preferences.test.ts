import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISUAL_EFFECTS,
  readStoredVisualEffects
} from "./visual-effects-preferences";

describe("readStoredVisualEffects", () => {
  it("returns defaults when storage is unavailable", () => {
    expect(readStoredVisualEffects(null)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });

  it("migrates the legacy lyrics glow to the unified player glow", () => {
    const storage = {
      getItem: () => JSON.stringify({
        mainBackground: true,
        bottomPlayer: false,
        lyrics: true
      })
    };

    expect(readStoredVisualEffects(storage)).toEqual({
      mainBackground: true,
      playerGlow: true
    });
  });

  it("prefers the new player glow value and ignores the removed footer option", () => {
    const storage = {
      getItem: () => JSON.stringify({
        mainBackground: false,
        playerGlow: false,
        bottomPlayer: true,
        lyrics: true
      })
    };

    expect(readStoredVisualEffects(storage)).toEqual({
      mainBackground: false,
      playerGlow: false
    });
  });

  it("falls back to defaults for invalid data", () => {
    const storage = {
      getItem: () => "{not valid json"
    };

    expect(readStoredVisualEffects(storage)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });
});
