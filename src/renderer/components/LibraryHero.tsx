import type { ScanProgress } from "../../shared/types";
import type { AvailabilityFilter } from "./ui-types";
import { scanPhaseLabel } from "../utils";

interface FilterCounts {
  all: number;
  available: number;
  missing: number;
  offline: number;
}

interface LibraryHeroProps {
  currentRootLabel: string;
  isLoading: boolean;
  visibleTrackCount: number;
  filterCounts: FilterCounts;
  activeFilter: AvailabilityFilter;
  libraryMessage: string;
  scanProgress: ScanProgress | null;
  onFilterChange: (filter: AvailabilityFilter) => void;
}

const FILTERS: Array<{ id: AvailabilityFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "missing", label: "Missing" },
  { id: "offline", label: "Offline" }
];

export function LibraryHero({
  currentRootLabel,
  isLoading,
  visibleTrackCount,
  filterCounts,
  activeFilter,
  libraryMessage,
  scanProgress,
  onFilterChange
}: LibraryHeroProps) {
  const phaseLabel = scanPhaseLabel(scanProgress?.phase);
  const phaseDetail = scanProgress
    ? `${scanProgress.processedFiles} / ${scanProgress.discoveredFiles} indexed`
    : "Persistent local library";

  return (
    <section className="library-hero">
      <div className="library-hero-copy">
        <p className="section-kicker">Library</p>
        <div className="library-hero-headline">
          <h1>{currentRootLabel}</h1>
          <span className="hero-count-pill">{isLoading ? "Loading…" : `${visibleTrackCount} tracks`}</span>
        </div>
        <p className="library-hero-description">
          Search your local collection, keep it indexed between launches, and jump between queue, lyrics, and details without leaving the player.
        </p>
      </div>

      <div className="hero-status-banner">
        <div>
          <strong>{phaseLabel}</strong>
          <p>{libraryMessage}</p>
        </div>
        <span>{phaseDetail}</span>
      </div>

      <div className="filter-chip-row" role="tablist" aria-label="Track availability filters">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`filter-chip ${activeFilter === filter.id ? "active" : ""}`}
            onClick={() => onFilterChange(filter.id)}
          >
            <span>{filter.label}</span>
            <strong>{filterCounts[filter.id]}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
