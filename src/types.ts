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
