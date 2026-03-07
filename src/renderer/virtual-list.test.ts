import { describe, expect, it } from "vitest";

import { calculateVirtualWindow } from "./virtual-list";

describe("calculateVirtualWindow", () => {
  it("returns an empty window for empty lists", () => {
    expect(calculateVirtualWindow({
      itemCount: 0,
      itemHeight: 72,
      scrollOffset: 0,
      viewportHeight: 400
    })).toEqual({
      startIndex: 0,
      endIndex: -1,
      paddingTop: 0,
      paddingBottom: 0
    });
  });

  it("includes overscan around the visible range", () => {
    expect(calculateVirtualWindow({
      itemCount: 100,
      itemHeight: 50,
      scrollOffset: 500,
      viewportHeight: 200,
      overscan: 2
    })).toEqual({
      startIndex: 8,
      endIndex: 15,
      paddingTop: 400,
      paddingBottom: 4200
    });
  });

  it("clamps to the end of the list", () => {
    expect(calculateVirtualWindow({
      itemCount: 20,
      itemHeight: 60,
      scrollOffset: 5000,
      viewportHeight: 240,
      overscan: 1
    })).toEqual({
      startIndex: 15,
      endIndex: 19,
      paddingTop: 900,
      paddingBottom: 0
    });
  });
});
