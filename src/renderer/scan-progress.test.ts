import { describe, expect, it } from "vitest";

import { appendRecentScanFile, MAX_SCAN_MODAL_FILES } from "./scan-progress";

describe("appendRecentScanFile", () => {
  it("deduplicates files using the seen set", () => {
    const seen = new Set<string>();
    const files = appendRecentScanFile([], "/a.flac", seen);
    expect(appendRecentScanFile(files, "/a.flac", seen)).toEqual(["/a.flac"]);
  });

  it("keeps only the most recent scan rows", () => {
    const seen = new Set<string>();
    let files: string[] = [];

    for (let index = 0; index < MAX_SCAN_MODAL_FILES + 5; index += 1) {
      files = appendRecentScanFile(files, `/track-${index}.flac`, seen);
    }

    expect(files).toHaveLength(MAX_SCAN_MODAL_FILES);
    expect(files[0]).toBe("/track-5.flac");
    expect(files.at(-1)).toBe(`/track-${MAX_SCAN_MODAL_FILES + 4}.flac`);
  });
});
