import type { RefObject } from "react";

import type { LibraryRoot } from "../../shared/types";
import { PanelIcon, PlusIcon, RefreshIcon, SearchIcon } from "./icons";

interface TopBarProps {
  roots: LibraryRoot[];
  search: string;
  selectedRootId: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  statusLabel: string;
  statusTone: "idle" | "active" | "success" | "error";
  statusDetail: string;
  onSearchChange: (value: string) => void;
  onSelectRoot: (value: string) => void;
  onAddRoots: () => void;
  onRescan: () => void;
  onTogglePanel: () => void;
}

export function TopBar({
  roots,
  search,
  selectedRootId,
  searchInputRef,
  statusLabel,
  statusTone,
  statusDetail,
  onSearchChange,
  onSelectRoot,
  onAddRoots,
  onRescan,
  onTogglePanel
}: TopBarProps) {
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
        <div className={`status-pill tone-${statusTone}`}>
          <span className="status-pill-dot" />
          <div className="status-pill-copy">
            <strong>{statusLabel}</strong>
            <span>{statusDetail}</span>
          </div>
        </div>

        <button type="button" className="top-icon-button panel-toggle-button" onClick={onTogglePanel} aria-label="Toggle side panel">
          <PanelIcon />
        </button>
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
