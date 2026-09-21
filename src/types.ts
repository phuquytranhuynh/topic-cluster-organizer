export type ArticleRole = "pillar" | "supporting";

export interface TopicCluster {
  id: string;
  name: string;
  createdAt: string;
  /** custom color override for every bubble in this cluster (hex, e.g. "#2563eb"); null/absent uses the auto-generated color */
  color?: string | null;
}

export interface Article {
  id: string;
  title: string;
  url: string;
  clusterId: string;
  role: ArticleRole;
  /** id of the pillar article this one supports; null for pillar articles or unlinked supporting articles */
  linksTo: string | null;
  /** monthly search volume for this keyword/topic, shown under the title in the diagram; null if unknown */
  volume: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  /** custom bubble radius (px) override; null/absent uses the auto depth-based default */
  radiusOverride?: number | null;
  /** custom title font size (px) override; null/absent scales automatically with the bubble's radius */
  fontSizeOverride?: number | null;
  /** custom max characters per wrapped title line; null/absent scales automatically with the bubble's radius */
  maxCharsOverride?: number | null;
  /** custom reserved margin (px) around this bubble for its label to overshoot into; null/absent uses the default */
  labelPaddingOverride?: number | null;
}

export interface StoreData {
  clusters: TopicCluster[];
  articles: Article[];
  /** user-chosen name for this diagram, used as the base filename when exporting PDF/CSV/JSON */
  diagramName?: string;
}

export interface ImportResult {
  importedClusters: number;
  importedArticles: number;
  errors: string[];
}
