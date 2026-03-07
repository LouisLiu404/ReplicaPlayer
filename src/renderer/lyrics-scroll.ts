function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateCenteredLyricScrollTop(args: {
  containerHeight: number;
  scrollHeight: number;
  itemOffsetTop: number;
  itemHeight: number;
}): number {
  const { containerHeight, scrollHeight, itemOffsetTop, itemHeight } = args;
  const maxScrollTop = Math.max(scrollHeight - containerHeight, 0);
  const centeredScrollTop = itemOffsetTop - (containerHeight / 2) + (itemHeight / 2);
  return clamp(Math.round(centeredScrollTop), 0, maxScrollTop);
}

export function scrollLyricsContainer(
  container: HTMLDivElement,
  activeElement: HTMLDivElement
): void {
  const nextScrollTop = calculateCenteredLyricScrollTop({
    containerHeight: container.clientHeight,
    scrollHeight: container.scrollHeight,
    itemOffsetTop: activeElement.offsetTop,
    itemHeight: activeElement.offsetHeight
  });

  if (Math.abs(container.scrollTop - nextScrollTop) < 1) {
    return;
  }

  container.scrollTo({
    top: nextScrollTop,
    behavior: "smooth"
  });
}
