import { contextBridge, ipcRenderer } from "electron";

import type { LibraryApi, ScanProgress } from "./shared/types";

const api: LibraryApi = {
  pickRoots: () => ipcRenderer.invoke("library:pick-roots"),
  addRoots: (paths) => ipcRenderer.invoke("library:add-roots", paths),
  removeRoot: (rootId) => ipcRenderer.invoke("library:remove-root", rootId),
  removeTrack: (trackId) => ipcRenderer.invoke("library:remove-track", trackId),
  rescan: () => ipcRenderer.invoke("library:rescan"),
  onScanProgress: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => {
      callback(progress);
    };

    ipcRenderer.on("library:scan-progress", handler);
    return () => {
      ipcRenderer.removeListener("library:scan-progress", handler);
    };
  },
  queryTracks: (filter) => ipcRenderer.invoke("library:query-tracks", filter),
  getTrack: (trackId) => ipcRenderer.invoke("library:get-track", trackId),
  getLyrics: (trackId) => ipcRenderer.invoke("library:get-lyrics", trackId),
  getRoots: () => ipcRenderer.invoke("library:get-roots")
};

contextBridge.exposeInMainWorld("library", api);
