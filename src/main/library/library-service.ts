import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { Worker } from "node:worker_threads";

import type {
  ImportSummary,
  LibraryRoot,
  LyricPayload,
  ScanJobId,
  ScanProgress,
  TrackDetail,
  TrackListItem,
  TrackQuery,
  WorkerCallMessage,
  WorkerErrorMessage,
  WorkerEventMessage,
  WorkerResponseMessage,
  WorkerResultMessage
} from "../../shared/types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class LibraryService extends EventEmitter {
  private readonly worker: Worker;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(private readonly userDataPath: string) {
    super();
    const workerPath = path.join(__dirname, "library-worker.js");
    this.worker = new Worker(workerPath);
    this.worker.on("message", (message: WorkerResponseMessage) => {
      this.handleWorkerMessage(message);
    });
    this.worker.on("error", (error) => {
      for (const pendingRequest of this.pending.values()) {
        pendingRequest.reject(error);
      }
      this.pending.clear();
      this.emit("worker-error", error);
    });
    this.worker.on("exit", (code) => {
      if (code !== 0) {
        const error = new Error(`Library worker exited with code ${code}`);
        for (const pendingRequest of this.pending.values()) {
          pendingRequest.reject(error);
        }
        this.pending.clear();
        this.emit("worker-error", error);
      }
    });
  }

  async init(): Promise<void> {
    await this.call("init", this.userDataPath);
  }

  async addRoots(paths: string[]): Promise<ImportSummary> {
    return this.call("addRoots", paths) as Promise<ImportSummary>;
  }

  async removeRoot(rootId: string): Promise<void> {
    await this.call("removeRoot", rootId);
  }

  async rescan(): Promise<ScanJobId> {
    return this.call("rescan") as Promise<ScanJobId>;
  }

  async queryTracks(filter: TrackQuery = {}): Promise<TrackListItem[]> {
    return this.call("queryTracks", filter) as Promise<TrackListItem[]>;
  }

  async getTrack(trackId: string): Promise<TrackDetail | null> {
    return this.call("getTrack", trackId) as Promise<TrackDetail | null>;
  }

  async getLyrics(trackId: string): Promise<LyricPayload> {
    return this.call("getLyrics", trackId) as Promise<LyricPayload>;
  }

  async getRoots(): Promise<LibraryRoot[]> {
    return this.call("getRoots") as Promise<LibraryRoot[]>;
  }

  async resolveTrackPath(trackId: string): Promise<string | null> {
    return this.call("resolveTrackPath", trackId) as Promise<string | null>;
  }

  async resolveArtworkPath(artworkKey: string): Promise<string | null> {
    return this.call("resolveArtworkPath", artworkKey) as Promise<string | null>;
  }

  onScanProgress(listener: (progress: ScanProgress) => void): () => void {
    this.on("scan-progress", listener);
    return () => {
      this.off("scan-progress", listener);
    };
  }

  async destroy(): Promise<void> {
    await this.worker.terminate();
  }

  private async call(method: WorkerCallMessage["method"], ...args: unknown[]): Promise<unknown> {
    const id = randomUUID();
    const message: WorkerCallMessage = {
      type: "call",
      id,
      method,
      args
    };

    const result = new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.worker.postMessage(message);
    return result;
  }

  private handleWorkerMessage(message: WorkerResponseMessage): void {
    if (message.type === "event") {
      this.handleWorkerEvent(message);
      return;
    }

    const pendingRequest = this.pending.get(message.id);
    if (!pendingRequest) {
      return;
    }

    this.pending.delete(message.id);

    if (message.type === "result") {
      pendingRequest.resolve((message as WorkerResultMessage).result);
      return;
    }

    pendingRequest.reject(new Error((message as WorkerErrorMessage).error));
  }

  private handleWorkerEvent(message: WorkerEventMessage): void {
    if (message.event === "scan-progress") {
      this.emit("scan-progress", message.payload);
    }
  }
}
