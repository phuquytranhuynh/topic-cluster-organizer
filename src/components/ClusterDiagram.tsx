import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { PALETTE, buildCrossLinks, layoutDiagram, wrapLabel } from "../diagramLayout";
import { PAGE_FORMATS, estimatePageGrid, type PageFormatId } from "../pdf/pageFormats";
import { useStore } from "../store";

export function ClusterDiagram() {
  const { clusters, articles } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [pageFormat, setPageFormat] = useState<PageFormatId>("a3");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { layouts, width, height } = useMemo(() => layoutDiagram(clusters, articles), [clusters, articles]);
  const crossLinks = useMemo(() => buildCrossLinks(layouts), [layouts]);

  const pageEstimate = useMemo(() => estimatePageGrid(width, height, pageFormat), [width, height, pageFormat]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (layouts.length === 0) return;

    svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

    const linkLayer = svg.append("g").attr("class", "links");
    const nodeLayer = svg.append("g").attr("class", "nodes");

    for (const layout of layouts) {
      linkLayer
        .selectAll(null)
        .data(layout.children.map((c) => ({ from: layout.root, to: c })))
        .join("line")
        .attr("x1", (d) => d.from.cx)
        .attr("y1", (d) => d.from.cy)
        .attr("x2", (d) => d.to.cx)
        .attr("y2", (d) => d.to.cy)
        .attr("stroke", layout.colors.root)
        .attr("stroke-width", 2);
    }

    linkLayer
      .selectAll(null)
      .data(crossLinks)
      .join("line")
      .attr("x1", (d) => d.from.cx)
      .attr("y1", (d) => d.from.cy)
      .attr("x2", (d) => d.to.cx)
      .attr("y2", (d) => d.to.cy)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 4");

    const allNodes = layouts.flatMap((l) => [l.root, ...l.children]);

    const nodeGroups = nodeLayer
      .selectAll("g.node")
      .data(allNodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.cx}, ${d.cy})`);

    nodeGroups
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => d.fill);

    nodeGroups.each(function (d) {
      const lines = wrapLabel(d.title, d.maxChars);
      const lineHeight = d.fontSize * 1.15;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      const text = d3
        .select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", 700)
        .attr("font-size", d.fontSize);
      lines.forEach((line, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("y", startY + i * lineHeight)
          .text(line);
      });
      if (d.url) {
        d3.select(this).append("title").text(`${d.title}${d.url ? ` — ${d.url}` : ""}`);
      }
    });
  }, [layouts, crossLinks, width, height]);

  async function handleExportPdf() {
    setExporting(true);
    setExportError(null);
    try {
      const { exportDiagramToPdf } = await import("../pdf/exportDiagramPdf");
      await exportDiagramToPdf({ layouts, crossLinks, width, height, pageFormat });
    } catch (err) {
      setExportError((err as Error).message || "Xuất PDF thất bại.");
    } finally {
      setExporting(false);
    }
  }

  if (clusters.length === 0) {
    return (
      <section className="panel">
        <h2>Sơ đồ Topic Cluster</h2>
        <p className="hint">Chưa có dữ liệu để vẽ sơ đồ. Hãy nhập CSV hoặc thêm bài viết trước.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Sơ đồ Topic Cluster</h2>
      <p className="hint">
        <span className="legend-dot" style={{ background: PALETTE[0].root }} /> Bài Pillar &nbsp;
        <span className="legend-dot" style={{ background: PALETTE[0].child }} /> Bài Supporting &nbsp; — mỗi cụm một
        tông màu riêng. Đường nét đứt nối các bài viết trùng tên giữa các cụm khác nhau.
      </p>

      <div className="row pdf-export-row">
        <label className="inline-label">
          Khổ giấy xuất PDF
          <select value={pageFormat} onChange={(e) => setPageFormat(e.target.value as PageFormatId)}>
            {Object.entries(PAGE_FORMATS).map(([id, f]) => (
              <option key={id} value={id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleExportPdf} disabled={exporting}>
          {exporting ? "Đang tạo PDF…" : `Xuất PDF (~${pageEstimate.total} trang)`}
        </button>
        <span className="hint" style={{ marginBottom: 0 }}>
          Lưới {pageEstimate.cols} cột × {pageEstimate.rows} hàng — PDF dạng vector, zoom sâu vẫn nét.
        </span>
      </div>
      {exportError && <p className="errors">{exportError}</p>}

      <div className="diagram-scroll">
        <svg ref={svgRef} />
      </div>
    </section>
  );
}
