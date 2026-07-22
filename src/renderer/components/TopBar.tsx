import { memo } from "react";

import type { RefObject } from "react";

import type { ScanProgress } from "../../shared/types";
import { SearchIcon } from "./icons";

interface TopBarProps {
  search: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scanProgress: ScanProgress | null;
  currentRootLabel: string;
  visibleTrackCount: number;
  isLoading: boolean;
  isLibraryScrolled: boolean;
  onSearchChange: (value: string) => void;
}

export const TopBar = memo(function TopBar({
  search,
  searchInputRef,
  scanProgress,
  currentRootLabel,
  visibleTrackCount,
  isLoading,
  isLibraryScrolled,
  onSearchChange
}: TopBarProps) {
  const isScanActive =
    scanProgress?.phase === "queued" ||
    scanProgress?.phase === "scanning-root" ||
    scanProgress?.phase === "parsing-file";
  const progressRatio = scanProgress && scanProgress.discoveredFiles > 0
    ? Math.min(scanProgress.processedFiles / scanProgress.discoveredFiles, 1)
    : 0.08;

  return (
    <header className={`top-bar ${isLibraryScrolled ? "library-context-visible" : ""}`}>
      <div className="top-bar-trailing">
        <div className="top-bar-context" aria-hidden={!isLibraryScrolled}>
          <strong title={currentRootLabel}>{currentRootLabel}</strong>
          <span>{isLoading ? "Loading…" : `${visibleTrackCount} tracks`}</span>
        </div>

        {isScanActive ? (
          <div className="scan-pill" aria-label="Library scan progress">
            <div className="scan-pill-copy">
              <strong>{scanProgress.phase === "queued" ? "Queued" : "Scanning library"}</strong>
              <span>{`${scanProgress.processedFiles} / ${scanProgress.discoveredFiles || "?"} files`}</span>
            </div>
            <div className="scan-pill-track" aria-hidden="true">
              <div className="scan-pill-fill" style={{ width: `${Math.max(progressRatio * 100, 8)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="top-bar-leading">
        <label className={`top-search ${search.length > 0 ? "has-value" : ""}`} aria-label="Search tracks">
          <SearchIcon className="top-search-icon" />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by title, artist, album, or file name"
          />
        </label>
      </div>
    </header>
  );
});
