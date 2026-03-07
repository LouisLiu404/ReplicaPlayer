import { describe, expect, it } from "vitest";

import { calculatePulseLevel, smoothPulse } from "./visualizer";

describe("visualizer helpers", () => {
  it("returns no pulse for silence", () => {
    expect(calculatePulseLevel(new Uint8Array(64))).toBe(0);
  });

  it("returns a stronger pulse for louder low-mid energy", () => {
    const quiet = new Uint8Array(64).fill(36);
    const loud = new Uint8Array(64).fill(170);

    expect(calculatePulseLevel(loud)).toBeGreaterThan(calculatePulseLevel(quiet));
  });

  it("smoothly rises and decays pulse intensity", () => {
    const rising = smoothPulse(0.1, 0.8, true);
    const decaying = smoothPulse(0.5, 0, false);

    expect(rising).toBeGreaterThan(0.1);
    expect(rising).toBeLessThan(0.8);
    expect(decaying).toBeLessThan(0.5);
    expect(decaying).toBeGreaterThanOrEqual(0);
  });
});
