import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parentPort } from "node:worker_threads";

import type {
  ScanProgress,
  TrackDetail,
  TrackListItem,
  TrackQuery,
  WorkerCallMessage,
  WorkerResponseMessage
} from "../../shared/types";
import { LibraryRepository } from "./repository";
import { LibraryScanner } from "./scanner";

class WorkerApplication {
  private repository: LibraryRepository | null = null;
  private scanner: LibraryScanner | null = null;
  private artworkDir = "";

  async init(userDataPath: string): Promise<void> {
    await fs.mkdir(userDataPath, { recursive: true });
    this.artworkDir = path.join(userDataPath, "artwork");
    await fs.mkdir(this.artworkDir, { recursive: true });

    const databasePath = path.join(userDataPath, "library.sqlite");
    this.repository = new LibraryRepository(databasePath);
    this.scanner = new LibraryScanner(this.repository, this.artworkDir);
  }

  async addRoots(paths: string[]) {
    return this.getScanner().addRoots(paths);
  }

  async removeRoot(rootId: string): Promise<void> {
    this.getRepository().deleteRoot(rootId);
  }

  async removeTrack(trackId: string): Promise<void> {
    this.getRepository().deleteTrack(trackId);
  }

  async rescan(): Promise<string> {
    const jobId = randomUUID();
    const scanner = this.getScanner();

    this.emitProgress({
      jobId,
      phase: "queued",
      processedFiles: 0,
      discoveredFiles: 0,
      message: "Scan queued"
    });

    void scanner.rescan(jobId, (progress) => this.emitProgress(progress)).catch((error) => {
      this.emitProgress({
        jobId,
        phase: "error",
        processedFiles: 0,
        discoveredFiles: 0,
        message: error instanceof Error ? error.message : "Library scan failed"
      });
    });

    return jobId;
  }

  async queryTracks(filter: TrackQuery = {}): Promise<TrackListItem[]> {
    return this.getRepository().queryTracks(filter);
  }

  async getTrack(trackId: string): Promise<TrackDetail | null> {
    return this.getRepository().getTrack(trackId);
  }

  async getLyrics(trackId: string) {
    return this.getRepository().getLyrics(trackId);
  }

  async getRoots() {
    return this.getRepository().getRoots();
  }

  async resolveTrackPath(trackId: string): Promise<string | null> {
    const repository = this.getRepository();
    const track = repository.getTrack(trackId);
    if (!track || track.availability !== "available") {
      return null;
    }

    try {
      await fs.access(track.path);
      return track.path;
    } catch {
      const root = repository.getRoot(track.rootId);
      if (root) {
        try {
          await fs.access(root.path);
          repository.setTrackAvailability(trackId, "missing");
        } catch {
          repository.markRoot(root.id, "offline", "Saved folder is unavailable", new Date().toISOString());
          repository.setTrackAvailabilityForRoot(root.id, "offline");
        }
      } else {
        repository.setTrackAvailability(trackId, "missing");
      }

      return null;
    }
  }

  async resolveArtworkPath(artworkKey: string): Promise<string | null> {
    const safeArtworkKey = path.basename(artworkKey);
    if (safeArtworkKey !== artworkKey) {
      return null;
    }

    const artworkPath = path.join(this.artworkDir, safeArtworkKey);
    try {
      await fs.access(artworkPath);
      return artworkPath;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.repository?.close();
  }

  private emitProgress(payload: ScanProgress): void {
    parentPort?.postMessage({
      type: "event",
      event: "scan-progress",
      payload
    } satisfies WorkerResponseMessage);
  }

  private getRepository(): LibraryRepository {
    if (!this.repository) {
      throw new Error("Library worker has not been initialized");
    }

    return this.repository;
  }

  private getScanner(): LibraryScanner {
    if (!this.scanner) {
      throw new Error("Library worker has not been initialized");
    }

    return this.scanner;
  }
}

const worker = new WorkerApplication();

const postMessage = (message: WorkerResponseMessage): void => {
  parentPort?.postMessage(message);
};

async function handleMessage(message: WorkerCallMessage): Promise<void> {
  try {
    let result: unknown;

    switch (message.method) {
      case "init":
        result = await worker.init(String(message.args[0]));
        break;
      case "addRoots":
        result = await worker.addRoots(message.args[0] as string[]);
        break;
      case "removeRoot":
        result = await worker.removeRoot(String(message.args[0]));
        break;
      case "removeTrack":
        result = await worker.removeTrack(String(message.args[0]));
        break;
      case "rescan":
        result = await worker.rescan();
        break;
      case "queryTracks":
        result = await worker.queryTracks((message.args[0] as TrackQuery | undefined) ?? {});
        break;
      case "getTrack":
        result = await worker.getTrack(String(message.args[0]));
        break;
      case "getLyrics":
        result = await worker.getLyrics(String(message.args[0]));
        break;
      case "getRoots":
        result = await worker.getRoots();
        break;
      case "resolveTrackPath":
        result = await worker.resolveTrackPath(String(message.args[0]));
        break;
      case "resolveArtworkPath":
        result = await worker.resolveArtworkPath(String(message.args[0]));
        break;
      default:
        throw new Error(`Unsupported worker method: ${message.method}`);
    }

    postMessage({
      type: "result",
      id: message.id,
      result
    });
  } catch (error) {
    postMessage({
      type: "error",
      id: message.id,
      error: error instanceof Error ? error.message : "Unknown worker error"
    });
  }
}

parentPort?.on("message", (message: WorkerCallMessage) => {
  void handleMessage(message);
});

process.on("exit", () => {
  worker.dispose();
});
