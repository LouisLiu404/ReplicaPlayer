import type { TrackSortOption } from "../shared/types";

export const DEFAULT_TRACK_SORT: TrackSortOption = "title-asc";
export const TRACK_SORT_STORAGE_KEY = "replica-player:track-sort";

export function readStoredTrackSort(storage: Pick<Storage, "getItem"> | null): TrackSortOption {
  if (!storage) {
    return DEFAULT_TRACK_SORT;
  }

  try {
    const raw = storage.getItem(TRACK_SORT_STORAGE_KEY);
    if (
      raw === "title-asc" ||
      raw === "title-desc" ||
      raw === "modified-asc" ||
      raw === "modified-desc"
    ) {
      return raw;
    }
  } catch {
    return DEFAULT_TRACK_SORT;
  }

  return DEFAULT_TRACK_SORT;
}
