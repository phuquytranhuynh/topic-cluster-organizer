import { useRef, useState } from "react";
import { parseCsv, parsePositionCsv, type RawCsvRow } from "../csv";
import { useStore } from "../store";
import type { ImportResult } from "../types";

type CsvFormat = "standard" | "position";

const SAMPLE_CSV = `Title,URL,TopicCluster,Role,PillarOf,VolumeSearch
Marketing tổng quan là gì,/blog/marketing-tong-quan,Marketing tổng quan,Pillar,,8100
4P trong Marketing,/blog/4p-marketing,Marketing tổng quan,Supporting,Marketing tổng quan là gì,2400
Digital Marketing,/blog/digital-marketing,Marketing tổng quan,Supporting,Marketing tổng quan là gì,12100
Cẩm nang Digital Marketing từ A-Z,/blog/cam-nang-digital-marketing,Digital Marketing chuyên sâu,Pillar,Digital Marketing,5400
SEO là gì,/blog/seo-la-gi,Digital Marketing chuyên sâu,Supporting,Cẩm nang Digital Marketing từ A-Z,9900
Email Marketing là gì,/blog/email-marketing-la-gi,Digital Marketing chuyên sâu,Supporting,Cẩm nang Digital Marketing từ A-Z,1600
Toàn tập SEO từ A-Z,/blog/toan-tap-seo,SEO chuyên sâu,Pillar,SEO là gì,3200
SEO Onpage,/blog/seo-onpage,SEO chuyên sâu,Supporting,Toàn tập SEO từ A-Z,4400
SEO Offpage,/blog/seo-offpage,SEO chuyên sâu,Supporting,Toàn tập SEO từ A-Z,2900
`;

const SAMPLE_POSITION_CSV = `Topic,Vị trí trong sơ đồ,Volume Search
Marketing tổng quan là gì,0,8100
4P trong Marketing,0.1,2400
Digital Marketing,0.2,12100
Cẩm nang Digital Marketing từ A-Z,0.2.1,5400
SEO là gì,0.2.1.1,9900
Email Marketing là gì,0.2.1.2,1600
Toàn tập SEO từ A-Z,0.2.1.1.1,3200
SEO Onpage,0.2.1.1.1.1,4400
SEO Offpage,0.2.1.1.1.2,2900
`;

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImport() {
  const { importRows } = useStore();
  const [format, setFormat] = useState<CsvFormat>("standard");
  const [preview, setPreview] = useState<RawCsvRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setResult(null);
    file.text().then((text) => {
      const { rows, errors } = format === "position" ? parsePositionCsv(text) : parseCsv(text);
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

  return (
    <section className="panel">
      <h2>Nhập từ file CSV</h2>

      <div className="format-toggle">
        <label>
          <input
            type="radio"
            name="csv-format"
            checked={format === "standard"}
            onChange={() => {
              setFormat("standard");
              setPreview(null);
              setParseErrors([]);
            }}
          />
          Cột chuẩn (Title / TopicCluster / Role / PillarOf)
        </label>
        <label>
          <input
            type="radio"
            name="csv-format"
            checked={format === "position"}
            onChange={() => {
              setFormat("position");
              setPreview(null);
              setParseErrors([]);
            }}
          />
          Mã vị trí phân cấp (Topic / Vị trí trong sơ đồ)
        </label>
      </div>

      {format === "standard" ? (
        <>
          <p className="hint">
            File CSV cần các cột: <code>Title</code>, <code>URL</code>, <code>TopicCluster</code>, và tùy chọn{" "}
            <code>Role</code> (Pillar/Supporting), <code>PillarOf</code> (bài viết mà dòng này liên kết tới) và{" "}
            <code>VolumeSearch</code> (lượt tìm kiếm/tháng, hiển thị bên dưới tiêu đề trong bong bóng).
          </p>
          <p className="hint">
            <strong>Nối nhiều cụm thành nhiều level:</strong> khai báo <code>PillarOf</code> ngay trên dòng{" "}
            <code>Role = Pillar</code>, trỏ tới tên 1 bài viết ở cụm khác (không cần trùng tên) — cụm đó sẽ trở
            thành nhánh con của bài viết được trỏ tới. Lặp lại để nối bao nhiêu level cũng được (xem file mẫu: 3
            cụm nối thành 3 level).
          </p>
        </>
      ) : (
        <>
          <p className="hint">
            File CSV cần các cột: <code>Topic</code> (tiêu đề bài viết) và <code>Vị trí trong sơ đồ</code> (mã vị
            trí dạng số phân cấp bằng dấu chấm, ví dụ <code>0</code>, <code>0.1</code>, <code>0.1.2</code>). Cột{" "}
            <code>URL</code> và <code>Volume Search</code> (lượt tìm kiếm/tháng, hiển thị bên dưới tiêu đề trong
            bong bóng) đều tùy chọn.
          </p>
          <p className="hint">
            <strong>Cách hoạt động:</strong> bài nào <strong>có bài con</strong> (có dòng khác với vị trí bắt đầu
            bằng <code>vị_trí_của_nó + "."</code>) sẽ tự trở thành bài <strong>Pillar</strong> của một cụm mới, nối
            vào bài cha. Bài nào <strong>không có con</strong> sẽ là bài <strong>Supporting</strong> trong cụm của
            bài cha. Không cần khai báo Role hay PillarOf thủ công — hệ thống tự suy ra từ mã vị trí.
          </p>
        </>
      )}

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
        <button
          type="button"
          className="secondary"
          onClick={() =>
            format === "position"
              ? downloadCsv(SAMPLE_POSITION_CSV, "mau-topic-cluster-vi-tri.csv")
              : downloadCsv(SAMPLE_CSV, "mau-topic-cluster.csv")
          }
        >
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
                  <th>Volume</th>
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
                    <td>{r.volume ?? ""}</td>
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
