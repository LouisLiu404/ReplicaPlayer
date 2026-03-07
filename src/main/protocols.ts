import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { protocol } from "electron";

import { LibraryService } from "./library/library-service";
import {
  getProductionRendererRoot,
  normalizeProductionRendererRequestPath
} from "./renderer-paths";

function response(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store"
    }
  });
}

function contentTypeForPath(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".mp3":
      return "audio/mpeg";
    case ".flac":
      return "audio/flac";
    case ".ogg":
    case ".oga":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

function parseByteRange(rangeHeader: string | null, fileSize: number): { start: number; end: number } | null {
  if (!rangeHeader) {
    return { start: 0, end: Math.max(0, fileSize - 1) };
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    return null;
  }

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) {
    return null;
  }

  let start: number;
  let end: number;

  if (!startRaw) {
    const suffixLength = Number.parseInt(endRaw, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return null;
    }

    start = Math.max(0, fileSize - suffixLength);
    end = Math.max(0, fileSize - 1);
  } else {
    start = Number.parseInt(startRaw, 10);
    end = endRaw ? Number.parseInt(endRaw, 10) : Math.max(0, fileSize - 1);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return null;
    }
  }

  if (start < 0 || end < 0 || start > end || start >= fileSize) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1)
  };
}

function resolveWithin(basePath: string, requestedPath: string): string | null {
  const candidate = path.resolve(basePath, `.${requestedPath}`);
  const relativePath = path.relative(basePath, candidate);
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    return null;
  }

  return candidate;
}

async function streamLocalFile(filePath: string, rangeHeader: string | null = null): Promise<Response> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return response(404, "Resource not found");
    }

    const byteRange = parseByteRange(rangeHeader, stat.size);
    if (!byteRange) {
      return new Response(null, {
        status: 416,
        headers: {
          "accept-ranges": "bytes",
          "content-range": `bytes */${stat.size}`
        }
      });
    }

    const headers = new Headers({
      "accept-ranges": "bytes",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      "content-length": String(byteRange.end - byteRange.start + 1),
      "content-type": contentTypeForPath(filePath)
    });

    if (rangeHeader) {
      headers.set("content-range", `bytes ${byteRange.start}-${byteRange.end}/${stat.size}`);
    }

    const stream = createReadStream(filePath, {
      start: byteRange.start,
      end: byteRange.end
    });

    return new Response(Readable.toWeb(stream) as BodyInit, {
      status: rangeHeader ? 206 : 200,
      headers
    });
  } catch {
    return response(404, "Resource not found");
  }
}

export async function registerProtocols(library: LibraryService): Promise<void> {
  await protocol.handle("replica-media", async (request) => {
    if (request.method !== "GET") {
      return response(405, "Method not allowed");
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.hostname === "track") {
      const trackId = decodeURIComponent(requestUrl.pathname.slice(1));
      const trackPath = await library.resolveTrackPath(trackId);
      if (!trackPath) {
        return response(404, "Track not found");
      }

      return streamLocalFile(trackPath, request.headers.get("range"));
    }

    if (requestUrl.hostname === "art") {
      const artworkKey = decodeURIComponent(requestUrl.pathname.slice(1));
      const artworkPath = await library.resolveArtworkPath(artworkKey);
      if (!artworkPath) {
        return response(404, "Artwork not found");
      }

      return streamLocalFile(artworkPath);
    }

    return response(404, "Unknown media resource");
  });

  if (process.env.NODE_ENV === "development") {
    return;
  }

  const rendererRoot = getProductionRendererRoot(__dirname);

  await protocol.handle("app", async (request) => {
    const requestUrl = new URL(request.url);
    if (requestUrl.hostname !== "renderer") {
      return response(404, "Unknown app resource");
    }

    const requestPath = normalizeProductionRendererRequestPath(requestUrl.pathname);
    const filePath = resolveWithin(rendererRoot, decodeURIComponent(requestPath));
    if (!filePath) {
      return response(403, "Forbidden");
    }

    return streamLocalFile(filePath, request.headers.get("range"));
  });
}
