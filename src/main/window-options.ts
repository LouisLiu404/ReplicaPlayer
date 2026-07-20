import type { BrowserWindowConstructorOptions } from "electron";

export const MAIN_WINDOW_MIN_WIDTH = 1280;
export const MAIN_WINDOW_MIN_HEIGHT = 700;
export const MAIN_WINDOW_WIDTH = MAIN_WINDOW_MIN_WIDTH;
export const MAIN_WINDOW_HEIGHT = MAIN_WINDOW_MIN_HEIGHT;

export function getMainWindowOptions(preloadEntry: string): BrowserWindowConstructorOptions {
  return {
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    resizable: true,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#0f1620",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: preloadEntry,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  };
}
