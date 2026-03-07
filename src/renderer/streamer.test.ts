import { describe, expect, it } from "vitest";

import { deriveStreamerVarsFromPixels } from "./streamer";

function createPixelBuffer(colors: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const pixelCount = 56 * 56;
  const data = new Uint8ClampedArray(pixelCount * 4);

  for (let index = 0; index < pixelCount; index += 1) {
    const [r, g, b, alpha = 255] = colors[index % colors.length];
    const offset = index * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = alpha;
  }

  return data;
}

function parseRgba(value: string): { r: number; g: number; b: number; alpha: number } {
  const match = value.match(
    /rgba\((?<r>\d+),\s*(?<g>\d+),\s*(?<b>\d+),\s*(?<alpha>[\d.]+)\)/
  );

  if (!match?.groups) {
    throw new Error(`Unexpected rgba value: ${value}`);
  }

  return {
    r: Number.parseFloat(match.groups.r),
    g: Number.parseFloat(match.groups.g),
    b: Number.parseFloat(match.groups.b),
    alpha: Number.parseFloat(match.groups.alpha)
  };
}

function relativeLuminance(red: number, green: number, blue: number): number {
  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    (0.2126 * toLinear(red)) +
    (0.7152 * toLinear(green)) +
    (0.0722 * toLinear(blue))
  );
}

describe("deriveStreamerVarsFromPixels", () => {
  it("adds stronger lift and opacity for dark artwork palettes", () => {
    const darkPixels = createPixelBuffer([
      [34, 22, 18],
      [52, 26, 24],
      [78, 40, 32]
    ]);
    const brightPixels = createPixelBuffer([
      [240, 178, 70],
      [255, 212, 120],
      [227, 120, 80]
    ]);

    const darkVars = deriveStreamerVarsFromPixels(darkPixels);
    const brightVars = deriveStreamerVarsFromPixels(brightPixels);
    const darkHighlight = parseRgba(darkVars["--streamer-color-b"]);

    expect(parseFloat(darkVars["--streamer-footer-opacity"])).toBeGreaterThan(
      parseFloat(brightVars["--streamer-footer-opacity"])
    );
    expect(relativeLuminance(darkHighlight.r, darkHighlight.g, darkHighlight.b)).toBeGreaterThan(0.18);
  });

  it("exposes glass tint vars so panels can stay readable while showing the glow", () => {
    const pixels = createPixelBuffer([
      [18, 48, 64],
      [24, 94, 126],
      [100, 168, 196],
      [184, 220, 236]
    ]);

    const vars = deriveStreamerVarsFromPixels(pixels);
    const tint = parseRgba(vars["--streamer-surface-tint"]);
    const highlight = parseRgba(vars["--streamer-surface-highlight"]);

    expect(tint.alpha).toBeGreaterThan(0.1);
    expect(highlight.alpha).toBeGreaterThan(0.08);
    expect(relativeLuminance(highlight.r, highlight.g, highlight.b)).toBeGreaterThan(
      relativeLuminance(tint.r, tint.g, tint.b)
    );
  });
});
