import { useRef } from "react";
import { toCsv } from "../csv";
import type { PositionOverrides } from "../diagramPositions";
import type { HiddenArticleIds, HiddenClusterIds } from "../diagramVisibility";
import { sanitizeFilename } from "../filename";
import { useStore, type ReplaceAllInput } from "../store";
import type { StoreData } from "../types";

/** Everything JSON export/import round-trips beyond the core data — all otherwise per-diagram view state. */
interface ExportPayload extends StoreData {
  positions?: PositionOverrides;
  hiddenClusterIds?: HiddenClusterIds;
  hiddenArticleIds?: HiddenArticleIds;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportPanel() {
  const { data, articles, clusters, positions, hiddenClusterIds, hiddenArticleIds, replaceAll, resetAll } =
    useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baseFilename = sanitizeFilename(data.diagramName ?? "", "topic-clusters");

  function exportJson() {
    const payload: ExportPayload = { ...data, positions, hiddenClusterIds, hiddenArticleIds };
    download(`${baseFilename}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportCsv() {
    const rows = articles.map((a) => ({
      Title: a.title,
      URL: a.url,
      TopicCluster: clusters.find((c) => c.id === a.clusterId)?.name ?? "",
      Role: a.role === "pillar" ? "Pillar" : "Supporting",
      PillarOf: articles.find((p) => p.id === a.linksTo)?.title ?? "",
      VolumeSearch: a.volume != null ? String(a.volume) : "",
    }));
    download(`${baseFilename}.csv`, toCsv(rows), "text/csv");
  }

  function importJsonFile(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as ExportPayload;
        if (!Array.isArray(parsed.clusters) || !Array.isArray(parsed.articles)) {
          throw new Error("File JSON không đúng định dạng.");
        }
        const next: ReplaceAllInput = {
          clusters: parsed.clusters,
          articles: parsed.articles,
          diagramName: parsed.diagramName,
          positions: parsed.positions,
          hiddenClusterIds: parsed.hiddenClusterIds,
          hiddenArticleIds: parsed.hiddenArticleIds,
        };
        replaceAll(next);
      } catch (err) {
        alert("Không thể nhập file JSON: " + (err as Error).message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function handleReset() {
    if (confirm("Xóa toàn bộ nội dung sơ đồ này? Hành động này không thể hoàn tác.")) {
      resetAll();
    }
  }

  return (
    <section className="panel">
      <h2>Xuất / Nhập dữ liệu</h2>
      <div className="row">
        <button type="button" onClick={exportCsv} disabled={articles.length === 0}>
          Xuất CSV
        </button>
        <button type="button" onClick={exportJson} disabled={articles.length === 0}>
          Xuất JSON (sao lưu đầy đủ)
        </button>
        <label className="file-button">
          Nhập lại từ JSON đã sao lưu
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJsonFile(file);
            }}
          />
        </label>
        <button type="button" className="danger" onClick={handleReset}>
          Xóa toàn bộ nội dung sơ đồ này
        </button>
      </div>
      <p className="hint">
        Sơ đồ này được lưu tự động trên máy chủ khi bạn chỉnh sửa. Dùng "Xuất JSON" để tải về sao lưu hoặc chuyển nội
        dung này sang một sơ đồ/tài khoản khác. Tên file xuất ra lấy theo ô "Tên sơ đồ" ở đầu trang (mặc định
        "topic-clusters" nếu chưa đặt tên) — hiện tại sẽ là "{baseFilename}.csv" / "{baseFilename}.json".
      </p>
      <p className="hint">
        File JSON mang theo cả <strong>vị trí đã kéo thả</strong> của từng bong bóng và trạng thái{" "}
        <strong>ẩn/chỉ hiện chuỗi</strong> ở tab Sơ đồ — nhập lại đúng file này (kể cả vào một sơ đồ khác) sẽ khôi
        phục nguyên vẹn cả bố cục lẫn phần đang ẩn, không chỉ nội dung bài viết. File CSV thì không mang theo 2 thứ
        này, chỉ có nội dung bài viết. "Xóa toàn bộ nội dung sơ đồ này" chỉ xóa sơ đồ đang mở, không ảnh hưởng các sơ
        đồ khác của bạn.
      </p>
    </section>
  );
}
