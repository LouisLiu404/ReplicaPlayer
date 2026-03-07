export interface VirtualWindow {
  startIndex: number;
  endIndex: number;
  paddingTop: number;
  paddingBottom: number;
}

interface VirtualWindowParams {
  itemCount: number;
  itemHeight: number;
  scrollOffset: number;
  viewportHeight: number;
  overscan?: number;
}

const DEFAULT_OVERSCAN = 6;
const DEFAULT_VISIBLE_ROWS = 14;

export function calculateVirtualWindow({
  itemCount,
  itemHeight,
  scrollOffset,
  viewportHeight,
  overscan = DEFAULT_OVERSCAN
}: VirtualWindowParams): VirtualWindow {
  if (itemCount <= 0 || itemHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: -1,
      paddingTop: 0,
      paddingBottom: 0
    };
  }

  const safeViewportHeight = viewportHeight > 0
    ? viewportHeight
    : itemHeight * DEFAULT_VISIBLE_ROWS;
  const totalHeight = itemCount * itemHeight;
  const maxScrollOffset = Math.max(0, totalHeight - safeViewportHeight);
  const clampedScrollOffset = Math.min(Math.max(scrollOffset, 0), maxScrollOffset);

  const visibleStartIndex = Math.floor(clampedScrollOffset / itemHeight);
  const visibleEndIndex = Math.min(
    itemCount - 1,
    Math.ceil((clampedScrollOffset + safeViewportHeight) / itemHeight) - 1
  );

  const startIndex = Math.max(0, visibleStartIndex - overscan);
  const endIndex = Math.min(itemCount - 1, visibleEndIndex + overscan);

  return {
    startIndex,
    endIndex,
    paddingTop: startIndex * itemHeight,
    paddingBottom: Math.max(0, totalHeight - ((endIndex + 1) * itemHeight))
  };
}
