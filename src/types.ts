export type ArticleRole = "pillar" | "supporting";

export interface TopicCluster {
  id: string;
  name: string;
  createdAt: string;
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
}

export interface StoreData {
  clusters: TopicCluster[];
  articles: Article[];
}

export interface ImportResult {
  importedClusters: number;
  importedArticles: number;
  errors: string[];
}
