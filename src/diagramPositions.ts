/**
 * Manual drag overrides, keyed by node id (article id, or the synthetic `cluster-<id>` root of a
 * pillar-less cluster). Persisted server-side as part of the owning diagram record (see store.tsx) —
 * this file only holds the shared type now.
 */
export type PositionOverrides = Record<string, { x: number; y: number }>;
