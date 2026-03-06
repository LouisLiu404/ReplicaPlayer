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

export function LibraryHero({
  currentRootLabel,
  isLoading,
  visibleTrackCount,
  filterCounts,
  activeFilter,
  libraryMessage,
  onFilterChange
}: LibraryHeroProps) {
  const filters: Array<{ id: AvailabilityFilter; label: string; count: number }> = [
    { id: "all", label: "All", count: filterCounts.all },
    { id: "available", label: "Available", count: filterCounts.available },
    { id: "missing", label: "Missing", count: filterCounts.missing },
    { id: "offline", label: "Unavailable", count: filterCounts.offline }
  ];
  const visibleFilters = filters.filter(
    (filter) => filter.id === "all" || filter.id === "available" || filter.count > 0 || activeFilter === filter.id
  );

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

      <p className="library-summary-copy">{libraryMessage}</p>

      {filterCounts.missing > 0 || filterCounts.offline > 0 ? (
        <div className="hero-note-row">
          {filterCounts.missing > 0 ? (
            <div className="hero-note-pill warning">
              <strong>{filterCounts.missing}</strong>
              <span>missing files need a rescan or cleanup</span>
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
    </section>
  );
}
