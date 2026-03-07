import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { LibraryService } from "./library-service";

class FakeWorker extends EventEmitter {
  postedMessages: Array<{ type: string; id: string; method: string; args: unknown[] }> = [];

  postMessage(message: { type: string; id: string; method: string; args: unknown[] }): void {
    this.postedMessages.push(message);
  }

  async terminate(): Promise<number> {
    return 0;
  }
}

describe("LibraryService", () => {
  it("recovers from an unexpected worker exit and reinitializes the replacement worker", async () => {
    const workers: FakeWorker[] = [];
    const service = new LibraryService("/tmp/replica-player-test", () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker as never;
    });

    const initPromise = service.init();
    const firstInitMessage = workers[0].postedMessages.at(-1);
    workers[0].emit("message", {
      type: "result",
      id: firstInitMessage?.id,
      result: undefined
    });
    await initPromise;

    workers[0].emit("exit", 1);

    await vi.waitFor(() => {
      expect(workers[1]?.postedMessages).toHaveLength(1);
    });

    const secondInitMessage = workers[1].postedMessages.at(-1);
    workers[1].emit("message", {
      type: "result",
      id: secondInitMessage?.id,
      result: undefined
    });

    const queryPromise = service.getRoots();

    await vi.waitFor(() => {
      expect(workers[1].postedMessages).toHaveLength(2);
    });

    const queryMessage = workers[1].postedMessages[1];
    workers[1].emit("message", {
      type: "result",
      id: queryMessage?.id,
      result: []
    });

    await expect(queryPromise).resolves.toEqual([]);
    await service.destroy();
  });
});
