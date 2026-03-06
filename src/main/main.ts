import { app, BrowserWindow, dialog, ipcMain, protocol } from "electron";

import type { TrackQuery } from "../shared/types";
import { LibraryService } from "./library/library-service";
import { registerProtocols } from "./protocols";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  },
  {
    scheme: "replica-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let libraryService: LibraryService | null = null;

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value;
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings`);
  }

  return value;
}

function normalizeQuery(value: unknown): TrackQuery {
  if (!value || typeof value !== "object") {
    return {};
  }

  const query = value as Record<string, unknown>;

  return {
    search: typeof query.search === "string" ? query.search : undefined,
    rootId: typeof query.rootId === "string" ? query.rootId : undefined,
    includeMissing: typeof query.includeMissing === "boolean" ? query.includeMissing : undefined
  };
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    minWidth: 1500,
    minHeight: 800,
    maxWidth: 1500,
    maxHeight: 800,
    resizable: false,
    movable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#0f1620",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === "development") {
    await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  } else {
    await mainWindow.loadURL("app://renderer/index.html");
  }
}

function registerIpcHandlers(library: LibraryService): void {
  ipcMain.handle("library:pick-roots", async () => {
    const result = await dialog.showOpenDialog({
      title: "Add Music Folders",
      buttonLabel: "Add Folders",
      properties: ["openDirectory", "multiSelections", "createDirectory"]
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("library:add-roots", async (_event, payload) => {
    return library.addRoots(requireStringArray(payload, "paths"));
  });

  ipcMain.handle("library:remove-root", async (_event, payload) => {
    await library.removeRoot(requireString(payload, "rootId"));
  });

  ipcMain.handle("library:remove-track", async (_event, payload) => {
    await library.removeTrack(requireString(payload, "trackId"));
  });

  ipcMain.handle("library:rescan", async () => {
    return library.rescan();
  });

  ipcMain.handle("library:query-tracks", async (_event, payload) => {
    return library.queryTracks(normalizeQuery(payload));
  });

  ipcMain.handle("library:get-track", async (_event, payload) => {
    return library.getTrack(requireString(payload, "trackId"));
  });

  ipcMain.handle("library:get-lyrics", async (_event, payload) => {
    return library.getLyrics(requireString(payload, "trackId"));
  });

  ipcMain.handle("library:get-roots", async () => {
    return library.getRoots();
  });

  library.onScanProgress((progress) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send("library:scan-progress", progress);
      }
    }
  });
}

async function bootstrap(): Promise<void> {
  libraryService = new LibraryService(app.getPath("userData"));
  await libraryService.init();
  await registerProtocols(libraryService);
  registerIpcHandlers(libraryService);
  await createMainWindow();
}

app.whenReady().then(async () => {
  await bootstrap();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void libraryService?.destroy();
});
