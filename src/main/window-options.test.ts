import { describe, expect, it } from "vitest";

import {
  MAIN_WINDOW_HEIGHT,
  MAIN_WINDOW_WIDTH,
  getMainWindowOptions
} from "./window-options";

describe("getMainWindowOptions", () => {
  it("keeps the main window fixed-size but movable", () => {
    const options = getMainWindowOptions("/tmp/preload.js");

    expect(options.width).toBe(MAIN_WINDOW_WIDTH);
    expect(options.height).toBe(MAIN_WINDOW_HEIGHT);
    expect(options.minWidth).toBe(MAIN_WINDOW_WIDTH);
    expect(options.maxWidth).toBe(MAIN_WINDOW_WIDTH);
    expect(options.minHeight).toBe(MAIN_WINDOW_HEIGHT);
    expect(options.maxHeight).toBe(MAIN_WINDOW_HEIGHT);
    expect(options.resizable).toBe(false);
    expect(options.movable).toBe(true);
    expect(options.titleBarStyle).toBe("hiddenInset");
    expect(options.webPreferences?.preload).toBe("/tmp/preload.js");
    expect(options.webPreferences?.contextIsolation).toBe(true);
    expect(options.webPreferences?.sandbox).toBe(true);
    expect(options.webPreferences?.nodeIntegration).toBe(false);
  });
});
