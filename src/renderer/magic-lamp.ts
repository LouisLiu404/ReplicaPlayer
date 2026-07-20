export interface MagicLampMesh {
  positions: Float32Array<ArrayBuffer>;
  textureCoordinates: Float32Array<ArrayBuffer>;
  indices: Uint16Array<ArrayBuffer>;
}

export interface MagicLampRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MagicLampPoint {
  x: number;
  y: number;
}

export const MAGIC_LAMP_COLUMNS = 36;
export const MAGIC_LAMP_ROWS = 28;
export const MAGIC_LAMP_NECK_SPLIT = 0.3;
export const MAGIC_LAMP_BEND_STRENGTH = 0.12;

export function createMagicLampMesh(
  columns = MAGIC_LAMP_COLUMNS,
  rows = MAGIC_LAMP_ROWS
): MagicLampMesh {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) {
    throw new Error("Magic lamp mesh dimensions must be positive integers");
  }

  const vertexCount = (columns + 1) * (rows + 1);
  if (vertexCount > 65_535) {
    throw new Error("Magic lamp mesh exceeds the 16-bit index limit");
  }

  const positions = new Float32Array(vertexCount * 2);
  const textureCoordinates = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(columns * rows * 6);

  let vertexOffset = 0;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      positions[vertexOffset] = u;
      textureCoordinates[vertexOffset] = u;
      positions[vertexOffset + 1] = v;
      textureCoordinates[vertexOffset + 1] = v;
      vertexOffset += 2;
    }
  }

  let indexOffset = 0;
  const stride = columns + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const topLeft = row * stride + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + stride;
      const bottomRight = bottomLeft + 1;

      indices[indexOffset] = topLeft;
      indices[indexOffset + 1] = bottomLeft;
      indices[indexOffset + 2] = topRight;
      indices[indexOffset + 3] = topRight;
      indices[indexOffset + 4] = bottomLeft;
      indices[indexOffset + 5] = bottomRight;
      indexOffset += 6;
    }
  }

  return { positions, textureCoordinates, indices };
}

export function easeMagicLampProgress(progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  return clamped * clamped * (3 - (2 * clamped));
}

/**
 * CPU reference for the vertex shader. The first phase pulls the lower edge
 * into a narrow neck; the second drains the remaining surface through it.
 */
export function deformMagicLampVertex(
  horizontalPosition: number,
  verticalPosition: number,
  progress: number,
  source: MagicLampRect,
  target: MagicLampRect
): MagicLampPoint {
  const tx = Math.min(Math.max(horizontalPosition, 0), 1);
  const ty = Math.min(Math.max(verticalPosition, 0), 1);
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const neckProgress = Math.min(clampedProgress / MAGIC_LAMP_NECK_SPLIT, 1);
  const drainProgress = Math.max(
    (clampedProgress - MAGIC_LAMP_NECK_SPLIT) / (1 - MAGIC_LAMP_NECK_SPLIT),
    0
  );

  const gapToReceiver = target.y - source.y - source.height;
  const fullHeight = Math.max(
    target.y - source.y - (gapToReceiver * (1 - neckProgress)),
    1
  );
  const remainingHeight = fullHeight * (1 - drainProgress);
  const localY = ty * remainingHeight;
  const widthDelta = source.width - target.width;
  const localX =
    (tx * target.width) +
    (tx * widthDelta * (1 - drainProgress) * (1 - ty)) +
    (tx * widthDelta * (1 - neckProgress) * ty);
  const targetOffsetX = target.x - source.x;
  const horizontalOffset =
    (targetOffsetX * (localY / fullHeight) * neckProgress) +
    (targetOffsetX * drainProgress);
  const verticalOffset =
    target.y - source.y - remainingHeight - (gapToReceiver * (1 - neckProgress));
  const bendPhase = ((remainingHeight - localY) / fullHeight) * Math.PI * 2 + Math.PI;
  const sourceX = source.x + (source.width * tx);
  const targetX = target.x + (target.width * tx);
  const bend =
    Math.sin(bendPhase) *
    (sourceX - targetX) *
    MAGIC_LAMP_BEND_STRENGTH *
    neckProgress;

  return {
    x: source.x + localX + horizontalOffset + bend,
    y: source.y + localY + verticalOffset
  };
}

export function receiverOpacity(direction: "expand" | "collapse", progress: number): number {
  const clamped = Math.min(Math.max(progress, 0), 1);
  if (direction === "collapse") {
    return Math.min(Math.max((clamped - 0.72) / 0.28, 0), 1);
  }

  return 1 - Math.min(clamped / 0.24, 1);
}
