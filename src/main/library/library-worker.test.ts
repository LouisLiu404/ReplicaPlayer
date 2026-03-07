import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerApplication } from "./library-worker";

const tempDirs: string[] = [];

function createTempDir(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replica-player-worker-"));
  tempDirs.push(tempDir);
  return tempDir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("WorkerApplication.rescan", () => {
  it("returns the active scan job id instead of starting a second scan", async () => {
    const scanControl: { resolve?: () => void } = {};
    const rescan = vi.fn(() => new Promise<void>((resolve) => {
      scanControl.resolve = resolve;
    }));
    const worker = new WorkerApplication(() => ({
      addRoots: vi.fn(),
      rescan
    }));

    await worker.init(createTempDir());

    const firstJobId = await worker.rescan();
    const secondJobId = await worker.rescan();

    expect(secondJobId).toBe(firstJobId);
    expect(rescan).toHaveBeenCalledTimes(1);

    expect(scanControl.resolve).toBeTypeOf("function");
    scanControl.resolve?.();
  });
});
