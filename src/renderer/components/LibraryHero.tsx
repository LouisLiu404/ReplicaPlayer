import { memo } from "react";

import type { AvailabilityFilter } from "./ui-types";

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
  onFilterChange: (filter: AvailabilityFilter) => void;
}

export const LibraryHero = memo(function LibraryHero({
  currentRootLabel,
  isLoading,
  visibleTrackCount,
  filterCounts,
  activeFilter,
  libraryMessage,
  onFilterChange
}: LibraryHeroProps) {
  const filters: Array<{ id: AvailabilityFilter; label: string; count: number }> = [
    { id: "missing", label: "Missing", count: filterCounts.missing },
    { id: "offline", label: "Unavailable", count: filterCounts.offline }
  ];
  const visibleFilters = filters.filter((filter) => filter.count > 0 || activeFilter === filter.id);

  return (
    <section className="library-hero">
      <div className="library-hero-copy">
        <p className="section-kicker">Library</p>
        <div className="library-hero-headline">
          <h1>{currentRootLabel}</h1>
          <span className="hero-count-pill">{isLoading ? "Loading…" : `${visibleTrackCount} tracks`}</span>
        </div>
      </div>

      <p className="library-summary-copy">{libraryMessage}</p>

      {filterCounts.missing > 0 || filterCounts.offline > 0 ? (
        <div className="hero-note-row">
          {filterCounts.missing > 0 ? (
            <div className="hero-note-pill warning">
              <strong>{filterCounts.missing}</strong>
              <span>missing tracks can be removed from the library after review</span>
            </div>
          ) : null}
          {filterCounts.offline > 0 ? (
            <div className="hero-note-pill">
              <strong>{filterCounts.offline}</strong>
              <span>tracks are inside a saved folder that is unavailable</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleFilters.length > 0 ? (
        <div className="filter-chip-row" role="tablist" aria-label="Track availability filters">
          {visibleFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`filter-chip ${activeFilter === filter.id ? "active" : ""}`}
              onClick={() => onFilterChange(filter.id)}
            >
              <span>{filter.label}</span>
              <strong>{filter.count}</strong>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
});
