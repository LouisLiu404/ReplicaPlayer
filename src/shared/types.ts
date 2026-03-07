export type LibraryRootStatus = "available" | "offline";
export type TrackAvailability = "available" | "missing" | "offline";
export type LyricMode = "none" | "plain" | "synced";
export type LyricSource =
  | "none"
  | "external-lrc"
  | "embedded-synced"
  | "embedded-plain"
  | "external-text";

export interface LibraryRoot {
  id: string;
  path: string;
  displayName: string;
  trackCount: number;
  status: LibraryRootStatus;
  addedAt: string;
  lastScanAt: string | null;
  lastError: string | null;
}

export interface InvalidImportPath {
  path: string;
  error: string;
}

export interface ImportSummary {
  addedRoots: LibraryRoot[];
  duplicatePaths: string[];
  invalidPaths: InvalidImportPath[];
}

export interface TrackQuery {
  search?: string;
  rootId?: string;
  includeMissing?: boolean;
  sort?: TrackSortOption;
}

export type TrackSortOption =
  | "title-asc"
  | "title-desc"
  | "modified-asc"
  | "modified-desc";

export interface TrackListItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  artworkUrl?: string;
  format: string;
  availability: TrackAvailability;
}

export interface TrackDetail extends TrackListItem {
  rootId: string;
  path: string;
  fileName: string;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  genre: string[];
  albumArtist: string;
  lastIndexedAt: string;
}

export interface SyncedLyricLine {
  startMs: number;
  text: string;
}

export type LyricPayload =
  | {
      mode: "none";
      source: "none";
    }
  | {
      mode: "plain";
      source: "external-lrc" | "embedded-plain" | "external-text";
      text: string;
    }
  | {
      mode: "synced";
      source: "external-lrc" | "embedded-synced";
      lines: SyncedLyricLine[];
      offsetMs: number;
    };

export type ScanPhase =
  | "queued"
  | "scanning-root"
  | "parsing-file"
  | "completed"
  | "error";

export interface ScanProgress {
  jobId: string;
  phase: ScanPhase;
  currentRootId?: string;
  currentRootPath?: string;
  currentFile?: string;
  processedFiles: number;
  discoveredFiles: number;
  message?: string;
}

export type ScanJobId = string;

export interface LibraryApi {
  pickRoots(): Promise<string[]>;
  addRoots(paths: string[]): Promise<ImportSummary>;
  removeRoot(rootId: string): Promise<void>;
  removeTrack(trackId: string): Promise<void>;
  rescan(): Promise<ScanJobId>;
  onScanProgress(callback: (progress: ScanProgress) => void): () => void;
  queryTracks(filter?: TrackQuery): Promise<TrackListItem[]>;
  getTrack(trackId: string): Promise<TrackDetail | null>;
  getLyrics(trackId: string): Promise<LyricPayload>;
  getRoots(): Promise<LibraryRoot[]>;
}

export interface SystemApi {
  openExternal(url: string): Promise<void>;
}

export type WorkerMethod =
  | "init"
  | "addRoots"
  | "removeRoot"
  | "removeTrack"
  | "rescan"
  | "queryTracks"
  | "getTrack"
  | "getLyrics"
  | "getRoots"
  | "resolveTrackPath"
  | "resolveArtworkPath";

export interface WorkerCallMessage {
  type: "call";
  id: string;
  method: WorkerMethod;
  args: unknown[];
}

export interface WorkerResultMessage {
  type: "result";
  id: string;
  result: unknown;
}

export interface WorkerErrorMessage {
  type: "error";
  id: string;
  error: string;
}

export interface WorkerEventMessage {
  type: "event";
  event: "scan-progress";
  payload: ScanProgress;
}

export type WorkerResponseMessage =
  | WorkerResultMessage
  | WorkerErrorMessage
  | WorkerEventMessage;
