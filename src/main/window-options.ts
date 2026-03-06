import type { BrowserWindowConstructorOptions } from "electron";

export const MAIN_WINDOW_WIDTH = 1500;
export const MAIN_WINDOW_HEIGHT = 800;

export function getMainWindowOptions(preloadEntry: string): BrowserWindowConstructorOptions {
  return {
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    minWidth: MAIN_WINDOW_WIDTH,
    minHeight: MAIN_WINDOW_HEIGHT,
    maxWidth: MAIN_WINDOW_WIDTH,
    maxHeight: MAIN_WINDOW_HEIGHT,
    resizable: false,
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
