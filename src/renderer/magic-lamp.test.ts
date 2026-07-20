import { describe, expect, it } from "vitest";

import {
  createMagicLampMesh,
  deformMagicLampVertex,
  easeMagicLampProgress,
  MAGIC_LAMP_COLUMNS,
  MAGIC_LAMP_NECK_SPLIT,
  MAGIC_LAMP_ROWS,
  receiverOpacity
} from "./magic-lamp";

describe("magic lamp geometry", () => {
  it("builds a normalized textured grid", () => {
    const mesh = createMagicLampMesh(2, 1);

    expect(Array.from(mesh.positions)).toEqual([
      0, 0,
      0.5, 0,
      1, 0,
      0, 1,
      0.5, 1,
      1, 1
    ]);
    expect(mesh.textureCoordinates).toEqual(mesh.positions);
    expect(Array.from(mesh.indices)).toEqual([
      0, 3, 1,
      1, 3, 4,
      1, 4, 2,
      2, 4, 5
    ]);
  });

  it("rejects invalid mesh sizes", () => {
    expect(() => createMagicLampMesh(0, 4)).toThrow();
    expect(() => createMagicLampMesh(4.5, 4)).toThrow();
  });

  it("uses a dense mesh for a smooth curved silhouette", () => {
    expect(MAGIC_LAMP_COLUMNS).toBeGreaterThanOrEqual(35);
    expect(MAGIC_LAMP_ROWS).toBeGreaterThanOrEqual(28);
  });

  it("forms a neck at the receiver before draining the window", () => {
    const source = { x: 0, y: 0, width: 1000, height: 600 };
    const target = { x: 40, y: 660, width: 64, height: 64 };
    const topLeft = deformMagicLampVertex(0, 0, MAGIC_LAMP_NECK_SPLIT, source, target);
    const topRight = deformMagicLampVertex(1, 0, MAGIC_LAMP_NECK_SPLIT, source, target);
    const bottomLeft = deformMagicLampVertex(0, 1, MAGIC_LAMP_NECK_SPLIT, source, target);
    const bottomRight = deformMagicLampVertex(1, 1, MAGIC_LAMP_NECK_SPLIT, source, target);

    expect(topLeft.x).toBeCloseTo(source.x);
    expect(topLeft.y).toBeCloseTo(source.y);
    expect(topRight.x - topLeft.x).toBeCloseTo(source.width);
    expect(bottomLeft.x).toBeCloseTo(target.x);
    expect(bottomLeft.y).toBeCloseTo(target.y);
    expect(bottomRight.x - bottomLeft.x).toBeCloseTo(target.width);
  });

  it("bows the surface between the source and the receiver", () => {
    const source = { x: 0, y: 0, width: 1000, height: 600 };
    const target = { x: 40, y: 660, width: 64, height: 64 };
    const rightTop = deformMagicLampVertex(1, 0, MAGIC_LAMP_NECK_SPLIT, source, target);
    const rightQuarter = deformMagicLampVertex(1, 0.25, MAGIC_LAMP_NECK_SPLIT, source, target);
    const rightBottom = deformMagicLampVertex(1, 1, MAGIC_LAMP_NECK_SPLIT, source, target);
    const linearQuarterX = rightTop.x + ((rightBottom.x - rightTop.x) * 0.25);

    expect(Math.abs(rightQuarter.x - linearQuarterX)).toBeGreaterThan(50);
  });

  it("squashes every row through the receiver boundary", () => {
    const source = { x: 0, y: 0, width: 1000, height: 600 };
    const target = { x: 40, y: 660, width: 64, height: 64 };

    for (const verticalPosition of [0, 0.25, 0.5, 0.75, 1]) {
      const point = deformMagicLampVertex(0.6, verticalPosition, 1, source, target);
      expect(point.x).toBeCloseTo(target.x + (target.width * 0.6));
      expect(point.y).toBeCloseTo(target.y);
    }
  });

  it("clamps easing and receiver fades", () => {
    expect(easeMagicLampProgress(-1)).toBe(0);
    expect(easeMagicLampProgress(0.25)).toBe(0.15625);
    expect(easeMagicLampProgress(0.5)).toBe(0.5);
    expect(easeMagicLampProgress(0.75)).toBe(0.84375);
    expect(easeMagicLampProgress(2)).toBe(1);
    expect(receiverOpacity("collapse", 0.7)).toBe(0);
    expect(receiverOpacity("collapse", 1)).toBe(1);
    expect(receiverOpacity("expand", 0)).toBe(1);
    expect(receiverOpacity("expand", 1)).toBe(0);
  });
});
