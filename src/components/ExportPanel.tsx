import { useRef } from "react";
import { toCsv } from "../csv";
import { useStore } from "../store";
import type { StoreData } from "../types";

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
  const { data, articles, clusters, replaceAll, resetAll } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportJson() {
    download("topic-clusters.json", JSON.stringify(data, null, 2), "application/json");
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
    download("topic-clusters.csv", toCsv(rows), "text/csv");
  }

  function importJsonFile(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as StoreData;
        if (!Array.isArray(parsed.clusters) || !Array.isArray(parsed.articles)) {
          throw new Error("File JSON không đúng định dạng.");
        }
        replaceAll(parsed);
      } catch (err) {
        alert("Không thể nhập file JSON: " + (err as Error).message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function handleReset() {
    if (confirm("Xóa toàn bộ dữ liệu hiện tại? Hành động này không thể hoàn tác.")) {
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
          Xóa toàn bộ dữ liệu
        </button>
      </div>
      <p className="hint">
        Dữ liệu được lưu tự động trong trình duyệt này (localStorage). Dùng "Xuất JSON" để sao lưu hoặc chuyển sang
        máy/trình duyệt khác.
      </p>
    </section>
  );
}
