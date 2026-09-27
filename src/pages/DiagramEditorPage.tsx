import { useState } from "react";
import { useParams } from "react-router-dom";
import "../App.css";
import { ArticleList } from "../components/ArticleList";
import { ClusterDiagram } from "../components/ClusterDiagram";
import { CsvImport } from "../components/CsvImport";
import { ExportPanel } from "../components/ExportPanel";
import { ManualEntryForm } from "../components/ManualEntryForm";
import { TopNav } from "../components/TopNav";
import { StoreProvider, useStore, type SaveStatus } from "../store";

type Tab = "diagram" | "csv" | "manual" | "list" | "data";

const TABS: { id: Tab; label: string }[] = [
  { id: "diagram", label: "Sơ đồ Topic Cluster" },
  { id: "csv", label: "Nhập từ CSV" },
  { id: "manual", label: "Nhập tay" },
  { id: "list", label: "Danh sách bài viết" },
  { id: "data", label: "Xuất / Nhập dữ liệu" },
];

function Summary() {
  const { clusters, articles } = useStore();
  const pillarCount = articles.filter((a) => a.role === "pillar").length;
  return (
    <div className="summary">
      <span>
        <strong>{clusters.length}</strong> cụm chủ đề
      </span>
      <span>
        <strong>{pillarCount}</strong> bài Pillar
      </span>
      <span>
        <strong>{articles.length}</strong> tổng số bài viết
      </span>
    </div>
  );
}

function DiagramNameInput() {
  const { data, setDiagramName } = useStore();
  return (
    <label className="diagram-name-field">
      Tên sơ đồ
      <input
        value={data.diagramName ?? ""}
        onChange={(e) => setDiagramName(e.target.value)}
        placeholder="VD: Content Plan Marketing 2026"
      />
    </label>
  );
}

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  error: "Lỗi lưu — kiểm tra kết nối mạng",
};

function SaveStatusIndicator() {
  const { saveStatus } = useStore();
  if (saveStatus === "idle") return null;
  return <span className={`save-status ${saveStatus}`}>{SAVE_STATUS_LABEL[saveStatus]}</span>;
}

function DiagramEditorShell() {
  const [tab, setTab] = useState<Tab>("diagram");
  const { loading, loadError } = useStore();

  if (loading) return <div className="full-page-status">Đang tải sơ đồ…</div>;
  if (loadError) return <div className="full-page-status errors">{loadError}</div>;

  return (
    <div className="app">
      <TopNav />
      <div className="diagram-meta-bar">
        <DiagramNameInput />
        <Summary />
        <SaveStatusIndicator />
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === "diagram" && <ClusterDiagram />}
        {tab === "csv" && <CsvImport />}
        {tab === "manual" && <ManualEntryForm />}
        {tab === "list" && <ArticleList />}
        {tab === "data" && <ExportPanel />}
      </main>
    </div>
  );
}

export function DiagramEditorPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <StoreProvider diagramId={id}>
      <DiagramEditorShell />
    </StoreProvider>
  );
}
