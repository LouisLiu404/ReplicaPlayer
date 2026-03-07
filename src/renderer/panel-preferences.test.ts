import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPANDED_TAB,
  readStoredDefaultExpandedTab
} from "./panel-preferences";

describe("panel preferences", () => {
  it("defaults to lyrics when storage is unavailable", () => {
    expect(readStoredDefaultExpandedTab(null)).toBe(DEFAULT_EXPANDED_TAB);
  });

  it("reads a valid stored default expanded tab", () => {
    const storage = {
      getItem: () => "details"
    };

    expect(readStoredDefaultExpandedTab(storage)).toBe("details");
  });

  it("falls back when storage contains an invalid tab", () => {
    const storage = {
      getItem: () => "invalid"
    };

    expect(readStoredDefaultExpandedTab(storage)).toBe(DEFAULT_EXPANDED_TAB);
  });
});
