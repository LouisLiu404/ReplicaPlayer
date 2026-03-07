import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { StoredTrackRecord } from "./repository";
import { LibraryRepository } from "./repository";

const tempDirs: string[] = [];

function createRepository(): LibraryRepository {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replica-player-repository-"));
  tempDirs.push(tempDir);
  return new LibraryRepository(path.join(tempDir, "library.sqlite"));
}

function createTrack(overrides: Partial<StoredTrackRecord>): StoredTrackRecord {
  return {
    id: overrides.id ?? "track-1",
    rootId: overrides.rootId ?? "root-1",
    realPath: overrides.realPath ?? `/music/${overrides.id ?? "track-1"}.flac`,
    fileName: overrides.fileName ?? `${overrides.id ?? "track-1"}.flac`,
    ext: overrides.ext ?? ".flac",
    sizeBytes: overrides.sizeBytes ?? 1024,
    mtimeMs: overrides.mtimeMs ?? 1000,
    availability: overrides.availability ?? "available",
    durationMs: overrides.durationMs ?? 120000,
    bitrate: overrides.bitrate ?? 900000,
    sampleRate: overrides.sampleRate ?? 44100,
    bitDepth: overrides.bitDepth ?? 24,
    title: overrides.title ?? "Track",
    artist: overrides.artist ?? "Artist",
    album: overrides.album ?? "Album",
    albumArtist: overrides.albumArtist ?? "Artist",
    trackNo: overrides.trackNo ?? 1,
    discNo: overrides.discNo ?? 1,
    year: overrides.year ?? 2026,
    genreJson: overrides.genreJson ?? "[]",
    artworkKey: overrides.artworkKey ?? null,
    lyricMode: overrides.lyricMode ?? "none",
    lastIndexedAt: overrides.lastIndexedAt ?? "2026-03-07T00:00:00.000Z"
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("LibraryRepository.queryTracks sort", () => {
  it("defaults to title ascending", () => {
    const repository = createRepository();
    repository.insertRoot({
      id: "root-1",
      path: "/music/root-1",
      displayName: "Root 1",
      addedAt: "2026-03-07T00:00:00.000Z"
    });

    repository.upsertTrack(createTrack({
      id: "track-b",
      title: "Bravo",
      mtimeMs: 2000
    }));
    repository.upsertTrack(createTrack({
      id: "track-a",
      title: "Alpha",
      mtimeMs: 3000,
      realPath: "/music/track-a.flac",
      fileName: "track-a.flac"
    }));

    const tracks = repository.queryTracks();
    expect(tracks.map((track) => track.title)).toEqual(["Alpha", "Bravo"]);

    repository.close();
  });

  it("sorts by modified date descending when requested", () => {
    const repository = createRepository();
    repository.insertRoot({
      id: "root-1",
      path: "/music/root-1",
      displayName: "Root 1",
      addedAt: "2026-03-07T00:00:00.000Z"
    });

    repository.upsertTrack(createTrack({
      id: "track-old",
      title: "Older",
      mtimeMs: 1000,
      realPath: "/music/track-old.flac",
      fileName: "track-old.flac"
    }));
    repository.upsertTrack(createTrack({
      id: "track-new",
      title: "Newer",
      mtimeMs: 9000,
      realPath: "/music/track-new.flac",
      fileName: "track-new.flac"
    }));

    const tracks = repository.queryTracks({ sort: "modified-desc" });
    expect(tracks.map((track) => track.title)).toEqual(["Newer", "Older"]);

    repository.close();
  });
});
