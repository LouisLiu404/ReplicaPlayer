// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LibraryRoot } from "../../shared/types";
import { NavigationRail } from "./NavigationRail";

afterEach(() => {
  cleanup();
});

const ROOTS: LibraryRoot[] = [
  {
    id: "root-1",
    path: "/Users/liuyike/Music/古风DJ",
    displayName: "古风DJ",
    trackCount: 26,
    status: "available",
    addedAt: "2026-03-06T09:00:00.000Z",
    lastScanAt: "2026-03-06T09:01:00.000Z",
    lastError: null
  }
];

describe("NavigationRail", () => {
  it("shows Loading… for All folders until the aggregate count is ready", () => {
    const { container } = render(
      <NavigationRail
        activeView="library"
        roots={ROOTS}
        selectedRootId=""
        allFoldersTrackCount={null}
        onSelectRoot={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.getByRole("button", { name: /All folders/i }).title).toBe("All folders");
    expect(container.querySelector(".rail-topmark")).toBeNull();
  });

  it("keeps folder scope buttons clickable from the settings view", () => {
    const onSelectRoot = vi.fn();

    render(
      <NavigationRail
        activeView="settings"
        roots={ROOTS}
        selectedRootId=""
        allFoldersTrackCount={26}
        onSelectRoot={onSelectRoot}
        onOpenSettings={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /古风DJ/i }));
    expect(onSelectRoot).toHaveBeenCalledWith("root-1");

    fireEvent.click(screen.getByRole("button", { name: /All folders/i }));
    expect(onSelectRoot).toHaveBeenCalledWith("");

    expect(screen.getByRole("button", { name: /古风DJ/i }).title).toBe(
      "古风DJ — /Users/liuyike/Music/古风DJ"
    );
    expect(screen.getByRole("button", { name: "Settings" }).title).toBe("Settings");
  });
});
