import { useMemo, useState } from "react";
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

  function save() {
    updateArticle(article.id, { title, url, role, pillarOf: role === "supporting" ? pillarOf : "" });
    onDone();
  }

  return (
    <tr className="editing">
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
        {role === "supporting" ? (
          <input value={pillarOf} onChange={(e) => setPillarOf(e.target.value)} placeholder="Tên bài Pillar" />
        ) : (
          "—"
        )}
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
  const { articles, clusters, deleteArticle } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

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
      {grouped.map(({ cluster, items }) => (
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
                    <th>Title</th>
                    <th>URL</th>
                    <th>Cluster</th>
                    <th>Role</th>
                    <th>Pillar Of</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) =>
                    editingId === a.id ? (
                      <EditRow key={a.id} article={a} onDone={() => setEditingId(null)} />
                    ) : (
                      <tr key={a.id}>
                        <td>{a.title}</td>
                        <td>{a.url}</td>
                        <td>{cluster.name}</td>
                        <td>
                          <span className={`badge ${a.role}`}>{a.role === "pillar" ? "Pillar" : "Supporting"}</span>
                        </td>
                        <td>{articles.find((x) => x.id === a.linksTo)?.title ?? "—"}</td>
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
      ))}
    </section>
  );
}
