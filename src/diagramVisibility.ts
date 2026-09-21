const STORAGE_KEY = "topic-cluster-organizer:hidden-clusters:v1";

/** Set of cluster ids the user chose to hide from the diagram (and PDF export) — a view preference, not content. */
export type HiddenClusterIds = Record<string, true>;

export function loadHiddenClusters(): HiddenClusterIds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HiddenClusterIds;
  } catch {
    // ignore corrupt storage, fall back to nothing hidden
  }
  return {};
}

export function saveHiddenClusters(hidden: HiddenClusterIds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
  } catch {
    // storage full or unavailable — hide state still lives in memory for this session
  }
}
