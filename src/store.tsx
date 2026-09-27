import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Article, ArticleRole, ImportResult, StoreData, TopicCluster } from "./types";
import { normalizeKey, type RawCsvRow } from "./csv";
import { ApiError, getDiagram, updateDiagram } from "./api";
import type { PositionOverrides } from "./diagramPositions";
import type { HiddenArticleIds, HiddenClusterIds } from "./diagramVisibility";

function newId(): string {
  return crypto.randomUUID();
}

export interface AddArticleInput {
  title: string;
  url: string;
  clusterName: string;
  role: ArticleRole;
  /**
   * Title of the article this one hangs off of, searched across ALL clusters (not just this one).
   * For a Supporting article this is normally a Pillar in the same cluster (auto-linked if omitted
   * and the cluster has exactly one Pillar). For a Pillar article, setting this chains its whole
   * cluster onto a node in another cluster — the mechanism used to build multi-level topic maps.
   */
  pillarOf?: string;
  notes?: string;
  /** monthly search volume for this keyword/topic, shown under the title in the diagram */
  volume?: number | null;
}

/** Per-article visual customizations for its diagram bubble — see the matching Article fields. */
export type ArticleDisplayOverrides = Partial<
  Pick<Article, "radiusOverride" | "fontSizeOverride" | "maxCharsOverride" | "labelPaddingOverride">
>;

/** Full round-trip shape for JSON export/import — content plus the view-only extras it now travels with. */
export interface ReplaceAllInput extends StoreData {
  positions?: PositionOverrides | null;
  hiddenClusterIds?: HiddenClusterIds | null;
  hiddenArticleIds?: HiddenArticleIds | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Updater<T> = T | ((prev: T) => T);
function resolveUpdater<T>(next: Updater<T>, prev: T): T {
  return typeof next === "function" ? (next as (p: T) => T)(prev) : next;
}

interface StoreApi {
  diagramId: string;
  loading: boolean;
  loadError: string | null;
  saveStatus: SaveStatus;

  data: StoreData;
  clusters: TopicCluster[];
  articles: Article[];
  positions: PositionOverrides;
  hiddenClusterIds: HiddenClusterIds;
  hiddenArticleIds: HiddenArticleIds;
  setPositions: (next: Updater<PositionOverrides>) => void;
  setHiddenClusterIds: (next: Updater<HiddenClusterIds>) => void;
  setHiddenArticleIds: (next: Updater<HiddenArticleIds>) => void;

  addArticle: (input: AddArticleInput) => Article;
  updateArticle: (id: string, patch: Partial<AddArticleInput>) => void;
  deleteArticle: (id: string) => void;
  /** Deletes every listed cluster and all of its articles in one commit (used to delete a whole chain). */
  deleteClusters: (clusterIds: string[]) => void;
  /** Deletes every listed article in one commit (used for bulk-select delete in the article list). */
  deleteArticles: (ids: string[]) => void;
  importRows: (rows: RawCsvRow[]) => ImportResult;
  clusterPillars: (clusterId: string) => Article[];
  updateClusterColor: (clusterId: string, color: string | null) => void;
  updateArticlesDisplay: (patchByArticleId: Record<string, ArticleDisplayOverrides>) => void;
  setDiagramName: (name: string) => void;
  replaceAll: (data: ReplaceAllInput) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

function findClusterByName(clusters: TopicCluster[], name: string): TopicCluster | undefined {
  const key = normalizeKey(name);
  return clusters.find((c) => normalizeKey(c.name) === key);
}

const SAVE_DEBOUNCE_MS = 700;

export function StoreProvider({ diagramId, children }: { diagramId: string; children: ReactNode }) {
  const [content, setContent] = useState<StoreData>({ clusters: [], articles: [] });
  const [positions, setPositionsState] = useState<PositionOverrides>({});
  const [hiddenClusterIds, setHiddenClusterIdsState] = useState<HiddenClusterIds>({});
  const [hiddenArticleIds, setHiddenArticleIdsState] = useState<HiddenArticleIds>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Set right after a (re)load lands, so the save-effect below can tell "this render is fresh data
  // from the server" apart from "the user actually changed something" and skip saving the former
  // straight back to the server it just came from.
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getDiagram(diagramId)
      .then(({ diagram }) => {
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setContent({ clusters: diagram.clusters, articles: diagram.articles, diagramName: diagram.name });
        setPositionsState(diagram.positions ?? {});
        setHiddenClusterIdsState(diagram.hiddenClusterIds ?? {});
        setHiddenArticleIdsState(diagram.hiddenArticleIds ?? {});
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Không tải được sơ đồ.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loading) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(() => {
      updateDiagram(diagramId, {
        name: content.diagramName,
        clusters: content.clusters,
        articles: content.articles,
        positions,
        hiddenClusterIds,
        hiddenArticleIds,
      })
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [content, positions, hiddenClusterIds, hiddenArticleIds, diagramId, loading]);

  const commit = useCallback((updater: (prev: StoreData) => StoreData) => {
    setContent((prev) => updater(prev));
  }, []);

  const setPositions = useCallback((next: Updater<PositionOverrides>) => {
    setPositionsState((prev) => resolveUpdater(next, prev));
  }, []);
  const setHiddenClusterIds = useCallback((next: Updater<HiddenClusterIds>) => {
    setHiddenClusterIdsState((prev) => resolveUpdater(next, prev));
  }, []);
  const setHiddenArticleIds = useCallback((next: Updater<HiddenArticleIds>) => {
    setHiddenArticleIdsState((prev) => resolveUpdater(next, prev));
  }, []);

  const getOrCreateCluster = (clusters: TopicCluster[], name: string): [TopicCluster, TopicCluster[]] => {
    const existing = findClusterByName(clusters, name);
    if (existing) return [existing, clusters];
    const cluster: TopicCluster = { id: newId(), name: name.trim(), createdAt: new Date().toISOString(), color: null };
    return [cluster, [...clusters, cluster]];
  };

  const addArticle = useCallback(
    (input: AddArticleInput): Article => {
      let created!: Article;
      commit((prev) => {
        const [cluster, clusters] = getOrCreateCluster(prev.clusters, input.clusterName);
        let linksTo: string | null = null;
        if (input.pillarOf) {
          const pillarKey = normalizeKey(input.pillarOf);
          linksTo = prev.articles.find((a) => normalizeKey(a.title) === pillarKey)?.id ?? null;
        } else if (input.role === "supporting") {
          const clusterArticles = prev.articles.filter((a) => a.clusterId === cluster.id);
          const pillars = clusterArticles.filter((a) => a.role === "pillar");
          if (pillars.length === 1) linksTo = pillars[0].id;
        }
        const now = new Date().toISOString();
        const article: Article = {
          id: newId(),
          title: input.title.trim(),
          url: input.url.trim(),
          clusterId: cluster.id,
          role: input.role,
          linksTo,
          volume: input.volume ?? null,
          notes: input.notes?.trim() ?? "",
          createdAt: now,
          updatedAt: now,
        };
        created = article;
        return { ...prev, clusters, articles: [...prev.articles, article] };
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
        if (patch.pillarOf !== undefined) {
          const pillarKey = normalizeKey(patch.pillarOf);
          linksTo = pillarKey ? prev.articles.find((a) => a.id !== id && normalizeKey(a.title) === pillarKey)?.id ?? null : null;
        }
        const articles = prev.articles.map((a) =>
          a.id === id
            ? {
                ...a,
                title: patch.title?.trim() ?? a.title,
                url: patch.url?.trim() ?? a.url,
                notes: patch.notes?.trim() ?? a.notes,
                volume: patch.volume !== undefined ? patch.volume : a.volume,
                clusterId,
                role,
                linksTo,
                updatedAt: new Date().toISOString(),
              }
            : a
        );
        return { ...prev, clusters, articles };
      });
    },
    [commit]
  );

  const deleteArticle = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        clusters: prev.clusters,
        articles: prev.articles
          .filter((a) => a.id !== id)
          .map((a) => (a.linksTo === id ? { ...a, linksTo: null } : a)),
      }));
    },
    [commit]
  );

  const deleteClusters = useCallback(
    (clusterIds: string[]) => {
      commit((prev) => {
        const clusterIdSet = new Set(clusterIds);
        const deletedArticleIds = new Set(
          prev.articles.filter((a) => clusterIdSet.has(a.clusterId)).map((a) => a.id)
        );
        return {
          ...prev,
          clusters: prev.clusters.filter((c) => !clusterIdSet.has(c.id)),
          articles: prev.articles
            .filter((a) => !clusterIdSet.has(a.clusterId))
            .map((a) => (a.linksTo && deletedArticleIds.has(a.linksTo) ? { ...a, linksTo: null } : a)),
        };
      });
    },
    [commit]
  );

  const deleteArticles = useCallback(
    (ids: string[]) => {
      commit((prev) => {
        const idSet = new Set(ids);
        return {
          ...prev,
          articles: prev.articles
            .filter((a) => !idSet.has(a.id))
            .map((a) => (a.linksTo && idSet.has(a.linksTo) ? { ...a, linksTo: null } : a)),
        };
      });
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
            volume: row.volume,
            notes: "",
            createdAt: now,
            updatedAt: now,
          });
          importedArticles++;
        }

        // pass 2: resolve PillarOf links now that all rows exist. Searches across ALL clusters, so a
        // Pillar row's PillarOf chains its whole cluster onto a node elsewhere (multi-level topic maps),
        // while a Supporting row's PillarOf (or the same-cluster auto-link fallback) works as before.
        articles = articles.map((a) => {
          if (a.linksTo) return a;
          const row = rows.find(
            (r) => normalizeKey(r.title) === normalizeKey(a.title) && normalizeKey(r.cluster) === normalizeKey(clusters.find((c) => c.id === a.clusterId)?.name ?? "")
          );
          if (row?.pillarOf) {
            const pillarKey = normalizeKey(row.pillarOf);
            const match = articles.find((x) => x.id !== a.id && normalizeKey(x.title) === pillarKey);
            if (match) return { ...a, linksTo: match.id };
          }
          if (a.role === "supporting") {
            const pillars = articles.filter((x) => x.clusterId === a.clusterId && x.role === "pillar");
            if (pillars.length === 1) return { ...a, linksTo: pillars[0].id };
          }
          return a;
        });

        importedClusters = clusters.length - clusterSizeBefore;
        return { ...prev, clusters, articles };
      });

      return { importedClusters, importedArticles, errors };
    },
    [commit]
  );

  const clusterPillars = useCallback(
    (clusterId: string) => content.articles.filter((a) => a.clusterId === clusterId && a.role === "pillar"),
    [content.articles]
  );

  const updateClusterColor = useCallback(
    (clusterId: string, color: string | null) => {
      commit((prev) => ({
        ...prev,
        clusters: prev.clusters.map((c) => (c.id === clusterId ? { ...c, color } : c)),
      }));
    },
    [commit]
  );

  const updateArticlesDisplay = useCallback(
    (patchByArticleId: Record<string, ArticleDisplayOverrides>) => {
      commit((prev) => ({
        ...prev,
        articles: prev.articles.map((a) => {
          const patch = patchByArticleId[a.id];
          return patch ? { ...a, ...patch } : a;
        }),
      }));
    },
    [commit]
  );

  const setDiagramName = useCallback(
    (name: string) => {
      commit((prev) => ({ ...prev, diagramName: name }));
    },
    [commit]
  );

  const replaceAll = useCallback((next: ReplaceAllInput) => {
    setContent({ clusters: next.clusters, articles: next.articles, diagramName: next.diagramName });
    setPositionsState(next.positions ?? {});
    setHiddenClusterIdsState(next.hiddenClusterIds ?? {});
    setHiddenArticleIdsState(next.hiddenArticleIds ?? {});
  }, []);

  const resetAll = useCallback(() => {
    setContent({ clusters: [], articles: [] });
    setPositionsState({});
    setHiddenClusterIdsState({});
    setHiddenArticleIdsState({});
  }, []);

  const value = useMemo<StoreApi>(
    () => ({
      diagramId,
      loading,
      loadError,
      saveStatus,
      data: content,
      clusters: content.clusters,
      articles: content.articles,
      positions,
      hiddenClusterIds,
      hiddenArticleIds,
      setPositions,
      setHiddenClusterIds,
      setHiddenArticleIds,
      addArticle,
      updateArticle,
      deleteArticle,
      deleteClusters,
      deleteArticles,
      importRows,
      clusterPillars,
      updateClusterColor,
      updateArticlesDisplay,
      setDiagramName,
      replaceAll,
      resetAll,
    }),
    [
      diagramId,
      loading,
      loadError,
      saveStatus,
      content,
      positions,
      hiddenClusterIds,
      hiddenArticleIds,
      setPositions,
      setHiddenClusterIds,
      setHiddenArticleIds,
      addArticle,
      updateArticle,
      deleteArticle,
      deleteClusters,
      deleteArticles,
      importRows,
      clusterPillars,
      updateClusterColor,
      updateArticlesDisplay,
      setDiagramName,
      replaceAll,
      resetAll,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
