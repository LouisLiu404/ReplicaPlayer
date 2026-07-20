// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LyricPayload, TrackDetail } from "../../shared/types";
import { DEFAULT_STREAMER_VARS } from "../streamer";
import { ExpandedPlayer } from "./ExpandedPlayer";

const TRACK: TrackDetail = {
  id: "track-1",
  rootId: "root-1",
  path: "/music/frozen.flac",
  fileName: "frozen.flac",
  availability: "available",
  durationMs: 224_000,
  bitrate: 1_411_000,
  sampleRate: 44_100,
  bitDepth: 16,
  title: "Let It Go (English Version)",
  artist: "Idina Menzel",
  album: "Frozen",
  albumArtist: "Idina Menzel",
  trackNo: 1,
  discNo: 1,
  year: 2026,
  genre: ["Soundtrack"],
  artworkUrl: undefined,
  format: "Flac",
  lastIndexedAt: "2026-03-07T00:00:00.000Z"
};

const SYNCED_TRANSLATED_LYRICS: LyricPayload = {
  mode: "synced",
  source: "embedded-synced",
  offsetMs: 0,
  lines: [
    {
      startMs: 0,
      text: "The cold never bothered me anyway 严寒再也无法干扰我"
    }
  ]
};

afterEach(() => {
  cleanup();
});

describe("ExpandedPlayer lyrics header", () => {
  it("presents local track identity and supports arrow-key tab navigation", () => {
    const onTabChange = vi.fn();

    const { container } = render(
      <ExpandedPlayer
        activeTab="lyrics"
        selectedTrackId="track-1"
        queueTracks={[]}
        queueStartIndex={-1}
        trackDetail={TRACK}
        lyrics={SYNCED_TRANSLATED_LYRICS}
        activeLyricLine={0}
        streamerVars={DEFAULT_STREAMER_VARS}
        isPlaying={true}
        onSelectTrack={vi.fn()}
        onTabChange={onTabChange}
        setLyricRef={vi.fn()}
        setLyricsScrollRef={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: TRACK.title })).toBeTruthy();
    expect(screen.queryByText("Now playing locally")).toBeNull();
    expect(screen.getByText(TRACK.artist)).toBeTruthy();
    expect(screen.getByText(TRACK.album)).toBeTruthy();
    expect(container.querySelector(".record-platter")).toBeTruthy();
    expect(container.querySelector(".record-deck.is-playing")).toBeTruthy();
    expect(container.querySelector(".tonearm-assembly")).toBeTruthy();
    expect(
      (container.querySelector(".expanded-player") as HTMLElement).style.getPropertyValue("--expanded-play-state")
    ).toBe("running");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Lyrics" }), { key: "ArrowRight" });

    expect(onTabChange).toHaveBeenCalledWith("queue");
  });

  it("shows an embed badge and lets translation lines be toggled", () => {
    render(
      <ExpandedPlayer
        activeTab="lyrics"
        selectedTrackId="track-1"
        queueTracks={[]}
        queueStartIndex={-1}
        trackDetail={TRACK}
        lyrics={SYNCED_TRANSLATED_LYRICS}
        activeLyricLine={0}
        streamerVars={DEFAULT_STREAMER_VARS}
        isPlaying={false}
        onSelectTrack={vi.fn()}
        onTabChange={vi.fn()}
        setLyricRef={vi.fn()}
        setLyricsScrollRef={vi.fn()}
      />
    );

    expect(screen.getByText("embed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide lyric translation" })).toBeTruthy();
    expect(screen.getByText("严寒再也无法干扰我")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide lyric translation" }));

    expect(screen.getByRole("button", { name: "Show lyric translation" })).toBeTruthy();
    expect(screen.queryByText("严寒再也无法干扰我")).toBeNull();
    expect(screen.getByText("The cold never bothered me anyway")).toBeTruthy();
  });

  it("hides the translation toggle when the synced lyrics have no translation text", () => {
    render(
      <ExpandedPlayer
        activeTab="lyrics"
        selectedTrackId="track-1"
        queueTracks={[]}
        queueStartIndex={-1}
        trackDetail={TRACK}
        lyrics={{
          mode: "synced",
          source: "external-lrc",
          offsetMs: 0,
          lines: [{ startMs: 0, text: "Plain synced line" }]
        }}
        activeLyricLine={0}
        streamerVars={DEFAULT_STREAMER_VARS}
        isPlaying={false}
        onSelectTrack={vi.fn()}
        onTabChange={vi.fn()}
        setLyricRef={vi.fn()}
        setLyricsScrollRef={vi.fn()}
      />
    );

    expect(screen.getByText("external")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /translation/i })).toBeNull();
  });
});
