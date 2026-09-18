const STORAGE_KEY = "topic-cluster-organizer:positions:v1";

/** Manual drag overrides, keyed by node id (article id, or the synthetic `cluster-<id>` root of a pillar-less cluster). */
export type PositionOverrides = Record<string, { x: number; y: number }>;

export function loadPositions(): PositionOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PositionOverrides;
  } catch {
    // ignore corrupt storage, fall back to no overrides
  }
  return {};
}

export function savePositions(positions: PositionOverrides) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // storage full/unavailable — dragged positions just won't persist this session
  }
}

export function clearPositions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
