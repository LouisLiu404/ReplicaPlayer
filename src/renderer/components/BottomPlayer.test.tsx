// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it("uses the artwork as the only expanded-player control", () => {
    const onTogglePanel = vi.fn();
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
        showLyricsTools={false}
        lyricsSource={null}
        lyricsHaveTranslations={false}
        showLyricTranslations
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onToggleLyricTranslations={vi.fn()}
        onCyclePlaybackMode={vi.fn()}
        onTogglePanel={onTogglePanel}
      />
    );

    const expandButton = screen.getByRole("button", { name: "Expand player" });
    expect(container.querySelector(".panel-expand-button")).toBeNull();
    fireEvent.click(expandButton);
    expect(onTogglePanel).toHaveBeenCalledOnce();
  });

  it("keeps volume compact and reports changes from the hover popover", () => {
    const onVolumeChange = vi.fn();
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
        volumePercent={80}
        showLyricsTools={false}
        lyricsSource={null}
        lyricsHaveTranslations={false}
        showLyricTranslations
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={onVolumeChange}
        onToggleLyricTranslations={vi.fn()}
        onCyclePlaybackMode={vi.fn()}
        onTogglePanel={vi.fn()}
      />
    );

    const slider = container.querySelector(".volume-slider");
    if (!(slider instanceof HTMLInputElement)) {
      throw new Error("Volume slider not found");
    }
    expect(container.querySelector(".volume-popover")).not.toBeNull();
    expect(screen.getByText("80%")).toBeTruthy();

    fireEvent.change(slider, { target: { value: "42" } });
    expect(onVolumeChange).toHaveBeenCalledWith(42);
  });

  it("places lyric controls beside volume while the expanded lyrics view is active", () => {
    const onToggleLyricTranslations = vi.fn();
    render(
      <BottomPlayer
        track={TRACK}
        isPlaying={false}
        isExpanded
        isSettingsView={false}
        canPlay
        playbackMode="repeat-all"
        currentTimeMs={0}
        durationMs={TRACK.durationMs}
        volumePercent={80}
        showLyricsTools
        lyricsSource="Embed"
        lyricsHaveTranslations
        showLyricTranslations
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onToggleLyricTranslations={onToggleLyricTranslations}
        onCyclePlaybackMode={vi.fn()}
        onTogglePanel={vi.fn()}
      />
    );

    expect(screen.getByText("embed")).toBeTruthy();
    const translationToggle = screen.getByRole("button", { name: "Hide lyric translation" });
    fireEvent.click(translationToggle);
    expect(onToggleLyricTranslations).toHaveBeenCalledOnce();
  });

  it("throttles pointer move updates via requestAnimationFrame", () => {
    let lastRafCallback: FrameRequestCallback | null = null;
    let rafId = 0;
    const cancelledIds = new Set<number>();

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      lastRafCallback = cb;
      rafId++;
      return rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      cancelledIds.add(id);
    });

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
        showLyricsTools={false}
        lyricsSource={null}
        lyricsHaveTranslations={false}
        showLyricTranslations
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onToggleLyricTranslations={vi.fn()}
        onCyclePlaybackMode={vi.fn()}
        onTogglePanel={vi.fn()}
      />
    );

    const shell = container.querySelector(".bottom-player-progress-shell");
    if (!(shell instanceof HTMLDivElement)) {
      throw new Error("Progress shell not found");
    }

    vi.spyOn(shell, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 300, height: 20,
      top: 0, right: 300, bottom: 20, left: 0,
      toJSON: () => ({})
    });

    // Multiple rapid pointer moves — each cancels the previous rAF
    fireEvent.pointerMove(shell, { clientX: 50 });
    fireEvent.pointerMove(shell, { clientX: 100 });
    fireEvent.pointerMove(shell, { clientX: 150 });

    // Previous rAF IDs should have been cancelled (including initial ref value 0)
    expect(cancelledIds.size).toBeGreaterThanOrEqual(2);

    // No tooltip yet — rAF callback hasn't fired
    expect(screen.queryByText("2:30")).toBeNull();

    // Flush the last pending callback
    expect(lastRafCallback).not.toBeNull();
    act(() => {
      lastRafCallback!(0);
    });

    // Tooltip should show the last position's time (150/300 * 300000 = 150000ms = 2:30)
    expect(screen.getByText("2:30")).toBeTruthy();

    vi.restoreAllMocks();
  });

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
        showLyricsTools={false}
        lyricsSource={null}
        lyricsHaveTranslations={false}
        showLyricTranslations
        canStepPrev
        canStepNext
        onStepPrev={vi.fn()}
        onStepNext={vi.fn()}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onVolumeChange={vi.fn()}
        onToggleLyricTranslations={vi.fn()}
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

    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    fireEvent.pointerEnter(shell, { clientX: 0 });

    expect(screen.getByText("0:00")).toBeTruthy();

    rafSpy.mockRestore();
  });
});
