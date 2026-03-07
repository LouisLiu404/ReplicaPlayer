import type { MouseEvent } from "react";

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
  onOpenExternal: (url: string) => void;
}

const MISANS_DOWNLOAD_URL = "https://hyperos.mi.com/font/en/download/";
const MISANS_LICENSE_URL = "https://hyperos.mi.com/font-download/MiSans%E5%AD%97%E4%BD%93%E7%9F%A5%E8%AF%86%E4%BA%A7%E6%9D%83%E8%AE%B8%E5%8F%AF%E5%8D%8F%E8%AE%AE.pdf";

export function SettingsView({
  roots,
  scanProgress,
  onAddRoots,
  onRescan,
  onRemoveRoot,
  onOpenExternal
}: SettingsViewProps) {
  function handleExternalLinkClick(
    event: MouseEvent<HTMLAnchorElement>,
    url: string
  ): void {
    event.preventDefault();
    onOpenExternal(url);
  }

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

      <section className="settings-notice-card" aria-labelledby="misans-notice-title">
        <h2 id="misans-notice-title">MiSans Font Notice (Xiaomi)</h2>
        <p>
          Replica Player uses MiSans fonts. Xiaomi&apos;s MiSans font license requires software to clearly indicate MiSans usage.
        </p>
        <p>
          Key conditions include no adaptation or redevelopment of MiSans font files, no standalone rental, sublicense,
          distribution, or sale of MiSans font files, keeping the copyright notice and agreement with MiSans font copies,
          and no illegal use.
        </p>
        <p className="settings-notice-label">Official sources</p>
        <div className="settings-notice-links">
          <a href={MISANS_DOWNLOAD_URL} onClick={(event) => handleExternalLinkClick(event, MISANS_DOWNLOAD_URL)}>
            Xiaomi MiSans download page
          </a>
          <a href={MISANS_LICENSE_URL} onClick={(event) => handleExternalLinkClick(event, MISANS_LICENSE_URL)}>
            Xiaomi MiSans license agreement (PDF)
          </a>
        </div>
      </section>
    </section>
  );
}
