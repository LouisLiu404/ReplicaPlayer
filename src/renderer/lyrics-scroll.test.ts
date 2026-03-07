import { describe, expect, it } from "vitest";

import { calculateCenteredLyricScrollTop } from "./lyrics-scroll";

describe("calculateCenteredLyricScrollTop", () => {
  it("centers the active lyric line within the lyrics scroller", () => {
    expect(
      calculateCenteredLyricScrollTop({
        containerHeight: 400,
        scrollHeight: 1200,
        itemOffsetTop: 520,
        itemHeight: 80
      })
    ).toBe(360);
  });

  it("clamps near the start and end of the lyrics list", () => {
    expect(
      calculateCenteredLyricScrollTop({
        containerHeight: 400,
        scrollHeight: 1200,
        itemOffsetTop: 20,
        itemHeight: 40
      })
    ).toBe(0);

    expect(
      calculateCenteredLyricScrollTop({
        containerHeight: 400,
        scrollHeight: 1200,
        itemOffsetTop: 1100,
        itemHeight: 60
      })
    ).toBe(800);
  });
});
