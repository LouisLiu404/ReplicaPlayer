import { DatabaseSync } from "node:sqlite";

import type {
  LibraryRoot,
  LibraryRootStatus,
  LyricPayload,
  TrackAvailability,
  TrackDetail,
  TrackListItem,
  TrackQuery
} from "../../shared/types";

interface StoredTrackRecord {
  id: string;
  rootId: string;
  realPath: string;
  fileName: string;
  ext: string;
  sizeBytes: number;
  mtimeMs: number;
  availability: TrackAvailability;
  durationMs: number;
  bitrate: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNo: number | null;
  discNo: number | null;
  year: number | null;
  genreJson: string;
  artworkKey: string | null;
  lyricMode: LyricPayload["mode"];
  lastIndexedAt: string;
}

export interface IndexedTrackState {
  id: string;
  realPath: string;
  sizeBytes: number;
  mtimeMs: number;
  availability: TrackAvailability;
}

function formatFromExtension(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".mp3":
      return "MP3";
    case ".flac":
      return "FLAC";
    case ".oga":
    case ".ogg":
      return "Ogg";
    default:
      return ext.replace(/^\./, "").toUpperCase();
  }
}

function toArtworkUrl(artworkKey: string | null): string | undefined {
  return artworkKey ? `replica-media://art/${encodeURIComponent(artworkKey)}` : undefined;
}

function mapRoot(row: Record<string, unknown>): LibraryRoot {
  return {
    id: String(row.id),
    path: String(row.path),
    displayName: String(row.display_name),
    status: row.status as LibraryRootStatus,
    addedAt: String(row.added_at),
    lastScanAt: (row.last_scan_at as string | null) ?? null,
    lastError: (row.last_error as string | null) ?? null
  };
}

function mapTrackListItem(row: Record<string, unknown>): TrackListItem {
  const ext = String(row.ext);

  return {
    id: String(row.id),
    title: String(row.title),
    artist: String(row.artist),
    album: String(row.album),
    durationMs: Number(row.duration_ms ?? 0),
    artworkUrl: toArtworkUrl((row.artwork_hash as string | null) ?? null),
    format: formatFromExtension(ext),
    availability: row.availability as TrackAvailability
  };
}

function mapTrackDetail(row: Record<string, unknown>): TrackDetail {
  const ext = String(row.ext);
  const genreJson = typeof row.genre_json === "string" ? row.genre_json : "[]";

  return {
    id: String(row.id),
    rootId: String(row.root_id),
    path: String(row.real_path),
    fileName: String(row.file_name),
    title: String(row.title),
    artist: String(row.artist),
    album: String(row.album),
    durationMs: Number(row.duration_ms ?? 0),
    artworkUrl: toArtworkUrl((row.artwork_hash as string | null) ?? null),
    format: formatFromExtension(ext),
    availability: row.availability as TrackAvailability,
    bitrate: row.bitrate == null ? null : Number(row.bitrate),
    sampleRate: row.sample_rate == null ? null : Number(row.sample_rate),
    bitDepth: row.bit_depth == null ? null : Number(row.bit_depth),
    trackNo: row.track_no == null ? null : Number(row.track_no),
    discNo: row.disc_no == null ? null : Number(row.disc_no),
    year: row.year == null ? null : Number(row.year),
    genre: JSON.parse(genreJson) as string[],
    albumArtist: String(row.album_artist ?? ""),
    lastIndexedAt: String(row.last_indexed_at)
  };
}

export class LibraryRepository {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    this.db = new DatabaseSync(databasePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS library_roots (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        added_at TEXT NOT NULL,
        last_scan_at TEXT,
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        root_id TEXT NOT NULL,
        real_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        ext TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        mtime_ms INTEGER NOT NULL,
        availability TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        bitrate INTEGER,
        sample_rate INTEGER,
        bit_depth INTEGER,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        album_artist TEXT NOT NULL,
        track_no INTEGER,
        disc_no INTEGER,
        year INTEGER,
        genre_json TEXT NOT NULL,
        artwork_hash TEXT,
        lyric_mode TEXT NOT NULL,
        last_indexed_at TEXT NOT NULL,
        FOREIGN KEY (root_id) REFERENCES library_roots(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lyrics (
        track_id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        mode TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_root_id ON tracks(root_id);
      CREATE INDEX IF NOT EXISTS idx_tracks_title_artist_album ON tracks(title, artist, album);
    `);
  }

  close(): void {
    this.db.close();
  }

  getRoots(): LibraryRoot[] {
    const statement = this.db.prepare(`
      SELECT id, path, display_name, status, added_at, last_scan_at, last_error
      FROM library_roots
      ORDER BY lower(display_name), lower(path)
    `);

    return (statement.all() as Record<string, unknown>[]).map(mapRoot);
  }

  getRootByPath(rootPath: string): LibraryRoot | null {
    const statement = this.db.prepare(`
      SELECT id, path, display_name, status, added_at, last_scan_at, last_error
      FROM library_roots
      WHERE path = ?
      LIMIT 1
    `);

    const row = statement.get(rootPath) as Record<string, unknown> | undefined;
    return row ? mapRoot(row) : null;
  }

  insertRoot(root: {
    id: string;
    path: string;
    displayName: string;
    addedAt: string;
  }): LibraryRoot {
    const statement = this.db.prepare(`
      INSERT INTO library_roots (id, path, display_name, status, added_at, last_scan_at, last_error)
      VALUES (?, ?, ?, 'available', ?, NULL, NULL)
    `);

    statement.run(root.id, root.path, root.displayName, root.addedAt);
    const created = this.getRootByPath(root.path);
    if (!created) {
      throw new Error(`Failed to insert library root: ${root.path}`);
    }

    return created;
  }

  deleteRoot(rootId: string): void {
    const statement = this.db.prepare(`DELETE FROM library_roots WHERE id = ?`);
    statement.run(rootId);
  }

  markRoot(rootId: string, status: LibraryRootStatus, lastError: string | null, lastScanAt: string | null): void {
    const statement = this.db.prepare(`
      UPDATE library_roots
      SET status = ?, last_error = ?, last_scan_at = ?
      WHERE id = ?
    `);

    statement.run(status, lastError, lastScanAt, rootId);
  }

  setTrackAvailabilityForRoot(rootId: string, availability: TrackAvailability): void {
    const statement = this.db.prepare(`
      UPDATE tracks
      SET availability = ?
      WHERE root_id = ?
    `);

    statement.run(availability, rootId);
  }

  setTrackAvailability(trackId: string, availability: TrackAvailability): void {
    const statement = this.db.prepare(`
      UPDATE tracks
      SET availability = ?
      WHERE id = ?
    `);

    statement.run(availability, trackId);
  }

  getTrackStatesByRoot(rootId: string): IndexedTrackState[] {
    const statement = this.db.prepare(`
      SELECT id, real_path, size_bytes, mtime_ms, availability
      FROM tracks
      WHERE root_id = ?
    `);

    return (statement.all(rootId) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      realPath: String(row.real_path),
      sizeBytes: Number(row.size_bytes),
      mtimeMs: Number(row.mtime_ms),
      availability: row.availability as TrackAvailability
    }));
  }

  upsertTrack(track: StoredTrackRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO tracks (
        id, root_id, real_path, file_name, ext, size_bytes, mtime_ms, availability,
        duration_ms, bitrate, sample_rate, bit_depth, title, artist, album,
        album_artist, track_no, disc_no, year, genre_json, artwork_hash,
        lyric_mode, last_indexed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(real_path) DO UPDATE SET
        root_id = excluded.root_id,
        file_name = excluded.file_name,
        ext = excluded.ext,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms,
        availability = excluded.availability,
        duration_ms = excluded.duration_ms,
        bitrate = excluded.bitrate,
        sample_rate = excluded.sample_rate,
        bit_depth = excluded.bit_depth,
        title = excluded.title,
        artist = excluded.artist,
        album = excluded.album,
        album_artist = excluded.album_artist,
        track_no = excluded.track_no,
        disc_no = excluded.disc_no,
        year = excluded.year,
        genre_json = excluded.genre_json,
        artwork_hash = excluded.artwork_hash,
        lyric_mode = excluded.lyric_mode,
        last_indexed_at = excluded.last_indexed_at,
        availability = excluded.availability
    `);

    statement.run(
      track.id,
      track.rootId,
      track.realPath,
      track.fileName,
      track.ext,
      track.sizeBytes,
      track.mtimeMs,
      track.availability,
      track.durationMs,
      track.bitrate,
      track.sampleRate,
      track.bitDepth,
      track.title,
      track.artist,
      track.album,
      track.albumArtist,
      track.trackNo,
      track.discNo,
      track.year,
      track.genreJson,
      track.artworkKey,
      track.lyricMode,
      track.lastIndexedAt
    );
  }

  putLyrics(trackId: string, payload: LyricPayload): void {
    if (payload.mode === "none") {
      const statement = this.db.prepare(`DELETE FROM lyrics WHERE track_id = ?`);
      statement.run(trackId);
      return;
    }

    const now = new Date().toISOString();
    const statement = this.db.prepare(`
      INSERT INTO lyrics (track_id, source, mode, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(track_id) DO UPDATE SET
        source = excluded.source,
        mode = excluded.mode,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);

    statement.run(trackId, payload.source, payload.mode, JSON.stringify(payload), now);
  }

  queryTracks(filter: TrackQuery = {}): TrackListItem[] {
    const conditions: string[] = [];
    const parameters: string[] = [];

    if (!filter.includeMissing) {
      conditions.push(`availability != 'missing'`);
    }

    if (filter.rootId) {
      conditions.push(`root_id = ?`);
      parameters.push(filter.rootId);
    }

    const normalizedSearch = filter.search?.trim().toLowerCase();
    if (normalizedSearch) {
      const likeTerm = `%${normalizedSearch}%`;
      conditions.push(`(
        lower(title) LIKE ?
        OR lower(artist) LIKE ?
        OR lower(album) LIKE ?
        OR lower(file_name) LIKE ?
      )`);
      parameters.push(likeTerm, likeTerm, likeTerm, likeTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const statement = this.db.prepare(`
      SELECT id, title, artist, album, duration_ms, artwork_hash, ext, availability
      FROM tracks
      ${whereClause}
      ORDER BY lower(artist), lower(album), disc_no, track_no, lower(title)
    `);

    return (statement.all(...parameters) as Record<string, unknown>[]).map(mapTrackListItem);
  }

  getTrack(trackId: string): TrackDetail | null {
    const statement = this.db.prepare(`
      SELECT
        id, root_id, real_path, file_name, ext, duration_ms, artwork_hash, availability,
        bitrate, sample_rate, bit_depth, title, artist, album, album_artist,
        track_no, disc_no, year, genre_json, last_indexed_at
      FROM tracks
      WHERE id = ?
      LIMIT 1
    `);

    const row = statement.get(trackId) as Record<string, unknown> | undefined;
    return row ? mapTrackDetail(row) : null;
  }

  getLyrics(trackId: string): LyricPayload {
    const statement = this.db.prepare(`
      SELECT payload_json
      FROM lyrics
      WHERE track_id = ?
      LIMIT 1
    `);

    const row = statement.get(trackId) as Record<string, unknown> | undefined;
    if (!row || typeof row.payload_json !== "string") {
      return { mode: "none", source: "none" };
    }

    return JSON.parse(row.payload_json) as LyricPayload;
  }

  resolveTrackPath(trackId: string): string | null {
    const statement = this.db.prepare(`
      SELECT real_path, availability
      FROM tracks
      WHERE id = ?
      LIMIT 1
    `);

    const row = statement.get(trackId) as Record<string, unknown> | undefined;
    if (!row || row.availability !== "available") {
      return null;
    }

    return String(row.real_path);
  }
}

export type { StoredTrackRecord };
