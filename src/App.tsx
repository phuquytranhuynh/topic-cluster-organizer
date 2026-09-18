import { useState } from "react";
import "./App.css";
import { ArticleList } from "./components/ArticleList";
import { ClusterDiagram } from "./components/ClusterDiagram";
import { CsvImport } from "./components/CsvImport";
import { ExportPanel } from "./components/ExportPanel";
import { ManualEntryForm } from "./components/ManualEntryForm";
import { StoreProvider, useStore } from "./store";

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

function AppShell() {
  const [tab, setTab] = useState<Tab>("diagram");

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Topic Cluster Organizer</h1>
          <p className="tagline">Sắp xếp bài viết website thành sơ đồ liên kết Topic Cluster</p>
        </div>
        <Summary />
      </header>

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

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
