import type { MouseEvent } from "react";

import type { LibraryRoot, ScanProgress, TrackSortOption } from "../../shared/types";
import type { ActivePanelTab } from "./ui-types";
import { scanPhaseLabel } from "../utils";
import { EmptyState } from "./EmptyState";
import { FolderIcon, PlusIcon, RefreshIcon, SettingsIcon } from "./icons";

interface SettingsViewProps {
  roots: LibraryRoot[];
  scanProgress: ScanProgress | null;
  defaultExpandedTab: ActivePanelTab;
  trackSort: TrackSortOption;
  onAddRoots: () => void;
  onRescan: () => void;
  onRemoveRoot: (rootId: string) => void;
  onDefaultExpandedTabChange: (tab: ActivePanelTab) => void;
  onTrackSortChange: (sort: TrackSortOption) => void;
  onOpenExternal: (url: string) => void;
}

const MISANS_DOWNLOAD_URL = "https://hyperos.mi.com/font/en/download/";
const MISANS_LICENSE_URL = "https://hyperos.mi.com/font-download/MiSans%E5%AD%97%E4%BD%93%E7%9F%A5%E8%AF%86%E4%BA%A7%E6%9D%83%E8%AE%B8%E5%8F%AF%E5%8D%8F%E8%AE%AE.pdf";

export function SettingsView({
  roots,
  scanProgress,
  defaultExpandedTab,
  trackSort,
  onAddRoots,
  onRescan,
  onRemoveRoot,
  onDefaultExpandedTabChange,
  onTrackSortChange,
  onOpenExternal
}: SettingsViewProps) {
  const expandedTabOptions: Array<{ id: ActivePanelTab; label: string; description: string }> = [
    { id: "queue", label: "Up Next", description: "Open the queue first." },
    { id: "lyrics", label: "Lyrics", description: "Open synced or plain lyrics first." },
    { id: "details", label: "Details", description: "Open technical metadata first." }
  ];
  const trackSortOptions: Array<{ id: TrackSortOption; label: string; description: string }> = [
    { id: "title-asc", label: "Title A-Z", description: "Sort tracks alphabetically by title." },
    { id: "title-desc", label: "Title Z-A", description: "Sort tracks in reverse alphabetical title order." },
    { id: "modified-asc", label: "Oldest first", description: "Sort by file modified date from oldest to newest." },
    { id: "modified-desc", label: "Newest first", description: "Sort by file modified date from newest to oldest." }
  ];

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

      <section className="settings-section-card" aria-labelledby="expanded-player-default-tab">
        <div className="settings-section-copy">
          <h2 id="expanded-player-default-tab">Expanded player default tab</h2>
          <p>Choose which panel opens first when you expand the player from the bottom bar.</p>
        </div>

        <div className="settings-tab-option-row" role="radiogroup" aria-label="Expanded player default tab">
          {expandedTabOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={defaultExpandedTab === option.id}
              className={`settings-tab-option ${defaultExpandedTab === option.id ? "active" : ""}`}
              onClick={() => onDefaultExpandedTabChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section-card" aria-labelledby="track-sort-default">
        <div className="settings-section-copy">
          <h2 id="track-sort-default">Track list sort</h2>
          <p>Choose the default ordering for library and folder track lists.</p>
        </div>

        <div className="settings-tab-option-row" role="radiogroup" aria-label="Track list sort">
          {trackSortOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={trackSort === option.id}
              className={`settings-tab-option ${trackSort === option.id ? "active" : ""}`}
              onClick={() => onTrackSortChange(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      </section>

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
