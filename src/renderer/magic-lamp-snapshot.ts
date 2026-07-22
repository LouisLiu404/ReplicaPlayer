const MAX_CAPTURE_ROWS = 18;
const CAPTURE_OVERSCAN_PX = 36;

interface ScrollCaptureGroup {
  scrollSelector: string;
  rowSelector: string;
}

interface CaptureSource {
  node: HTMLDivElement;
  dispose: () => void;
}

const SCROLL_CAPTURE_GROUPS: ScrollCaptureGroup[] = [
  {
    scrollSelector: ".lyrics-scroll.synced-lyrics",
    rowSelector: ".lyric-line-group"
  },
  {
    scrollSelector: ".queue-list",
    rowSelector: ".queue-row"
  }
];

function intersectsViewport(rowRect: DOMRect, viewportRect: DOMRect): boolean {
  return rowRect.bottom >= viewportRect.top - CAPTURE_OVERSCAN_PX &&
    rowRect.top <= viewportRect.bottom + CAPTURE_OVERSCAN_PX;
}

function positionVisibleRows(
  sourceScroll: HTMLElement,
  captureScroll: HTMLElement,
  rowSelector: string
): void {
  const sourceRows = Array.from(sourceScroll.querySelectorAll<HTMLElement>(rowSelector));
  const captureRows = Array.from(captureScroll.querySelectorAll<HTMLElement>(rowSelector));
  const viewportRect = sourceScroll.getBoundingClientRect();

  if (
    sourceRows.length !== captureRows.length ||
    viewportRect.width < 1 ||
    viewportRect.height < 1
  ) {
    return;
  }

  captureScroll.querySelectorAll(".virtual-spacer").forEach((spacer) => spacer.remove());
  captureScroll.style.display = "block";
  captureScroll.style.position = "relative";
  captureScroll.style.width = `${viewportRect.width}px`;
  captureScroll.style.height = `${viewportRect.height}px`;
  captureScroll.style.padding = "0";
  captureScroll.style.overflow = "hidden";

  captureRows.forEach((captureRow, index) => {
    const rowRect = sourceRows[index].getBoundingClientRect();
    if (!intersectsViewport(rowRect, viewportRect)) {
      captureRow.remove();
      return;
    }

    captureRow.style.position = "absolute";
    captureRow.style.inset = "auto";
    captureRow.style.top = `${rowRect.top - viewportRect.top}px`;
    captureRow.style.left = `${rowRect.left - viewportRect.left}px`;
    captureRow.style.width = `${rowRect.width}px`;
    captureRow.style.height = `${rowRect.height}px`;
    captureRow.style.margin = "0";
    captureRow.style.transform = "none";
  });
}

/**
 * html-to-image copies the computed style of every descendant. For long lyric
 * files that can block the renderer for hundreds of milliseconds even though
 * almost all of those rows are clipped by the scroll viewport. Build a hidden,
 * pixel-aligned capture source containing only rows that can actually be seen.
 */
export function createMagicLampCaptureSource(
  source: HTMLDivElement,
  sourceRect: DOMRect
): CaptureSource {
  const shouldBoundCapture = SCROLL_CAPTURE_GROUPS.some(({ scrollSelector, rowSelector }) => {
    const scroll = source.querySelector<HTMLElement>(scrollSelector);
    return (scroll?.querySelectorAll(rowSelector).length ?? 0) > MAX_CAPTURE_ROWS;
  });

  if (!shouldBoundCapture || !source.parentElement) {
    return {
      node: source,
      dispose: () => undefined
    };
  }

  const captureSource = source.cloneNode(true) as HTMLDivElement;
  captureSource.setAttribute("aria-hidden", "true");
  captureSource.setAttribute("inert", "");
  captureSource.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  captureSource.style.position = "fixed";
  captureSource.style.inset = "auto";
  captureSource.style.left = `${sourceRect.left}px`;
  captureSource.style.top = `${sourceRect.top}px`;
  captureSource.style.width = `${sourceRect.width}px`;
  captureSource.style.height = `${sourceRect.height}px`;
  captureSource.style.zIndex = "-1";
  captureSource.style.opacity = "0";
  captureSource.style.pointerEvents = "none";
  captureSource.style.transition = "none";

  for (const { scrollSelector, rowSelector } of SCROLL_CAPTURE_GROUPS) {
    const sourceScroll = source.querySelector<HTMLElement>(scrollSelector);
    const captureScroll = captureSource.querySelector<HTMLElement>(scrollSelector);
    if (sourceScroll && captureScroll) {
      positionVisibleRows(sourceScroll, captureScroll, rowSelector);
    }
  }

  source.parentElement.appendChild(captureSource);

  return {
    node: captureSource,
    dispose: () => captureSource.remove()
  };
}
