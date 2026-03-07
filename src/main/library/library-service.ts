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

type LibraryWorker = Pick<Worker, "on" | "postMessage" | "terminate">;
type WorkerFactory = (workerPath: string) => LibraryWorker;

export class LibraryService extends EventEmitter {
  private worker: LibraryWorker | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private recovering: Promise<void> | null = null;
  private destroyed = false;
  private initialized = false;
  private readonly workerPath: string;

  constructor(
    private readonly userDataPath: string,
    private readonly createWorker: WorkerFactory = (workerPath) => new Worker(workerPath)
  ) {
    super();
    this.workerPath = path.join(__dirname, "library-worker.js");
    this.worker = this.spawnWorker();
  }

  async init(): Promise<void> {
    await this.call("init", this.userDataPath);
    this.initialized = true;
  }

  async addRoots(paths: string[]): Promise<ImportSummary> {
    return this.call("addRoots", paths) as Promise<ImportSummary>;
  }

  async removeRoot(rootId: string): Promise<void> {
    await this.call("removeRoot", rootId);
  }

  async removeTrack(trackId: string): Promise<void> {
    await this.call("removeTrack", trackId);
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
    this.destroyed = true;
    this.recovering = null;
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      await worker.terminate();
    }
  }

  private async call(method: WorkerCallMessage["method"], ...args: unknown[]): Promise<unknown> {
    if (this.recovering) {
      await this.recovering;
    }

    const worker = this.worker;
    if (!worker || this.destroyed) {
      throw new Error("Library worker is unavailable");
    }

    return this.dispatch(worker, method, ...args);
  }

  private dispatch(
    worker: LibraryWorker,
    method: WorkerCallMessage["method"],
    ...args: unknown[]
  ): Promise<unknown> {
    
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

    worker.postMessage(message);
    return result;
  }

  private spawnWorker(): LibraryWorker {
    const worker = this.createWorker(this.workerPath);
    worker.on("message", (message: WorkerResponseMessage) => {
      this.handleWorkerMessage(message);
    });
    worker.on("error", (error) => {
      if (this.worker !== worker) {
        return;
      }

      void this.handleWorkerFailure(error);
    });
    worker.on("exit", (code) => {
      if (this.worker !== worker || this.destroyed || code === 0) {
        return;
      }

      void this.handleWorkerFailure(new Error(`Library worker exited with code ${code}`));
    });
    return worker;
  }

  private async handleWorkerFailure(error: Error): Promise<void> {
    for (const pendingRequest of this.pending.values()) {
      pendingRequest.reject(error);
    }
    this.pending.clear();
    this.emit("worker-error", error);

    if (this.destroyed || this.recovering) {
      return;
    }

    this.worker = null;
    this.recovering = this.recoverWorker();
    try {
      await this.recovering;
    } finally {
      this.recovering = null;
    }
  }

  private async recoverWorker(): Promise<void> {
    const nextWorker = this.spawnWorker();
    this.worker = nextWorker;

    if (!this.initialized) {
      return;
    }

    await this.dispatch(nextWorker, "init", this.userDataPath);
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
