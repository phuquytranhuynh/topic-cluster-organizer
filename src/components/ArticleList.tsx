import { useMemo, useState } from "react";
import { formatVolume } from "../diagramLayout";
import { loadHiddenArticles, saveHiddenArticles, type HiddenArticleIds } from "../diagramVisibility";
import { useStore } from "../store";
import type { Article, ArticleRole } from "../types";

function EditRow({ article, onDone }: { article: Article; onDone: () => void }) {
  const { updateArticle, clusters, articles } = useStore();
  const cluster = clusters.find((c) => c.id === article.clusterId);
  const [title, setTitle] = useState(article.title);
  const [url, setUrl] = useState(article.url);
  const [role, setRole] = useState<ArticleRole>(article.role);
  const pillar = articles.find((a) => a.id === article.linksTo);
  const [pillarOf, setPillarOf] = useState(pillar?.title ?? "");
  const [volume, setVolume] = useState(article.volume != null ? String(article.volume) : "");

  function save() {
    updateArticle(article.id, { title, url, role, pillarOf, volume: volume ? parseInt(volume, 10) : null });
    onDone();
  }

  return (
    <tr className="editing">
      <td></td>
      <td>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </td>
      <td>
        <input value={url} onChange={(e) => setUrl(e.target.value)} />
      </td>
      <td>{cluster?.name}</td>
      <td>
        <select value={role} onChange={(e) => setRole(e.target.value as ArticleRole)}>
          <option value="pillar">Pillar</option>
          <option value="supporting">Supporting</option>
        </select>
      </td>
      <td>
        <input
          value={pillarOf}
          onChange={(e) => setPillarOf(e.target.value)}
          placeholder={role === "pillar" ? "Nhánh con của (cụm khác)" : "Tên bài Pillar"}
        />
      </td>
      <td>
        <input type="number" min="0" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="Volume" />
      </td>
      <td className="actions">
        <button type="button" onClick={save}>
          Lưu
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          Hủy
        </button>
      </td>
    </tr>
  );
}

export function ArticleList() {
  const { articles, clusters, deleteArticle, deleteArticles } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hiddenArticleIds, setHiddenArticleIds] = useState<HiddenArticleIds>(() => loadHiddenArticles());

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectGroup(items: Article[], checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of items) {
        if (checked) next.add(a.id);
        else next.delete(a.id);
      }
      return next;
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const confirmed = confirm(`Xóa ${selectedIds.size} bài viết đã chọn? Hành động này không thể hoàn tác.`);
    if (!confirmed) return;
    deleteArticles([...selectedIds]);
    setSelectedIds(new Set());
  }

  function handleBulkHide() {
    if (selectedIds.size === 0) return;
    const next = { ...hiddenArticleIds };
    for (const id of selectedIds) next[id] = true;
    setHiddenArticleIds(next);
    saveHiddenArticles(next);
    setSelectedIds(new Set());
  }

  function handleBulkShow() {
    if (selectedIds.size === 0) return;
    const next = { ...hiddenArticleIds };
    for (const id of selectedIds) delete next[id];
    setHiddenArticleIds(next);
    saveHiddenArticles(next);
    setSelectedIds(new Set());
  }

  const grouped = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const map = new Map<string, Article[]>();
    for (const cluster of clusters) map.set(cluster.id, []);
    for (const article of articles) {
      if (query && !article.title.toLowerCase().includes(query)) continue;
      const list = map.get(article.clusterId);
      if (list) list.push(article);
    }
    return clusters
      .map((c) => ({ cluster: c, items: map.get(c.id) ?? [] }))
      .filter((g) => !query || g.items.length > 0);
  }, [articles, clusters, filter]);

  if (clusters.length === 0) {
    return (
      <section className="panel">
        <h2>Danh sách bài viết</h2>
        <p className="hint">Chưa có dữ liệu. Hãy nhập CSV hoặc thêm bài viết ở tab tương ứng.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Danh sách bài viết ({articles.length})</h2>
      <input
        className="filter-input"
        placeholder="Tìm theo tiêu đề…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {selectedIds.size > 0 && (
        <div className="bulk-actions-bar">
          <span>{selectedIds.size} bài đã chọn</span>
          <button type="button" className="secondary" onClick={handleBulkHide}>
            Ẩn đã chọn
          </button>
          <button type="button" className="secondary" onClick={handleBulkShow}>
            Hiện đã chọn
          </button>
          <button type="button" className="danger" onClick={handleBulkDelete}>
            Xóa đã chọn…
          </button>
          <button type="button" className="secondary" onClick={() => setSelectedIds(new Set())}>
            Bỏ chọn
          </button>
        </div>
      )}
      {Object.keys(hiddenArticleIds).length > 0 && (
        <p className="hint">
          {Object.keys(hiddenArticleIds).length} bài viết đang bị ẩn khỏi sơ đồ Topic Cluster (đánh dấu{" "}
          <span className="badge hidden">Đã ẩn</span> bên dưới). Chọn lại rồi bấm "Hiện đã chọn" để hiện lại.
        </p>
      )}
      {grouped.map(({ cluster, items }) => {
        const allSelected = items.length > 0 && items.every((a) => selectedIds.has(a.id));
        return (
          <div key={cluster.id} className="cluster-group">
            <h3>
              {cluster.name} <span className="count">({items.length})</span>
            </h3>
            {items.length === 0 ? (
              <p className="hint">Không có bài viết phù hợp.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => toggleSelectGroup(items, e.target.checked)}
                          title="Chọn tất cả bài trong cụm này"
                        />
                      </th>
                      <th>Title</th>
                      <th>URL</th>
                      <th>Cluster</th>
                      <th>Role</th>
                      <th>Pillar Of</th>
                      <th>Volume</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((a) =>
                      editingId === a.id ? (
                        <EditRow key={a.id} article={a} onDone={() => setEditingId(null)} />
                      ) : (
                        <tr key={a.id} className={hiddenArticleIds[a.id] ? "hidden-row" : undefined}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(a.id)}
                              onChange={() => toggleSelect(a.id)}
                            />
                          </td>
                          <td>
                            {a.title}
                            {hiddenArticleIds[a.id] && <span className="badge hidden">Đã ẩn</span>}
                          </td>
                          <td>{a.url}</td>
                          <td>{cluster.name}</td>
                          <td>
                            <span className={`badge ${a.role}`}>{a.role === "pillar" ? "Pillar" : "Supporting"}</span>
                          </td>
                          <td>{articles.find((x) => x.id === a.linksTo)?.title ?? "—"}</td>
                          <td>{a.volume != null ? formatVolume(a.volume) : "—"}</td>
                          <td className="actions">
                            <button type="button" onClick={() => setEditingId(a.id)}>
                              Sửa
                            </button>
                            <button type="button" className="danger" onClick={() => deleteArticle(a.id)}>
                              Xóa
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
