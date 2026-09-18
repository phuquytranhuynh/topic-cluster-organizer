import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { ArticleRole } from "../types";

const emptyForm = {
  title: "",
  url: "",
  clusterName: "",
  role: "supporting" as ArticleRole,
  pillarOf: "",
  notes: "",
};

export function ManualEntryForm() {
  const { addArticle, clusters, articles } = useStore();
  const [form, setForm] = useState(emptyForm);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const currentCluster = useMemo(
    () => clusters.find((c) => c.name.trim().toLowerCase() === form.clusterName.trim().toLowerCase()),
    [clusters, form.clusterName]
  );

  // Supporting: suggest Pillars within this same cluster (the common case). Pillar: suggest articles
  // in OTHER clusters — picking one chains this whole cluster onto that cluster as a deeper level.
  const targetOptions = useMemo(() => {
    if (form.role === "pillar") {
      return currentCluster ? articles.filter((a) => a.clusterId !== currentCluster.id) : articles;
    }
    return currentCluster ? articles.filter((a) => a.clusterId === currentCluster.id && a.role === "pillar") : [];
  }, [articles, currentCluster, form.role]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.clusterName.trim()) return;
    const created = addArticle({
      title: form.title,
      url: form.url,
      clusterName: form.clusterName,
      role: form.role,
      pillarOf: form.pillarOf || undefined,
      notes: form.notes,
    });
    setJustAdded(created.title);
    setForm((f) => ({ ...emptyForm, clusterName: f.clusterName, role: f.role }));
  }

  return (
    <section className="panel">
      <h2>Nhập tay từng bài viết</h2>
      <p className="hint">
        Nhập bài viết và cụm Topic Cluster mà nó thuộc về. Nếu cụm chưa tồn tại, hệ thống sẽ tự tạo mới. Mỗi cụm nên
        có 1 bài Pillar (trụ cột) và nhiều bài Supporting (vệ tinh) liên kết về Pillar đó. Muốn nối nhiều cụm thành
        nhiều level (cụm này là nhánh con của cụm khác), khai báo ở ô "nhánh con của" khi thêm bài Pillar.
      </p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>
          Tiêu đề bài viết *
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="VD: Hướng dẫn SEO Onpage toàn tập"
          />
        </label>

        <label>
          URL
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="/blog/huong-dan-seo-onpage"
          />
        </label>

        <label>
          Topic Cluster (chủ đề) *
          <input
            required
            list="cluster-options"
            value={form.clusterName}
            onChange={(e) => setForm((f) => ({ ...f, clusterName: e.target.value, pillarOf: "" }))}
            placeholder="VD: SEO Onpage"
          />
          <datalist id="cluster-options">
            {clusters.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </label>

        <label>
          Vai trò
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as ArticleRole }))}
          >
            <option value="pillar">Pillar (bài trụ cột)</option>
            <option value="supporting">Supporting (bài vệ tinh)</option>
          </select>
        </label>

        <label>
          {form.role === "pillar"
            ? "Cụm này là nhánh con của bài viết nào? (tùy chọn — ở cụm khác, để nối nhiều level)"
            : "Liên kết tới bài Pillar nào"}
          <input
            list="target-options"
            value={form.pillarOf}
            onChange={(e) => setForm((f) => ({ ...f, pillarOf: e.target.value }))}
            placeholder={
              form.role === "pillar"
                ? "Để trống nếu đây là cụm gốc (level cao nhất)"
                : targetOptions.length
                  ? "Chọn bài Pillar trong cụm này"
                  : "Chưa có Pillar — để trống cũng được"
            }
          />
          <datalist id="target-options">
            {targetOptions.map((a) => (
              <option key={a.id} value={a.title} />
            ))}
          </datalist>
        </label>

        <label className="full-width">
          Ghi chú
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2}
          />
        </label>

        <button type="submit">Thêm bài viết</button>
      </form>
      {justAdded && <p className="success">Đã thêm "{justAdded}".</p>}
    </section>
  );
}
