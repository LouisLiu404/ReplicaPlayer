import type { ActivePanelTab } from "./components/ui-types";

export const DEFAULT_EXPANDED_TAB: ActivePanelTab = "lyrics";
export const DEFAULT_EXPANDED_TAB_STORAGE_KEY = "replica-player:default-expanded-tab";

export function readStoredDefaultExpandedTab(
  storage: Pick<Storage, "getItem"> | null
): ActivePanelTab {
  if (!storage) {
    return DEFAULT_EXPANDED_TAB;
  }

  try {
    const raw = storage.getItem(DEFAULT_EXPANDED_TAB_STORAGE_KEY);
    if (raw === "queue" || raw === "lyrics" || raw === "details") {
      return raw;
    }
  } catch {
    return DEFAULT_EXPANDED_TAB;
  }

  return DEFAULT_EXPANDED_TAB;
}
