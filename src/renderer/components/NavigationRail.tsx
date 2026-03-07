import type { LibraryRoot } from "../../shared/types";
import type { AppView } from "./ui-types";
import { PlayerGlyph, ReplicaWordmark, SettingsIcon } from "./icons";

interface NavigationRailProps {
  activeView: AppView;
  roots: LibraryRoot[];
  selectedRootId: string;
  allFoldersTrackCount: number | null;
  onSelectRoot: (rootId: string) => void;
  onOpenSettings: () => void;
}

export function NavigationRail({
  activeView,
  roots,
  selectedRootId,
  allFoldersTrackCount,
  onSelectRoot,
  onOpenSettings
}: NavigationRailProps) {
  const allFoldersCopy =
    allFoldersTrackCount == null
      ? "Loading…"
      : `${allFoldersTrackCount} ${allFoldersTrackCount === 1 ? "track" : "tracks"}`;

  return (
    <aside className="navigation-rail">
      <div className="rail-topmark" aria-hidden="true">
        <PlayerGlyph className="rail-topmark-icon" />
        <ReplicaWordmark className="rail-topmark-wordmark" />
      </div>

      <div className="rail-roots">
        <div className="rail-section-header">
          <span>Folders</span>
        </div>

        <button
          type="button"
          className={`rail-root-card ${selectedRootId === "" ? "selected" : ""}`}
          onClick={() => onSelectRoot("")}
        >
          <div>
            <strong>All folders</strong>
            <small>{allFoldersCopy}</small>
          </div>
        </button>

        {roots.length === 0 ? (
          <p className="rail-empty-copy">Import a folder to pin it here.</p>
        ) : (
          <div className="rail-root-list">
            {roots.map((root) => (
              <button
                key={root.id}
                type="button"
                className={`rail-root-card ${selectedRootId === root.id ? "selected" : ""}`}
                onClick={() => onSelectRoot(root.id)}
                title={root.path}
              >
                <strong>{root.displayName}</strong>
                <small>{`${root.trackCount} ${root.trackCount === 1 ? "track" : "tracks"}`}</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rail-footer">
        <button
          type="button"
          className={`rail-footer-button ${activeView === "settings" ? "active" : ""}`}
          onClick={onOpenSettings}
        >
          <SettingsIcon className="rail-nav-icon" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
