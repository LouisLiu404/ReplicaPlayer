import type { RefObject } from "react";

import type { LibraryRoot } from "../../shared/types";
import { DiscIcon, FolderIcon, LibraryIcon, ReplicaMark } from "./icons";

interface NavigationRailProps {
  roots: LibraryRoot[];
  selectedRootId: string;
  visibleTrackCount: number;
  rootSectionRef: RefObject<HTMLDivElement | null>;
  onSelectRoot: (rootId: string) => void;
  onRemoveRoot: (rootId: string) => void;
  onJumpToFolders: () => void;
  onOpenNowPlaying: () => void;
}

export function NavigationRail({
  roots,
  selectedRootId,
  visibleTrackCount,
  rootSectionRef,
  onSelectRoot,
  onRemoveRoot,
  onJumpToFolders,
  onOpenNowPlaying
}: NavigationRailProps) {
  return (
    <aside className="navigation-rail">
      <div className="rail-brand">
        <ReplicaMark className="rail-brand-mark" />
        <div className="rail-brand-copy">
          <strong>Replica</strong>
          <span>Player</span>
        </div>
      </div>

      <nav className="rail-nav" aria-label="Primary">
        <button type="button" className="rail-nav-button active">
          <LibraryIcon className="rail-nav-icon" />
          <span>Library</span>
        </button>
        <button type="button" className="rail-nav-button" onClick={onJumpToFolders}>
          <FolderIcon className="rail-nav-icon" />
          <span>Folders</span>
        </button>
        <button type="button" className="rail-nav-button" onClick={onOpenNowPlaying}>
          <DiscIcon className="rail-nav-icon" />
          <span>Now Playing</span>
        </button>
      </nav>

      <div className="rail-roots" ref={rootSectionRef}>
        <div className="rail-section-header">
          <span>Folders</span>
          <strong>{roots.length}</strong>
        </div>

        <button
          type="button"
          className={`rail-root-card ${selectedRootId === "" ? "selected" : ""}`}
          onClick={() => onSelectRoot("")}
        >
          <div>
            <strong>All folders</strong>
            <small>{visibleTrackCount} visible tracks</small>
          </div>
        </button>

        {roots.length === 0 ? (
          <p className="rail-empty-copy">Import a folder to pin it here.</p>
        ) : (
          <div className="rail-root-list">
            {roots.map((root) => (
              <div key={root.id} className={`rail-root-card ${selectedRootId === root.id ? "selected" : ""}`}>
                <button
                  type="button"
                  className="rail-root-button"
                  onClick={() => onSelectRoot(root.id)}
                  title={root.path}
                >
                  <strong>{root.displayName}</strong>
                  <small>{root.status === "available" ? "Available" : "Offline"}</small>
                </button>
                <button
                  type="button"
                  className="rail-root-remove"
                  onClick={() => onRemoveRoot(root.id)}
                  aria-label={`Remove ${root.displayName}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
