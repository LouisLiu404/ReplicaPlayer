import { describe, expect, it } from "vitest";

import { DEFAULT_TRACK_SORT, readStoredTrackSort } from "./sort-preferences";

describe("sort preferences", () => {
  it("defaults to title asc when storage is unavailable", () => {
    expect(readStoredTrackSort(null)).toBe(DEFAULT_TRACK_SORT);
  });

  it("reads a valid stored sort option", () => {
    const storage = {
      getItem: () => "modified-desc"
    };

    expect(readStoredTrackSort(storage)).toBe("modified-desc");
  });

  it("falls back when storage contains an invalid sort option", () => {
    const storage = {
      getItem: () => "invalid"
    };

    expect(readStoredTrackSort(storage)).toBe(DEFAULT_TRACK_SORT);
  });
});
