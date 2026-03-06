import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { parseFile } from "music-metadata/lib/index.js";
import type { IAudioMetadata, IPicture } from "music-metadata/lib/type.js";

import type {
  ImportSummary,
  LibraryRoot,
  LyricPayload,
  ScanProgress
} from "../../shared/types";
import { normalizeLyrics } from "./lyrics";
import { LibraryRepository, type IndexedTrackState, type StoredTrackRecord } from "./repository";

const SUPPORTED_EXTENSIONS = new Set([".mp3", ".flac", ".ogg", ".oga"]);

function parseYear(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(\d{4})\b/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function mimeTypeToExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function selectPicture(pictures: IPicture[] | undefined): IPicture | null {
  if (!pictures || pictures.length === 0) {
    return null;
  }

  return pictures.find((picture) => picture.type?.toLowerCase().includes("front")) ?? pictures[0];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function walkMusicFiles(rootPath: string): Promise<string[]> {
  const queue = [rootPath];
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(entryPath);
      }
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

async function loadExternalLyrics(trackPath: string): Promise<{ externalLrcText: string | null; externalTxtText: string | null }> {
  const directory = path.dirname(trackPath);
  const fileName = path.basename(trackPath, path.extname(trackPath));
  const lrcPath = path.join(directory, `${fileName}.lrc`);
  const txtPath = path.join(directory, `${fileName}.txt`);

  const [externalLrcText, externalTxtText] = await Promise.all([
    readTextIfExists(lrcPath),
    readTextIfExists(txtPath)
  ]);

  return { externalLrcText, externalTxtText };
}

async function persistArtwork(artworkDir: string, picture: IPicture | null): Promise<string | null> {
  if (!picture || picture.data.length === 0) {
    return null;
  }

  const extension = mimeTypeToExtension(picture.format);
  const hash = createHash("sha256").update(picture.data).digest("hex");
  const artworkKey = `${hash}${extension}`;
  const artworkPath = path.join(artworkDir, artworkKey);

  if (!(await fileExists(artworkPath))) {
    await fs.writeFile(artworkPath, picture.data);
  }

  return artworkKey;
}

function metadataToTrackRecord(args: {
  root: LibraryRoot;
  filePath: string;
  stat: { size: number; mtimeMs: number };
  metadata: IAudioMetadata | null;
  existing: IndexedTrackState | undefined;
  artworkKey: string | null;
  lyrics: LyricPayload;
}): StoredTrackRecord {
  const { root, filePath, stat, metadata, existing, artworkKey, lyrics } = args;
  const common = metadata?.common;
  const format = metadata?.format;
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath, ext);

  return {
    id: existing?.id ?? randomUUID(),
    rootId: root.id,
    realPath: filePath,
    fileName,
    ext,
    sizeBytes: stat.size,
    mtimeMs: Math.trunc(stat.mtimeMs),
    availability: "available",
    durationMs: Math.max(0, Math.round((format?.duration ?? 0) * 1000)),
    bitrate: format?.bitrate == null ? null : Math.round(format.bitrate),
    sampleRate: format?.sampleRate == null ? null : Math.round(format.sampleRate),
    bitDepth: format?.bitsPerSample == null ? null : Math.round(format.bitsPerSample),
    title: common?.title?.trim() || baseName,
    artist: common?.artist?.trim() || common?.artists?.[0]?.trim() || "Unknown Artist",
    album: common?.album?.trim() || "Unknown Album",
    albumArtist: common?.albumartist?.trim() || "",
    trackNo: common?.track.no ?? null,
    discNo: common?.disk.no ?? null,
    year: common?.year ?? parseYear(common?.date) ?? null,
    genreJson: JSON.stringify(common?.genre ?? []),
    artworkKey,
    lyricMode: lyrics.mode,
    lastIndexedAt: new Date().toISOString()
  };
}

export class LibraryScanner {
  constructor(
    private readonly repository: LibraryRepository,
    private readonly artworkDir: string
  ) {}

  async addRoots(paths: string[]): Promise<ImportSummary> {
    const addedRoots: LibraryRoot[] = [];
    const duplicatePaths: string[] = [];
    const invalidPaths: ImportSummary["invalidPaths"] = [];

    for (const rootPath of paths) {
      try {
        const canonicalPath = await fs.realpath(rootPath);
        const existing = this.repository.getRootByPath(canonicalPath);
        if (existing) {
          duplicatePaths.push(canonicalPath);
          continue;
        }

        const stats = await fs.stat(canonicalPath);
        if (!stats.isDirectory()) {
          invalidPaths.push({ path: rootPath, error: "Selected path is not a directory" });
          continue;
        }

        const created = this.repository.insertRoot({
          id: randomUUID(),
          path: canonicalPath,
          displayName: path.basename(canonicalPath) || canonicalPath,
          addedAt: new Date().toISOString()
        });

        addedRoots.push(created);
      } catch (error) {
        invalidPaths.push({
          path: rootPath,
          error: error instanceof Error ? error.message : "Failed to add library root"
        });
      }
    }

    return { addedRoots, duplicatePaths, invalidPaths };
  }

  async rescan(jobId: string, onProgress: (progress: ScanProgress) => void): Promise<void> {
    const roots = this.repository.getRoots();
    let discoveredFiles = 0;
    let processedFiles = 0;

    for (const root of roots) {
      onProgress({
        jobId,
        phase: "scanning-root",
        currentRootId: root.id,
        currentRootPath: root.path,
        processedFiles,
        discoveredFiles,
        message: `Scanning ${root.displayName}`
      });

      let canonicalRootPath: string;
      try {
        canonicalRootPath = await fs.realpath(root.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Library root is unavailable";
        this.repository.markRoot(root.id, "offline", message, new Date().toISOString());
        this.repository.setTrackAvailabilityForRoot(root.id, "offline");
        onProgress({
          jobId,
          phase: "error",
          currentRootId: root.id,
          currentRootPath: root.path,
          processedFiles,
          discoveredFiles,
          message
        });
        continue;
      }

      const existingTracks = new Map(
        this.repository.getTrackStatesByRoot(root.id).map((track) => [track.realPath, track])
      );
      const seenPaths = new Set<string>();
      const files = await walkMusicFiles(canonicalRootPath);
      discoveredFiles += files.length;

      for (const filePath of files) {
        let stat;
        try {
          stat = await fs.stat(filePath);
        } catch {
          continue;
        }

        const normalizedFilePath = path.resolve(filePath);
        const existingTrack = existingTracks.get(normalizedFilePath);
        seenPaths.add(normalizedFilePath);

        if (
          existingTrack &&
          existingTrack.sizeBytes === stat.size &&
          existingTrack.mtimeMs === Math.trunc(stat.mtimeMs)
        ) {
          this.repository.setTrackAvailability(existingTrack.id, "available");
          processedFiles += 1;
          continue;
        }

        onProgress({
          jobId,
          phase: "parsing-file",
          currentRootId: root.id,
          currentRootPath: root.path,
          currentFile: normalizedFilePath,
          processedFiles,
          discoveredFiles,
          message: path.basename(normalizedFilePath)
        });

        const { externalLrcText, externalTxtText } = await loadExternalLyrics(normalizedFilePath);
        let metadata: IAudioMetadata | null = null;
        let artworkKey: string | null = null;
        let lyrics: LyricPayload = { mode: "none", source: "none" };

        try {
          metadata = await parseFile(normalizedFilePath, { duration: true, skipCovers: false });
          artworkKey = await persistArtwork(this.artworkDir, selectPicture(metadata.common.picture));
          lyrics = normalizeLyrics({
            externalLrcText,
            externalTxtText,
            embeddedLyrics: metadata.common.lyrics
          });
        } catch {
          lyrics = normalizeLyrics({
            externalLrcText,
            externalTxtText,
            embeddedLyrics: null
          });
        }

        const trackRecord = metadataToTrackRecord({
          root,
          filePath: normalizedFilePath,
          stat,
          metadata,
          existing: existingTrack,
          artworkKey,
          lyrics
        });

        this.repository.upsertTrack(trackRecord);
        this.repository.putLyrics(trackRecord.id, lyrics);
        processedFiles += 1;
      }

      for (const existingTrack of existingTracks.values()) {
        if (!seenPaths.has(existingTrack.realPath)) {
          this.repository.setTrackAvailability(existingTrack.id, "missing");
        }
      }

      this.repository.markRoot(root.id, "available", null, new Date().toISOString());
    }

    onProgress({
      jobId,
      phase: "completed",
      processedFiles,
      discoveredFiles,
      message: `Indexed ${processedFiles} track${processedFiles === 1 ? "" : "s"}`
    });
  }
}
