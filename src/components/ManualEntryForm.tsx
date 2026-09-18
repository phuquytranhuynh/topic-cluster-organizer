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

  const pillarOptions = useMemo(() => {
    const cluster = clusters.find((c) => c.name.trim().toLowerCase() === form.clusterName.trim().toLowerCase());
    if (!cluster) return [];
    return articles.filter((a) => a.clusterId === cluster.id && a.role === "pillar");
  }, [clusters, articles, form.clusterName]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.clusterName.trim()) return;
    const created = addArticle({
      title: form.title,
      url: form.url,
      clusterName: form.clusterName,
      role: form.role,
      pillarOf: form.role === "supporting" ? form.pillarOf : undefined,
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
        có 1 bài Pillar (trụ cột) và nhiều bài Supporting (vệ tinh) liên kết về Pillar đó.
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

        {form.role === "supporting" && (
          <label>
            Liên kết tới bài Pillar nào
            <input
              list="pillar-options"
              value={form.pillarOf}
              onChange={(e) => setForm((f) => ({ ...f, pillarOf: e.target.value }))}
              placeholder={pillarOptions.length ? "Chọn bài Pillar trong cụm này" : "Chưa có Pillar — để trống cũng được"}
            />
            <datalist id="pillar-options">
              {pillarOptions.map((p) => (
                <option key={p.id} value={p.title} />
              ))}
            </datalist>
          </label>
        )}

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
