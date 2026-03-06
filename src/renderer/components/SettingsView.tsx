import type { LibraryRoot, ScanProgress } from "../../shared/types";
import { scanPhaseLabel } from "../utils";
import { EmptyState } from "./EmptyState";
import { FolderIcon, PlusIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsViewProps {
  roots: LibraryRoot[];
  scanProgress: ScanProgress | null;
  onAddRoots: () => void;
  onRescan: () => void;
  onRemoveRoot: (rootId: string) => void;
}

export function SettingsView({
  roots,
  scanProgress,
  onAddRoots,
  onRescan,
  onRemoveRoot
}: SettingsViewProps) {
  return (
    <section className="settings-view">
      <div className="settings-hero">
        <div>
          <p className="section-kicker">Settings</p>
          <h1>Tracked folders</h1>
          <p className="settings-copy">
            Configure the local folders Replica Player keeps indexed between launches. Library rescans also live here.
          </p>
        </div>

        <div className="settings-actions">
          <button type="button" className="cta-button" onClick={onAddRoots}>
            <PlusIcon />
            <span>Add Folders</span>
          </button>
          <button type="button" className="cta-button secondary" onClick={onRescan} disabled={roots.length === 0}>
            <RefreshIcon />
            <span>Rescan</span>
          </button>
        </div>
      </div>

      {scanProgress ? (
        <div className="settings-scan-banner">
          <strong>{scanPhaseLabel(scanProgress.phase)}</strong>
          <span>{scanProgress.message ?? `${scanProgress.processedFiles} / ${scanProgress.discoveredFiles} files`}</span>
        </div>
      ) : null}

      {roots.length === 0 ? (
        <EmptyState
          title="No tracked folders"
          description="Add a folder to build the library. Replica Player indexes music in place and remembers it next launch."
          actionLabel="Add Folders"
          onAction={onAddRoots}
          icon={<SettingsIcon className="empty-state-glyph" />}
        />
      ) : (
        <div className="settings-root-list">
          {roots.map((root) => (
            <article key={root.id} className="settings-root-card">
              <div className="settings-root-icon">
                <FolderIcon className="settings-root-glyph" />
              </div>
              <div className="settings-root-copy">
                <strong>{root.displayName}</strong>
                <span>{root.path}</span>
                <small>{root.status === "available" ? "Available" : root.lastError || "Unavailable"}</small>
              </div>
              <button
                type="button"
                className="settings-remove-button"
                onClick={() => onRemoveRoot(root.id)}
                aria-label={`Remove ${root.displayName}`}
              >
                Remove
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
