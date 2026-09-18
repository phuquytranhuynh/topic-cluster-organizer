import { useRef, useState } from "react";
import { parseCsv, type RawCsvRow } from "../csv";
import { useStore } from "../store";
import type { ImportResult } from "../types";

const SAMPLE_CSV = `Title,URL,TopicCluster,Role,PillarOf
Hướng dẫn SEO Onpage toàn tập,/blog/seo-onpage,SEO Onpage,Pillar,
Cách tối ưu thẻ title chuẩn SEO,/blog/toi-uu-title,SEO Onpage,Supporting,Hướng dẫn SEO Onpage toàn tập
Internal link là gì,/blog/internal-link,SEO Onpage,Supporting,Hướng dẫn SEO Onpage toàn tập
Content Marketing cho người mới bắt đầu,/blog/content-marketing,Content Marketing,Pillar,
Cách viết content chuẩn SEO,/blog/viet-content-seo,Content Marketing,Supporting,Content Marketing cho người mới bắt đầu
`;

export function CsvImport() {
  const { importRows } = useStore();
  const [preview, setPreview] = useState<RawCsvRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setResult(null);
    file.text().then((text) => {
      const { rows, errors } = parseCsv(text);
      setPreview(rows);
      setParseErrors(errors);
    });
  }

  function handleConfirm() {
    if (!preview || preview.length === 0) return;
    const res = importRows(preview);
    setResult(res);
    setPreview(null);
    setParseErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mau-topic-cluster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="panel">
      <h2>Nhập từ file CSV</h2>
      <p className="hint">
        File CSV cần các cột: <code>Title</code>, <code>URL</code>, <code>TopicCluster</code>, và tùy chọn{" "}
        <code>Role</code> (Pillar/Supporting) và <code>PillarOf</code> (tên bài Pillar mà bài Supporting liên kết tới).
      </p>
      <div className="row">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <button type="button" className="secondary" onClick={downloadSample}>
          Tải file CSV mẫu
        </button>
      </div>

      {parseErrors.length > 0 && (
        <ul className="errors">
          {parseErrors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {preview && preview.length > 0 && (
        <>
          <h3>Xem trước ({preview.length} bài viết)</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>URL</th>
                  <th>Topic Cluster</th>
                  <th>Role</th>
                  <th>Pillar Of</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.title}</td>
                    <td>{r.url}</td>
                    <td>{r.cluster}</td>
                    <td>{r.role}</td>
                    <td>{r.pillarOf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 50 && <p className="hint">… và {preview.length - 50} dòng khác.</p>}
          </div>
          <button type="button" onClick={handleConfirm}>
            Xác nhận nhập {preview.length} bài viết
          </button>
        </>
      )}

      {result && (
        <p className="success">
          Đã nhập {result.importedArticles} bài viết vào {result.importedClusters} cụm chủ đề mới.
        </p>
      )}
    </section>
  );
}
