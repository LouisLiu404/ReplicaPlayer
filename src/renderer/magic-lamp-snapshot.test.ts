// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import { createMagicLampCaptureSource } from "./magic-lamp-snapshot";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({})
  } as DOMRect;
}

function buildLyricsSource(lineCount: number): HTMLDivElement {
  const shell = document.createElement("div");
  const source = document.createElement("div");
  source.className = "expanded-player-overlay open";
  const scroll = document.createElement("div");
  scroll.className = "lyrics-scroll synced-lyrics";

  for (let index = 0; index < lineCount; index += 1) {
    const line = document.createElement("div");
    line.id = `lyric-${index}`;
    line.className = "lyric-line-group";
    line.textContent = `Line ${index}`;
    line.getBoundingClientRect = () => rect(420, index * 50, 360, 40);
    scroll.appendChild(line);
  }

  scroll.getBoundingClientRect = () => rect(400, 100, 400, 200);
  source.appendChild(scroll);
  shell.appendChild(source);
  document.body.appendChild(shell);
  return source;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createMagicLampCaptureSource", () => {
  it("keeps the live player untouched and bounds long lyric captures to visible rows", () => {
    const source = buildLyricsSource(30);
    const capture = createMagicLampCaptureSource(source, rect(0, 0, 1280, 596));

    expect(capture.node).not.toBe(source);
    expect(source.querySelectorAll(".lyric-line-group")).toHaveLength(30);

    const capturedRows = Array.from(
      capture.node.querySelectorAll<HTMLElement>(".lyric-line-group")
    );
    expect(capturedRows.length).toBeGreaterThan(0);
    expect(capturedRows.length).toBeLessThan(30);
    expect(capturedRows.every((row) => row.style.position === "absolute")).toBe(true);
    expect(capture.node.querySelector("[id]")).toBeNull();
    expect(capture.node.parentElement).toBe(source.parentElement);

    capture.dispose();
    expect(capture.node.isConnected).toBe(false);
  });

  it("captures small player trees directly", () => {
    const source = buildLyricsSource(8);
    const capture = createMagicLampCaptureSource(source, rect(0, 0, 1280, 596));

    expect(capture.node).toBe(source);
    capture.dispose();
    expect(source.isConnected).toBe(true);
  });
});
