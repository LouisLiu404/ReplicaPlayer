// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  LibraryApi,
  LibraryRoot,
  LyricPayload,
  ScanProgress,
  TrackDetail,
  TrackListItem
} from "../shared/types";
import { DEFAULT_EXPANDED_TAB_STORAGE_KEY } from "./panel-preferences";
import { TRACK_SORT_STORAGE_KEY } from "./sort-preferences";
import { VISUAL_EFFECTS_STORAGE_KEY } from "./visual-effects-preferences";
import { App } from "./App";

vi.mock("./streamer", () => ({
  DEFAULT_STREAMER_VARS: {
    "--streamer-color-a": "rgba(255, 120, 0, 0.2)",
    "--streamer-color-b": "rgba(255, 80, 0, 0.2)",
    "--streamer-color-c": "rgba(255, 200, 80, 0.2)",
    "--streamer-color-d": "rgba(255, 255, 255, 0.08)",
    "--streamer-footer-a": "rgba(255, 120, 0, 0.18)",
    "--streamer-footer-b": "rgba(255, 80, 0, 0.18)",
    "--streamer-surface-tint": "rgba(255, 120, 0, 0.12)",
    "--streamer-surface-highlight": "rgba(255, 200, 80, 0.1)",
    "--streamer-shell-wash": "rgba(255, 200, 80, 0.08)",
    "--streamer-opacity": "0.5",
    "--streamer-footer-opacity": "0.32"
  },
  extractStreamerVars: vi.fn(async () => ({
    "--streamer-color-a": "rgba(255, 120, 0, 0.2)",
    "--streamer-color-b": "rgba(255, 80, 0, 0.2)",
    "--streamer-color-c": "rgba(255, 200, 80, 0.2)",
    "--streamer-color-d": "rgba(255, 255, 255, 0.08)",
    "--streamer-footer-a": "rgba(255, 120, 0, 0.18)",
    "--streamer-footer-b": "rgba(255, 80, 0, 0.18)",
    "--streamer-surface-tint": "rgba(255, 120, 0, 0.12)",
    "--streamer-surface-highlight": "rgba(255, 200, 80, 0.1)",
    "--streamer-shell-wash": "rgba(255, 200, 80, 0.08)",
    "--streamer-opacity": "0.5",
    "--streamer-footer-opacity": "0.32"
  }))
}));

vi.mock("./components/NavigationRail", () => ({
  NavigationRail: ({
    roots,
    allFoldersTrackCount,
    onSelectRoot,
    onOpenSettings
  }: {
    roots: LibraryRoot[];
    allFoldersTrackCount: number | null;
    onSelectRoot: (rootId: string) => void;
    onOpenSettings: () => void;
  }) => (
    <aside>
      <button type="button" onClick={onOpenSettings}>Settings</button>
      <button type="button" onClick={() => onSelectRoot("")}>
        {`All folders ${allFoldersTrackCount == null ? "Loading…" : allFoldersTrackCount}`}
      </button>
      {roots.map((root) => (
        <button key={root.id} type="button" onClick={() => onSelectRoot(root.id)}>
          {root.displayName}
        </button>
      ))}
    </aside>
  )
}));

vi.mock("./components/TopBar", () => ({
  TopBar: ({
    search,
    onSearchChange
  }: {
    search: string;
    onSearchChange: (value: string) => void;
  }) => (
    <input
      aria-label="Search tracks"
      value={search}
      onChange={(event) => onSearchChange((event.target as HTMLInputElement).value)}
    />
  )
}));

vi.mock("./components/LibraryHero", () => ({
  LibraryHero: ({
    currentRootLabel,
    visibleTrackCount
  }: {
    currentRootLabel: string;
    visibleTrackCount: number;
  }) => (
    <div data-testid="library-hero">
      {`${currentRootLabel}:${visibleTrackCount}`}
    </div>
  )
}));

vi.mock("./components/TrackTable", () => ({
  TrackTable: ({
    tracks,
    onSelectTrack,
    onPlayTrack
  }: {
    tracks: TrackListItem[];
    onSelectTrack: (trackId: string) => void;
    onPlayTrack: (trackId: string) => void;
  }) => (
    <div data-testid="track-table">
      {tracks.map((track) => (
        <button
          key={track.id}
          type="button"
          onClick={() => onSelectTrack(track.id)}
          onDoubleClick={() => onPlayTrack(track.id)}
        >
          {track.title}
        </button>
      ))}
    </div>
  )
}));

vi.mock("./components/ExpandedPlayer", () => ({
  ExpandedPlayer: ({
    activeTab
  }: {
    activeTab: string;
  }) => (
    <div data-testid="expanded-player">
      <span data-testid="expanded-active-tab">{activeTab}</span>
    </div>
  )
}));

vi.mock("./components/BottomPlayer", () => ({
  BottomPlayer: ({
    track,
    isPlaying,
    isExpanded,
    onTogglePanel
  }: {
    track: TrackDetail | null;
    isPlaying: boolean;
    isExpanded: boolean;
    onTogglePanel: () => void;
  }) => (
    <div>
      <button type="button" onClick={onTogglePanel} disabled={!track}>
        Toggle expanded player
      </button>
      <div data-testid="bottom-player-track">{track?.title ?? "none"}</div>
      <div data-testid="bottom-player-playing">{String(isPlaying)}</div>
      <div data-testid="bottom-player-expanded">{String(isExpanded)}</div>
    </div>
  )
}));

vi.mock("./components/SettingsView", () => ({
  SettingsView: ({
    defaultExpandedTab,
    trackSort,
    visualEffects,
    onDefaultExpandedTabChange,
    onTrackSortChange,
    onVisualEffectChange
  }: {
    defaultExpandedTab: string;
    trackSort: string;
    visualEffects: {
      mainBackground: boolean;
      bottomPlayer: boolean;
      lyrics: boolean;
    };
    onDefaultExpandedTabChange: (tab: "queue" | "lyrics" | "details") => void;
    onTrackSortChange: (sort: "title-asc" | "title-desc" | "modified-asc" | "modified-desc") => void;
    onVisualEffectChange: (effect: "mainBackground" | "bottomPlayer" | "lyrics", enabled: boolean) => void;
  }) => (
    <div data-testid="settings-view">
      <div data-testid="settings-default-tab">{defaultExpandedTab}</div>
      <div data-testid="settings-track-sort">{trackSort}</div>
      <div data-testid="settings-main-glow">{String(visualEffects.mainBackground)}</div>
      <div data-testid="settings-footer-glow">{String(visualEffects.bottomPlayer)}</div>
      <div data-testid="settings-lyrics-glow">{String(visualEffects.lyrics)}</div>
      <button type="button" onClick={() => onDefaultExpandedTabChange("queue")}>Default Queue</button>
      <button type="button" onClick={() => onDefaultExpandedTabChange("lyrics")}>Default Lyrics</button>
      <button type="button" onClick={() => onDefaultExpandedTabChange("details")}>Default Details</button>
      <button type="button" onClick={() => onTrackSortChange("title-desc")}>Sort Title Desc</button>
      <button type="button" onClick={() => onTrackSortChange("modified-asc")}>Sort Modified Asc</button>
      <button type="button" onClick={() => onVisualEffectChange("mainBackground", true)}>Enable Main Glow</button>
      <button type="button" onClick={() => onVisualEffectChange("bottomPlayer", true)}>Enable Footer Glow</button>
      <button type="button" onClick={() => onVisualEffectChange("lyrics", true)}>Enable Lyrics Glow</button>
    </div>
  )
}));

vi.mock("./components/ScanProgressModal", () => ({
  ScanProgressModal: ({ scan }: { scan: ScanProgress | null }) => (
    scan ? <div data-testid="scan-modal">{scan.message}</div> : null
  )
}));

const ROOTS: LibraryRoot[] = [
  {
    id: "root-1",
    path: "/Users/liuyike/Music/Root One",
    displayName: "Root One",
    trackCount: 1,
    status: "available",
    addedAt: "2026-03-07T01:00:00.000Z",
    lastScanAt: "2026-03-07T01:05:00.000Z",
    lastError: null
  },
  {
    id: "root-2",
    path: "/Users/liuyike/Music/Root Two",
    displayName: "Root Two",
    trackCount: 1,
    status: "available",
    addedAt: "2026-03-07T01:06:00.000Z",
    lastScanAt: "2026-03-07T01:07:00.000Z",
    lastError: null
  }
];

const TRACK_ONE: TrackListItem = {
  id: "track-1",
  title: "Track One",
  artist: "Artist One",
  album: "Album One",
  durationMs: 180000,
  format: "FLAC",
  availability: "available"
};

const TRACK_TWO: TrackListItem = {
  id: "track-2",
  title: "Track Two",
  artist: "Artist Two",
  album: "Album Two",
  durationMs: 200000,
  format: "MP3",
  availability: "available"
};

const TRACK_DETAILS: Record<string, TrackDetail> = {
  "track-1": {
    ...TRACK_ONE,
    rootId: "root-1",
    path: "/Users/liuyike/Music/Root One/track-one.flac",
    fileName: "track-one.flac",
    bitrate: 1000000,
    sampleRate: 44100,
    bitDepth: 24,
    trackNo: 1,
    discNo: 1,
    year: 2026,
    genre: ["Pop"],
    albumArtist: "Artist One",
    lastIndexedAt: "2026-03-07T01:05:00.000Z"
  },
  "track-2": {
    ...TRACK_TWO,
    rootId: "root-2",
    path: "/Users/liuyike/Music/Root Two/track-two.mp3",
    fileName: "track-two.mp3",
    bitrate: 320000,
    sampleRate: 48000,
    bitDepth: null,
    trackNo: 2,
    discNo: 1,
    year: 2025,
    genre: ["Dance"],
    albumArtist: "Artist Two",
    lastIndexedAt: "2026-03-07T01:07:00.000Z"
  }
};

const LYRICS: Record<string, LyricPayload> = {
  "track-1": { mode: "none", source: "none" },
  "track-2": { mode: "none", source: "none" }
};

type QueryArg = Parameters<LibraryApi["queryTracks"]>[0];

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

function createLibraryMock() {
  const queryTracks = vi.fn(async (filter?: QueryArg) => {
    const rootId = filter?.rootId ?? "";
    if (rootId === "root-1") {
      return [TRACK_ONE];
    }

    if (rootId === "root-2") {
      return [TRACK_TWO];
    }

    return [TRACK_ONE, TRACK_TWO];
  });

  const getTrack = vi.fn(async (trackId: string) => TRACK_DETAILS[trackId] ?? null);
  const getLyrics = vi.fn(async (trackId: string) => LYRICS[trackId] ?? { mode: "none", source: "none" });

  const api: LibraryApi = {
    pickRoots: vi.fn(async () => []),
    addRoots: vi.fn(async () => ({ addedRoots: [], duplicatePaths: [], invalidPaths: [] })),
    removeRoot: vi.fn(async () => {}),
    removeTrack: vi.fn(async () => {}),
    rescan: vi.fn(async () => "scan-job-1"),
    onScanProgress: vi.fn(() => () => {}),
    queryTracks,
    getTrack,
    getLyrics,
    getRoots: vi.fn(async () => ROOTS)
  };

  return {
    api,
    queryTracks,
    getTrack,
    getLyrics
  };
}

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get() {
      return HTMLMediaElement.HAVE_ENOUGH_DATA;
    }
  });

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["audio"])
    }))
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:mock-track")
  });

  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(() => {})
  });

  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    value: vi.fn(() => {})
  });

  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(() => {})
  });

  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn(async () => {})
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: createStorageMock()
  });
  window.system = {
    openExternal: vi.fn(async () => {})
  };
});

afterEach(() => {
  cleanup();
});

async function renderAppWithMock() {
  const mock = createLibraryMock();
  window.library = mock.api;

  render(<App />);

  await waitFor(() => {
    expect(screen.getByTestId("bottom-player-track").textContent).toBe("Track One");
  });

  return mock;
}

describe("App", () => {
  it("keeps one dedicated window drag strip across app views", async () => {
    await renderAppWithMock();

    const dragStrip = document.querySelector(".window-drag-strip");
    expect(dragStrip).not.toBeNull();
    expect(document.querySelectorAll(".window-drag-strip")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByTestId("settings-view")).toBeTruthy();
    });
    expect(document.querySelector(".window-drag-strip")).toBe(dragStrip);

    fireEvent.click(screen.getByRole("button", { name: "All folders 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle expanded player" }));
    await waitFor(() => {
      expect(screen.getByTestId("expanded-player")).toBeTruthy();
    });
    expect(document.querySelector(".window-drag-strip")).toBe(dragStrip);
  });

  it("subdues the shell glow while the window is inactive", async () => {
    await renderAppWithMock();

    const appShell = document.querySelector(".app-shell");
    expect(appShell?.classList.contains("window-active")).toBe(true);

    fireEvent.blur(window);
    expect(appShell?.classList.contains("window-inactive")).toBe(true);

    fireEvent.focus(window);
    expect(appShell?.classList.contains("window-active")).toBe(true);
  });

  it("opens the stored default expanded tab when the player is expanded", async () => {
    window.localStorage.setItem(DEFAULT_EXPANDED_TAB_STORAGE_KEY, "details");

    await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Toggle expanded player" }));

    await waitFor(() => {
      expect(screen.getByTestId("expanded-active-tab").textContent).toBe("details");
    });

    const overlay = document.querySelector(".expanded-player-overlay");
    expect(overlay?.parentElement?.classList.contains("app-workspace")).toBe(true);
    expect(screen.getByRole("button", { name: "Collapse expanded player" })).toBeTruthy();
  });

  it("persists the settings default tab and uses it on the next expansion", async () => {
    await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByTestId("settings-view").textContent).toContain("lyrics");
    });

    fireEvent.click(screen.getByRole("button", { name: "Default Queue" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(DEFAULT_EXPANDED_TAB_STORAGE_KEY)).toBe("queue");
    });

    fireEvent.click(screen.getByRole("button", { name: "All folders 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle expanded player" }));

    await waitFor(() => {
      expect(screen.getByTestId("expanded-active-tab").textContent).toBe("queue");
    });
  });

  it("closes the expanded player when a folder is selected from the sidebar", async () => {
    await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Toggle expanded player" }));
    await waitFor(() => {
      expect(screen.getByTestId("expanded-player")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Root Two" }));

    await waitFor(() => {
      expect(screen.queryByTestId("expanded-player")).toBeNull();
      expect(screen.getByTestId("track-table").textContent).toContain("Track Two");
    });
  });

  it("reuses cached query results when switching back to a previously loaded folder", async () => {
    const mock = await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Root One" }));
    await waitFor(() => {
      expect(screen.getByTestId("track-table").textContent).toContain("Track One");
    });

    fireEvent.click(screen.getByRole("button", { name: "Root Two" }));
    await waitFor(() => {
      expect(screen.getByTestId("track-table").textContent).toContain("Track Two");
    });

    fireEvent.click(screen.getByRole("button", { name: "Root One" }));
    await waitFor(() => {
      expect(screen.getByTestId("track-table").textContent).toContain("Track One");
    });

    const rootOneCalls = mock.queryTracks.mock.calls.filter((call) => {
      const filter = call[0] as QueryArg | undefined;
      return filter?.rootId === "root-1";
    });

    expect(rootOneCalls).toHaveLength(1);
    expect(mock.queryTracks).toHaveBeenCalledTimes(3);
  });

  it("persists track sort and requeries with the selected sort option", async () => {
    const mock = await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByTestId("settings-track-sort").textContent).toBe("title-asc");
    });

    fireEvent.click(screen.getByRole("button", { name: "Sort Modified Asc" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(TRACK_SORT_STORAGE_KEY)).toBe("modified-asc");
    });

    fireEvent.click(screen.getByRole("button", { name: "All folders 2" }));

    await waitFor(() => {
      const lastCall = mock.queryTracks.mock.calls.at(-1)?.[0] as QueryArg | undefined;
      expect(lastCall?.sort).toBe("modified-asc");
    });
  });

  it("persists visual effect toggles from settings", async () => {
    await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await waitFor(() => {
      expect(screen.getByTestId("settings-main-glow").textContent).toBe("false");
      expect(screen.getByTestId("settings-footer-glow").textContent).toBe("false");
      expect(screen.getByTestId("settings-lyrics-glow").textContent).toBe("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "Enable Footer Glow" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable Lyrics Glow" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(VISUAL_EFFECTS_STORAGE_KEY)).toBe(
        JSON.stringify({
          mainBackground: false,
          bottomPlayer: true,
          lyrics: true
        })
      );
    });
  });

  it("reuses cached track details and lyrics when returning to a previously selected track", async () => {
    const mock = await renderAppWithMock();

    fireEvent.click(screen.getByRole("button", { name: "Track Two" }));
    await waitFor(() => {
      expect(screen.getByTestId("bottom-player-track").textContent).toBe("Track Two");
    });

    fireEvent.click(screen.getByRole("button", { name: "Track One" }));
    await waitFor(() => {
      expect(screen.getByTestId("bottom-player-track").textContent).toBe("Track One");
    });

    const getTrackCalls = mock.getTrack.mock.calls.map(([trackId]: [string]) => trackId);
    const getLyricsCalls = mock.getLyrics.mock.calls.map(([trackId]: [string]) => trackId);

    expect(getTrackCalls.filter((trackId) => trackId === "track-1")).toHaveLength(1);
    expect(getTrackCalls.filter((trackId) => trackId === "track-2")).toHaveLength(1);
    expect(getLyricsCalls.filter((trackId) => trackId === "track-1")).toHaveLength(1);
    expect(getLyricsCalls.filter((trackId) => trackId === "track-2")).toHaveLength(1);
  });

  it("resyncs the play button state from the real audio element", async () => {
    await renderAppWithMock();

    const audio = document.querySelector("audio");
    if (!(audio instanceof HTMLAudioElement)) {
      throw new Error("Audio element not found");
    }

    Object.defineProperty(audio, "paused", {
      configurable: true,
      get: () => false
    });
    Object.defineProperty(audio, "ended", {
      configurable: true,
      get: () => false
    });

    fireEvent(audio, new Event("timeupdate"));

    await waitFor(() => {
      expect(screen.getByTestId("bottom-player-playing").textContent).toBe("true");
    });

    Object.defineProperty(audio, "paused", {
      configurable: true,
      get: () => true
    });

    fireEvent(audio, new Event("pause"));

    await waitFor(() => {
      expect(screen.getByTestId("bottom-player-playing").textContent).toBe("false");
    });
  });
});
