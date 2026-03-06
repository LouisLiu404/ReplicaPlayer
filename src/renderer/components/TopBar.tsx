import type { RefObject } from "react";

import type { LibraryRoot, ScanProgress } from "../../shared/types";
import { PlusIcon, RefreshIcon, SearchIcon } from "./icons";

interface TopBarProps {
  roots: LibraryRoot[];
  search: string;
  selectedRootId: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  scanProgress: ScanProgress | null;
  onSearchChange: (value: string) => void;
  onSelectRoot: (value: string) => void;
  onAddRoots: () => void;
  onRescan: () => void;
}

export function TopBar({
  roots,
  search,
  selectedRootId,
  searchInputRef,
  scanProgress,
  onSearchChange,
  onSelectRoot,
  onAddRoots,
  onRescan
}: TopBarProps) {
  const isScanActive =
    scanProgress?.phase === "queued" ||
    scanProgress?.phase === "scanning-root" ||
    scanProgress?.phase === "parsing-file";
  const progressRatio = scanProgress && scanProgress.discoveredFiles > 0
    ? Math.min(scanProgress.processedFiles / scanProgress.discoveredFiles, 1)
    : 0.08;

  return (
    <header className="top-bar">
      <div className="top-bar-leading">
        <label className="top-search" aria-label="Search tracks">
          <SearchIcon className="top-search-icon" />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by title, artist, album, or file name"
          />
        </label>

        <label className="root-select-shell">
          <span>Scope</span>
          <select value={selectedRootId} onChange={(event) => onSelectRoot(event.target.value)}>
            <option value="">All folders</option>
            {roots.map((root) => (
              <option key={root.id} value={root.id}>
                {root.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="top-bar-trailing">
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

        <button type="button" className="cta-button" onClick={onAddRoots}>
          <PlusIcon />
          <span>Add Folders</span>
        </button>
        <button type="button" className="cta-button secondary" onClick={onRescan} disabled={roots.length === 0}>
          <RefreshIcon />
          <span>Rescan</span>
        </button>
      </div>
    </header>
  );
}
