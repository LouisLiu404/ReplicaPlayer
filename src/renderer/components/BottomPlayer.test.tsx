// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TrackDetail } from "../../shared/types";
import { BottomPlayer, buildProgressTooltipLeft } from "./BottomPlayer";

const TRACK: TrackDetail = {
  id: "track-1",
  rootId: "root-1",
  path: "/music/example.flac",
  fileName: "example.flac",
  availability: "available",
  durationMs: 300_000,
  bitrate: 1_411_000,
  sampleRate: 44_100,
  bitDepth: 16,
  title: "Example",
  artist: "Artist",
  album: "Album",
  albumArtist: "",
  trackNo: 1,
  discNo: 1,
  year: 2024,
  genre: [],
  artworkUrl: undefined,
  format: "Flac",
  lastIndexedAt: "2026-03-07T00:00:00.000Z"
};

describe("buildProgressTooltipLeft", () => {
  it("clamps the tooltip away from the footer edges", () => {
    expect(buildProgressTooltipLeft(-0.2)).toBe("clamp(56px, 0%, calc(100% - 56px))");
    expect(buildProgressTooltipLeft(0.5)).toBe("clamp(56px, 50%, calc(100% - 56px))");
    expect(buildProgressTooltipLeft(1.2)).toBe("clamp(56px, 100%, calc(100% - 56px))");
  });
});

describe("BottomPlayer", () => {
  it("renders a seek tooltip on hover using the clamped offset", () => {
    const { container } = render(
      <BottomPlayer
        track={TRACK}
        isPlaying={false}
        isExpanded={false}
        isSettingsView={false}
        canPlay
        playbackMode="repeat-all"
        currentTimeMs={0}
        durationMs={TRACK.durationMs}
        volumePercent={100}
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onCyclePlaybackMode={vi.fn()}
        onTogglePanel={vi.fn()}
      />
    );

    const shell = container.querySelector(".bottom-player-progress-shell");
    if (!(shell instanceof HTMLDivElement)) {
      throw new Error("Progress shell not found");
    }

    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 300,
      height: 20,
      top: 0,
      right: 300,
      bottom: 20,
      left: 0,
      toJSON: () => ({})
    });

    fireEvent.pointerEnter(shell, { clientX: 0 });

    expect(screen.getByText("0:00")).toBeTruthy();
  });
});
