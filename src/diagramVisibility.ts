/**
 * Set of cluster ids the user chose to hide from the diagram (and PDF export) — a view preference, not
 * content, but persisted server-side as part of the owning diagram record (see store.tsx) since it now
 * needs to travel with the diagram, not just the browser. This file only holds the shared type.
 */
export type HiddenClusterIds = Record<string, true>;

/** Set of individual article ids hidden from the diagram (bulk-hide from the article list) — same deal. */
export type HiddenArticleIds = Record<string, true>;
