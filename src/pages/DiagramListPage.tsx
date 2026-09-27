import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, createDiagram, deleteDiagram, listMyDiagrams, type DiagramSummary } from "../api";
import { useAuth } from "../auth/AuthContext";
import { TopNav } from "../components/TopNav";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN");
}

export function DiagramListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<DiagramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function reload() {
    listMyDiagrams()
      .then(({ diagrams }) => setDiagrams(diagrams))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không tải được danh sách sơ đồ."));
  }

  useEffect(reload, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const { diagram } = await createDiagram({ name: "Sơ đồ chưa đặt tên", clusters: [], articles: [] });
      navigate(`/diagrams/${diagram.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tạo được sơ đồ mới.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(d: DiagramSummary) {
    if (!confirm(`Xóa sơ đồ "${d.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await deleteDiagram(d.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không xóa được sơ đồ.");
    }
  }

  return (
    <div className="app">
      <TopNav />
      <main>
        <section className="panel">
          <h2>Sơ đồ của tôi</h2>
          <p className="hint">
            Xin chào {user?.name} — đây là các sơ đồ Topic Cluster do bạn tạo. Chỉ bạn và admin xem/sửa được.
          </p>
          <div className="row">
            <button type="button" onClick={handleCreate} disabled={creating}>
              {creating ? "Đang tạo…" : "+ Tạo sơ đồ mới"}
            </button>
          </div>
          {error && <p className="errors">{error}</p>}
          {diagrams === null ? (
            <p className="hint">Đang tải…</p>
          ) : diagrams.length === 0 ? (
            <p className="hint">Chưa có sơ đồ nào — bấm "Tạo sơ đồ mới" để bắt đầu.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tên sơ đồ</th>
                    <th>Cập nhật lần cuối</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {diagrams.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name || "(chưa đặt tên)"}</td>
                      <td>{formatDate(d.updatedAt)}</td>
                      <td className="actions">
                        <button type="button" onClick={() => navigate(`/diagrams/${d.id}`)}>
                          Mở
                        </button>
                        <button type="button" className="danger" onClick={() => handleDelete(d)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
