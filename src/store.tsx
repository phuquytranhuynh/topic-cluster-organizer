import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Article, ArticleRole, ImportResult, StoreData, TopicCluster } from "./types";
import { normalizeKey, type RawCsvRow } from "./csv";

const STORAGE_KEY = "topic-cluster-organizer:data:v1";

function loadInitial(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoreData;
  } catch {
    // ignore corrupt storage, fall back to empty
  }
  return { clusters: [], articles: [] };
}

function persist(data: StoreData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — data still lives in memory for this session
  }
}

function newId(): string {
  return crypto.randomUUID();
}

export interface AddArticleInput {
  title: string;
  url: string;
  clusterName: string;
  role: ArticleRole;
  /** title of the pillar article this supports, within the same cluster (ignored for pillar role) */
  pillarOf?: string;
  notes?: string;
}

interface StoreApi {
  data: StoreData;
  clusters: TopicCluster[];
  articles: Article[];
  addArticle: (input: AddArticleInput) => Article;
  updateArticle: (id: string, patch: Partial<AddArticleInput>) => void;
  deleteArticle: (id: string) => void;
  importRows: (rows: RawCsvRow[]) => ImportResult;
  clusterPillars: (clusterId: string) => Article[];
  replaceAll: (data: StoreData) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function findClusterByName(clusters: TopicCluster[], name: string): TopicCluster | undefined {
  const key = normalizeKey(name);
  return clusters.find((c) => normalizeKey(c.name) === key);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(loadInitial);

  const commit = useCallback((updater: (prev: StoreData) => StoreData) => {
    setData((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const getOrCreateCluster = (clusters: TopicCluster[], name: string): [TopicCluster, TopicCluster[]] => {
    const existing = findClusterByName(clusters, name);
    if (existing) return [existing, clusters];
    const cluster: TopicCluster = { id: newId(), name: name.trim(), createdAt: new Date().toISOString() };
    return [cluster, [...clusters, cluster]];
  };

  const addArticle = useCallback(
    (input: AddArticleInput): Article => {
      let created!: Article;
      commit((prev) => {
        const [cluster, clusters] = getOrCreateCluster(prev.clusters, input.clusterName);
        let linksTo: string | null = null;
        if (input.role === "supporting") {
          const clusterArticles = prev.articles.filter((a) => a.clusterId === cluster.id);
          if (input.pillarOf) {
            const pillarKey = normalizeKey(input.pillarOf);
            linksTo = clusterArticles.find((a) => normalizeKey(a.title) === pillarKey)?.id ?? null;
          } else {
            const pillars = clusterArticles.filter((a) => a.role === "pillar");
            if (pillars.length === 1) linksTo = pillars[0].id;
          }
        }
        const now = new Date().toISOString();
        const article: Article = {
          id: newId(),
          title: input.title.trim(),
          url: input.url.trim(),
          clusterId: cluster.id,
          role: input.role,
          linksTo,
          notes: input.notes?.trim() ?? "",
          createdAt: now,
          updatedAt: now,
        };
        created = article;
        return { clusters, articles: [...prev.articles, article] };
      });
      return created;
    },
    [commit]
  );

  const updateArticle = useCallback(
    (id: string, patch: Partial<AddArticleInput>) => {
      commit((prev) => {
        const target = prev.articles.find((a) => a.id === id);
        if (!target) return prev;
        let clusters = prev.clusters;
        let clusterId = target.clusterId;
        if (patch.clusterName) {
          const [cluster, nextClusters] = getOrCreateCluster(clusters, patch.clusterName);
          clusters = nextClusters;
          clusterId = cluster.id;
        }
        let linksTo = target.linksTo;
        const role = patch.role ?? target.role;
        if (role === "pillar") {
          linksTo = null;
        } else if (patch.pillarOf !== undefined) {
          const pillarKey = normalizeKey(patch.pillarOf);
          linksTo = pillarKey
            ? prev.articles.find((a) => a.clusterId === clusterId && normalizeKey(a.title) === pillarKey)?.id ?? null
            : null;
        }
        const articles = prev.articles.map((a) =>
          a.id === id
            ? {
                ...a,
                title: patch.title?.trim() ?? a.title,
                url: patch.url?.trim() ?? a.url,
                notes: patch.notes?.trim() ?? a.notes,
                clusterId,
                role,
                linksTo,
                updatedAt: new Date().toISOString(),
              }
            : a
        );
        return { clusters, articles };
      });
    },
    [commit]
  );

  const deleteArticle = useCallback(
    (id: string) => {
      commit((prev) => ({
        clusters: prev.clusters,
        articles: prev.articles
          .filter((a) => a.id !== id)
          .map((a) => (a.linksTo === id ? { ...a, linksTo: null } : a)),
      }));
    },
    [commit]
  );

  const importRows = useCallback(
    (rows: RawCsvRow[]): ImportResult => {
      const errors: string[] = [];
      let importedClusters = 0;
      let importedArticles = 0;

      commit((prev) => {
        let clusters = [...prev.clusters];
        let articles = [...prev.articles];
        const clusterSizeBefore = clusters.length;

        // pass 1: ensure clusters + pillar/plain articles exist so pass 2 can resolve pillarOf links
        for (const row of rows) {
          const [cluster, nextClusters] = getOrCreateCluster(clusters, row.cluster);
          if (nextClusters.length !== clusters.length) importedClusters++;
          clusters = nextClusters;

          const dupeKey = normalizeKey(row.title);
          const already = articles.find(
            (a) => a.clusterId === cluster.id && normalizeKey(a.title) === dupeKey
          );
          if (already) continue;

          const now = new Date().toISOString();
          articles.push({
            id: newId(),
            title: row.title,
            url: row.url,
            clusterId: cluster.id,
            role: row.role,
            linksTo: null,
            notes: "",
            createdAt: now,
            updatedAt: now,
          });
          importedArticles++;
        }

        // pass 2: resolve supporting -> pillar links now that all rows exist
        articles = articles.map((a) => {
          if (a.role !== "supporting" || a.linksTo) return a;
          const row = rows.find(
            (r) => normalizeKey(r.title) === normalizeKey(a.title) && normalizeKey(r.cluster) === normalizeKey(clusters.find((c) => c.id === a.clusterId)?.name ?? "")
          );
          const clusterArticles = articles.filter((x) => x.clusterId === a.clusterId);
          if (row?.pillarOf) {
            const pillarKey = normalizeKey(row.pillarOf);
            const match = clusterArticles.find((x) => normalizeKey(x.title) === pillarKey);
            if (match) return { ...a, linksTo: match.id };
          }
          const pillars = clusterArticles.filter((x) => x.role === "pillar");
          if (pillars.length === 1) return { ...a, linksTo: pillars[0].id };
          return a;
        });

        importedClusters = clusters.length - clusterSizeBefore;
        return { clusters, articles };
      });

      return { importedClusters, importedArticles, errors };
    },
    [commit]
  );

  const clusterPillars = useCallback(
    (clusterId: string) => data.articles.filter((a) => a.clusterId === clusterId && a.role === "pillar"),
    [data.articles]
  );

  const replaceAll = useCallback(
    (next: StoreData) => {
      commit(() => next);
    },
    [commit]
  );

  const resetAll = useCallback(() => {
    commit(() => ({ clusters: [], articles: [] }));
  }, [commit]);

  const value = useMemo<StoreApi>(
    () => ({
      data,
      clusters: data.clusters,
      articles: data.articles,
      addArticle,
      updateArticle,
      deleteArticle,
      importRows,
      clusterPillars,
      replaceAll,
      resetAll,
    }),
    [data, addArticle, updateArticle, deleteArticle, importRows, clusterPillars, replaceAll, resetAll]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
