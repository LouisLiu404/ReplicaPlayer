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
  "--streamer-surface-tint": string;
  "--streamer-surface-highlight": string;
  "--streamer-shell-wash": string;
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
  "--streamer-surface-tint": "rgba(255, 132, 102, 0.14)",
  "--streamer-surface-highlight": "rgba(255, 210, 146, 0.12)",
  "--streamer-shell-wash": "rgba(255, 168, 95, 0.1)",
  "--streamer-opacity": "0.92",
  "--streamer-footer-opacity": "0.84"
};

type PaletteProfile = {
  base: RGB;
  highlight: RGB;
  accent: RGB;
  soft: RGB;
  averageLightness: number;
  contrastLift: number;
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

function mixColors(left: RGB, right: RGB, ratio: number): RGB {
  const clampedRatio = clamp(ratio, 0, 1);
  return {
    r: (left.r * (1 - clampedRatio)) + (right.r * clampedRatio),
    g: (left.g * (1 - clampedRatio)) + (right.g * clampedRatio),
    b: (left.b * (1 - clampedRatio)) + (right.b * clampedRatio)
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

function toLinearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: RGB): number {
  return (
    (0.2126 * toLinearChannel(color.r)) +
    (0.7152 * toLinearChannel(color.g)) +
    (0.0722 * toLinearChannel(color.b))
  );
}

function ensureMinLuminance(color: RGB, minimum: number): RGB {
  if (relativeLuminance(color) >= minimum) {
    return color;
  }

  let low = 0;
  let high = 1;
  let best = color;

  for (let step = 0; step < 8; step += 1) {
    const ratio = (low + high) / 2;
    const next = mixColors(color, { r: 255, g: 255, b: 255 }, ratio);
    if (relativeLuminance(next) >= minimum) {
      best = next;
      high = ratio;
    } else {
      low = ratio;
    }
  }

  return best;
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

function buildPaletteFromPixels(data: Uint8ClampedArray): PaletteProfile {
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

  const fallbackBucket: Bucket = {
    r: 255,
    g: 107,
    b: 90,
    count: 1,
    saturation: 0.9,
    lightness: 0.5
  };

  const darkest =
    candidates
      .filter((entry) => entry.lightness <= 0.42)
      .sort((left, right) =>
        (right.count * (0.9 + right.saturation)) - (left.count * (0.9 + left.saturation))
      )[0] ??
    candidates[0] ??
    fallbackBucket;

  const vibrant = candidates
    .filter((entry) => entry.saturation >= 0.24)
    .sort((left, right) =>
      (right.count * (1.2 + right.saturation)) - (left.count * (1.2 + left.saturation))
    );

  const muted = candidates
    .filter((entry) => entry.saturation >= 0.12)
    .sort((left, right) =>
      (right.count * (0.8 + (1 - Math.abs(right.lightness - 0.45)))) -
      (left.count * (0.8 + (1 - Math.abs(left.lightness - 0.45))))
    );

  const topCandidates = candidates.slice(0, 24);
  const weightedLightness = topCandidates.length > 0
    ? topCandidates.reduce((sum, candidate) => sum + (candidate.lightness * candidate.count), 0) /
      topCandidates.reduce((sum, candidate) => sum + candidate.count, 0)
    : fallbackBucket.lightness;
  const contrastLift = clamp((0.42 - weightedLightness) / 0.24, 0, 1);

  const baseCandidate = adjustColor(darkest, -0.03 + (contrastLift * 0.02));
  const highlightCandidate = chooseDistinctColor(vibrant, [baseCandidate], adjustColor(baseCandidate, 0.22));
  const accentCandidate = chooseDistinctColor(
    vibrant.slice(1),
    [baseCandidate, highlightCandidate],
    adjustColor(highlightCandidate, -0.06)
  );
  const softCandidate = chooseDistinctColor(
    muted,
    [baseCandidate, highlightCandidate, accentCandidate],
    adjustColor(baseCandidate, 0.18)
  );

  const base = ensureMinLuminance(
    mixColors(baseCandidate, softCandidate, 0.08 + (contrastLift * 0.12)),
    0.04 + (contrastLift * 0.04)
  );
  const highlight = ensureMinLuminance(
    mixColors(highlightCandidate, softCandidate, contrastLift * 0.18),
    0.18 + (contrastLift * 0.17)
  );
  const accent = ensureMinLuminance(
    mixColors(accentCandidate, highlight, 0.08 + (contrastLift * 0.12)),
    0.15 + (contrastLift * 0.13)
  );
  const soft = ensureMinLuminance(
    mixColors(softCandidate, highlight, 0.12 + (contrastLift * 0.18)),
    0.12 + (contrastLift * 0.12)
  );

  return {
    base,
    highlight,
    accent,
    soft,
    averageLightness: weightedLightness,
    contrastLift
  };
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

export function deriveStreamerVarsFromPixels(pixels: Uint8ClampedArray): StreamerVars {
  const {
    base,
    highlight,
    accent,
    soft,
    averageLightness,
    contrastLift
  } = buildPaletteFromPixels(pixels);

  const darkArtworkBias = clamp((0.46 - averageLightness) / 0.22, 0, 1);
  const luminousHighlight = ensureMinLuminance(
    mixColors(highlight, { r: 255, g: 255, b: 255 }, 0.14 + (darkArtworkBias * 0.28)),
    0.36 + (contrastLift * 0.16)
  );
  const footerHighlight = mixColors(highlight, luminousHighlight, 0.36 + (contrastLift * 0.14));
  const footerAccent = mixColors(accent, luminousHighlight, 0.2 + (contrastLift * 0.12));
  const surfaceTint = mixColors(base, soft, 0.5);
  const surfaceHighlight = mixColors(luminousHighlight, soft, 0.28);
  const shellWash = mixColors(luminousHighlight, { r: 255, g: 255, b: 255 }, 0.12 + (darkArtworkBias * 0.08));

  return {
    "--streamer-color-a": toRgba(base, 0.24 + (contrastLift * 0.08)),
    "--streamer-color-b": toRgba(highlight, 0.2 + (contrastLift * 0.08)),
    "--streamer-color-c": toRgba(accent, 0.18 + (contrastLift * 0.08)),
    "--streamer-color-d": toRgba(soft, 0.16 + (contrastLift * 0.08)),
    "--streamer-footer-a": toRgba(footerHighlight, 0.26 + (darkArtworkBias * 0.12)),
    "--streamer-footer-b": toRgba(footerAccent, 0.2 + (darkArtworkBias * 0.1)),
    "--streamer-surface-tint": toRgba(surfaceTint, 0.14 + (darkArtworkBias * 0.08)),
    "--streamer-surface-highlight": toRgba(surfaceHighlight, 0.12 + (darkArtworkBias * 0.08)),
    "--streamer-shell-wash": toRgba(shellWash, 0.1 + (darkArtworkBias * 0.06)),
    "--streamer-opacity": (0.94 + (darkArtworkBias * 0.16)).toFixed(2),
    "--streamer-footer-opacity": (0.88 + (darkArtworkBias * 0.18)).toFixed(2)
  };
}

export async function extractStreamerVars(
  artworkUrl: string,
  signal: AbortSignal
): Promise<StreamerVars> {
  const pixels = await decodeArtworkToPixels(artworkUrl, signal);
  return deriveStreamerVarsFromPixels(pixels);
}
