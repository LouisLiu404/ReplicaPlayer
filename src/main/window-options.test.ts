import { describe, expect, it } from "vitest";

import {
  MAIN_WINDOW_HEIGHT,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH,
  MAIN_WINDOW_WIDTH,
  getMainWindowOptions
} from "./window-options";

describe("getMainWindowOptions", () => {
  it("opens at the minimum size and allows resizing above it", () => {
    const options = getMainWindowOptions("/tmp/preload.js");

    // Every launch starts at the measured readability floor.
    expect(options.width).toBe(MAIN_WINDOW_WIDTH);
    expect(options.height).toBe(MAIN_WINDOW_HEIGHT);

    // Resizable with a real floor (no max clamps).
    expect(options.resizable).toBe(true);
    expect(options.minWidth).toBe(MAIN_WINDOW_MIN_WIDTH);
    expect(options.minHeight).toBe(MAIN_WINDOW_MIN_HEIGHT);
    expect(options.maxWidth).toBeUndefined();
    expect(options.maxHeight).toBeUndefined();

    // The startup size stays locked to the minimum constants.
    expect(MAIN_WINDOW_MIN_WIDTH).toBe(1280);
    expect(MAIN_WINDOW_MIN_HEIGHT).toBe(700);
    expect(MAIN_WINDOW_WIDTH).toBe(MAIN_WINDOW_MIN_WIDTH);
    expect(MAIN_WINDOW_HEIGHT).toBe(MAIN_WINDOW_MIN_HEIGHT);

    // Window stays movable but is not maximizable/fullscreenable.
    expect(options.movable).toBe(true);
    expect(options.maximizable).toBe(false);
    expect(options.fullscreenable).toBe(false);
    expect(options.titleBarStyle).toBe("hiddenInset");

    // Sandbox / isolation hardening is preserved.
    expect(options.webPreferences?.preload).toBe("/tmp/preload.js");
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
  });
});
