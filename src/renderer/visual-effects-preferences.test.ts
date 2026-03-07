import { describe, expect, it } from "vitest";

import {
  DEFAULT_VISUAL_EFFECTS,
  readStoredVisualEffects
} from "./visual-effects-preferences";

describe("readStoredVisualEffects", () => {
  it("returns defaults when storage is unavailable", () => {
    expect(readStoredVisualEffects(null)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });

  it("reads stored toggles and falls back missing values", () => {
    const storage = {
      getItem: () => JSON.stringify({
        mainBackground: false,
        lyrics: false
      })
    };

    expect(readStoredVisualEffects(storage)).toEqual({
      mainBackground: false,
      bottomPlayer: true,
      lyrics: false
    });
  });

  it("falls back to defaults for invalid data", () => {
    const storage = {
      getItem: () => "{not valid json"
    };

    expect(readStoredVisualEffects(storage)).toEqual(DEFAULT_VISUAL_EFFECTS);
  });
});
