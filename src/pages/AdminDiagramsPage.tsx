import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, deleteDiagram, listAllDiagrams, type DiagramSummary } from "../api";
import { TopNav } from "../components/TopNav";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN");
}

export function AdminDiagramsPage() {
  const navigate = useNavigate();
  const [diagrams, setDiagrams] = useState<DiagramSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    listAllDiagrams()
      .then(({ diagrams }) => setDiagrams(diagrams))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không tải được danh sách sơ đồ."));
  }

  useEffect(reload, []);

  async function handleDelete(d: DiagramSummary) {
    if (!confirm(`Xóa sơ đồ "${d.name}" của ${d.owner?.name}? Hành động này không thể hoàn tác.`)) return;
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
          <h2>Tất cả sơ đồ</h2>
          <p className="hint">Toàn bộ sơ đồ của mọi nhân viên trong hệ thống — dùng để giám sát, mở xem, hoặc dọn dẹp.</p>
          {error && <p className="errors">{error}</p>}
          {diagrams === null ? (
            <p className="hint">Đang tải…</p>
          ) : diagrams.length === 0 ? (
            <p className="hint">Chưa có sơ đồ nào trong hệ thống.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tên sơ đồ</th>
                    <th>Người tạo</th>
                    <th>Cập nhật lần cuối</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {diagrams.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name || "(chưa đặt tên)"}</td>
                      <td>
                        {d.owner?.name} <span className="count">({d.owner?.email})</span>
                      </td>
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
