type RGB = {
  r: number;
  g: number;
  b: number;
};

type Bucket = RGB & {
  count: number;
  saturation: number;
  lightness: number;
};

export type StreamerVars = {
  "--streamer-color-a": string;
  "--streamer-color-b": string;
  "--streamer-color-c": string;
  "--streamer-color-d": string;
  "--streamer-footer-a": string;
  "--streamer-footer-b": string;
  "--streamer-opacity": string;
  "--streamer-footer-opacity": string;
};

export const DEFAULT_STREAMER_VARS: StreamerVars = {
  "--streamer-color-a": "rgba(255, 107, 90, 0.26)",
  "--streamer-color-b": "rgba(255, 168, 95, 0.22)",
  "--streamer-color-c": "rgba(255, 85, 38, 0.16)",
  "--streamer-color-d": "rgba(255, 209, 143, 0.12)",
  "--streamer-footer-a": "rgba(255, 120, 92, 0.24)",
  "--streamer-footer-b": "rgba(255, 184, 78, 0.18)",
  "--streamer-opacity": "0.92",
  "--streamer-footer-opacity": "0.84"
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRgba({ r, g, b }: RGB, alpha: number): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function adjustColor({ r, g, b }: RGB, delta: number): RGB {
  return {
    r: clamp(r + 255 * delta, 0, 255),
    g: clamp(g + 255 * delta, 0, 255),
    b: clamp(b + 255 * delta, 0, 255)
  };
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function toHsl({ r, g, b }: RGB): { saturation: number; lightness: number } {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { saturation: 0, lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  return { saturation, lightness };
}

function chooseDistinctColor(
  candidates: Bucket[],
  selected: RGB[],
  fallback: RGB
): RGB {
  const candidate = candidates.find((entry) =>
    selected.every((picked) => colorDistance(entry, picked) >= 46)
  );

  return candidate ?? fallback;
}

function buildPaletteFromPixels(data: Uint8ClampedArray): RGB[] {
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

  for (let index = 0; index < data.length; index += 16) {
    const alpha = data[index + 3];
    if (alpha < 160) {
      continue;
    }

    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const key = `${r >> 4}:${g >> 4}:${b >> 4}`;
    const current = buckets.get(key);

    if (current) {
      current.r += r;
      current.g += g;
      current.b += b;
      current.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const candidates = [...buckets.values()]
    .map((bucket) => {
      const average = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      };
      const hsl = toHsl(average);

      return {
        ...average,
        count: bucket.count,
        saturation: hsl.saturation,
        lightness: hsl.lightness
      };
    })
    .filter((entry) => entry.lightness >= 0.06 && entry.lightness <= 0.82)
    .sort((left, right) => right.count - left.count);

  const darkest =
    candidates
      .filter((entry) => entry.lightness <= 0.42)
      .sort((left, right) =>
        (right.count * (0.9 + right.saturation)) - (left.count * (0.9 + left.saturation))
      )[0] ??
    candidates[0] ?? {
      r: 255,
      g: 107,
      b: 90,
      count: 1,
      saturation: 0.9,
      lightness: 0.5
    };

  const vibrant =
    candidates
      .filter((entry) => entry.saturation >= 0.24)
      .sort((left, right) =>
        (right.count * (1.2 + right.saturation)) - (left.count * (1.2 + left.saturation))
      ) ?? [];

  const muted =
    candidates
      .filter((entry) => entry.saturation >= 0.12)
      .sort((left, right) =>
        (right.count * (0.8 + (1 - Math.abs(right.lightness - 0.45)))) -
        (left.count * (0.8 + (1 - Math.abs(left.lightness - 0.45))))
      ) ?? [];

  const base = adjustColor(darkest, -0.04);
  const highlight = chooseDistinctColor(vibrant, [base], adjustColor(base, 0.22));
  const accent = chooseDistinctColor(vibrant.slice(1), [base, highlight], adjustColor(highlight, -0.08));
  const soft = chooseDistinctColor(muted, [base, highlight, accent], adjustColor(base, 0.18));

  return [base, highlight, accent, soft];
}

async function decodeArtworkToPixels(artworkUrl: string, signal: AbortSignal): Promise<Uint8ClampedArray> {
  const response = await fetch(artworkUrl, { signal });
  if (!response.ok) {
    throw new Error(`Unable to fetch artwork: ${response.status}`);
  }

  const blob = await response.blob();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  canvas.width = 56;
  canvas.height = 56;

  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
  } else {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.decoding = "async";
      image.src = objectUrl;
      await image.decode();
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

export async function extractStreamerVars(
  artworkUrl: string,
  signal: AbortSignal
): Promise<StreamerVars> {
  const pixels = await decodeArtworkToPixels(artworkUrl, signal);
  const [base, highlight, accent, soft] = buildPaletteFromPixels(pixels);

  return {
    "--streamer-color-a": toRgba(base, 0.22),
    "--streamer-color-b": toRgba(highlight, 0.18),
    "--streamer-color-c": toRgba(accent, 0.16),
    "--streamer-color-d": toRgba(soft, 0.14),
    "--streamer-footer-a": toRgba(adjustColor(highlight, 0.04), 0.22),
    "--streamer-footer-b": toRgba(adjustColor(accent, 0.08), 0.16),
    "--streamer-opacity": "0.98",
    "--streamer-footer-opacity": "0.92"
  };
}
