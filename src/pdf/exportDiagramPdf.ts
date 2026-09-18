import { jsPDF } from "jspdf";
import { computeLabelLayout, type Bounds, type ClusterLayout, type CrossLink, type RadialNode } from "../diagramLayout";
import { FONT_NAME, registerVietnameseFont } from "./fonts";
import { estimatePageGrid, type Grid, type PageFormatId } from "./pageFormats";

/** Extra margin (pt) around a node's true radius used when deciding if it should be drawn on a tile. */
const NODE_PAD = 90;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function segmentIntersectsTile(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  offsetX: number,
  offsetY: number,
  worldPageW: number,
  worldPageH: number,
  pad = 10
): boolean {
  const minX = Math.min(x1, x2) - pad;
  const maxX = Math.max(x1, x2) + pad;
  const minY = Math.min(y1, y2) - pad;
  const maxY = Math.max(y1, y2) + pad;
  return maxX >= offsetX && minX <= offsetX + worldPageW && maxY >= offsetY && minY <= offsetY + worldPageH;
}

function nodeIntersectsTile(
  node: RadialNode,
  offsetX: number,
  offsetY: number,
  worldPageW: number,
  worldPageH: number
): boolean {
  return (
    node.cx + NODE_PAD >= offsetX &&
    node.cx - NODE_PAD <= offsetX + worldPageW &&
    node.cy + NODE_PAD >= offsetY &&
    node.cy - NODE_PAD <= offsetY + worldPageH
  );
}

function drawCoverPage(
  doc: jsPDF,
  info: { grid: Grid; clusterCount: number; articleCount: number }
) {
  const { grid, clusterCount, articleCount } = info;
  const { pageW, pageH } = grid;

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text("Sơ đồ Topic Cluster", pageW / 2, 60, { align: "center" });

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(12);
  doc.setTextColor(75, 85, 99);
  doc.text(
    `${clusterCount} cụm chủ đề · ${articleCount} bài viết · in trên lưới ${grid.cols} cột × ${grid.rows} hàng (${grid.total} trang)`,
    pageW / 2,
    84,
    { align: "center" }
  );
  doc.text(
    "Ghép các trang theo đúng vị trí Hàng/Cột bên dưới (viền các trang chồng lấn nhẹ để dễ căn mép).",
    pageW / 2,
    102,
    { align: "center" }
  );

  // grid map of tiles
  const mapMarginTop = 140;
  const mapMarginSide = 80;
  const mapW = pageW - mapMarginSide * 2;
  const mapH = pageH - mapMarginTop - 60;
  const cellW = mapW / grid.cols;
  const cellH = mapH / grid.rows;

  let n = 0;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      n++;
      const x = mapMarginSide + c * cellW;
      const y = mapMarginTop + r * cellH;
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(1);
      doc.rect(x, y, cellW, cellH);
      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(Math.min(13, cellH / 4));
      doc.setTextColor(30, 41, 59);
      doc.text(String(n), x + cellW / 2, y + cellH / 2 - 6, { align: "center", baseline: "middle" });
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(Math.min(9, cellH / 6));
      doc.setTextColor(100, 116, 139);
      doc.text(`H${r + 1}·C${c + 1}`, x + cellW / 2, y + cellH / 2 + 10, { align: "center", baseline: "middle" });
    }
  }
}

function drawTile(
  doc: jsPDF,
  opts: {
    layouts: ClusterLayout[];
    crossLinks: CrossLink[];
    offsetX: number;
    offsetY: number;
    pageW: number;
    pageH: number;
    scale: number;
    pageIndex: number;
    totalPages: number;
    row: number;
    col: number;
    showPageLabel: boolean;
  }
) {
  const { layouts, crossLinks, offsetX, offsetY, pageW, pageH, scale, pageIndex, totalPages, row, col, showPageLabel } =
    opts;
  const worldPageW = pageW / scale;
  const worldPageH = pageH / scale;
  const tx = (x: number) => (x - offsetX) * scale;
  const ty = (y: number) => (y - offsetY) * scale;

  for (const layout of layouts) {
    const [r, g, b] = hexToRgb(layout.colors.root);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(Math.max(0.4, 2 * scale));
    for (const child of layout.children) {
      if (
        segmentIntersectsTile(layout.root.cx, layout.root.cy, child.cx, child.cy, offsetX, offsetY, worldPageW, worldPageH)
      ) {
        doc.line(tx(layout.root.cx), ty(layout.root.cy), tx(child.cx), ty(child.cy));
      }
    }
  }

  doc.setLineDashPattern([Math.max(2, 6 * scale), Math.max(1.5, 4 * scale)], 0);
  for (const link of crossLinks) {
    if (segmentIntersectsTile(link.from.cx, link.from.cy, link.to.cx, link.to.cy, offsetX, offsetY, worldPageW, worldPageH)) {
      const [r, g, b] = hexToRgb(link.color);
      doc.setDrawColor(r, g, b);
      doc.line(tx(link.from.cx), ty(link.from.cy), tx(link.to.cx), ty(link.to.cy));
    }
  }
  doc.setLineDashPattern([], 0);

  const allNodes = layouts.flatMap((l) => [l.root, ...l.children]);
  for (const node of allNodes) {
    if (!nodeIntersectsTile(node, offsetX, offsetY, worldPageW, worldPageH)) continue;
    const [r, g, b] = hexToRgb(node.fill);
    doc.setFillColor(r, g, b);
    doc.circle(tx(node.cx), ty(node.cy), node.r * scale, "F");

    const label = computeLabelLayout(node);
    const cx = tx(node.cx);
    const cy = ty(node.cy);

    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(Math.max(3, node.fontSize * scale));
    doc.setTextColor(255, 255, 255);
    label.titleLines.forEach((line, i) => {
      doc.text(line, cx, cy + (label.startY + i * label.lineHeight) * scale, {
        align: "center",
        baseline: "middle",
      });
    });

    if (label.volumeText) {
      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(Math.max(3, label.volumeFontSize * scale));
      doc.setTextColor(235, 235, 235);
      doc.text(label.volumeText, cx, cy + label.volumeY * scale, { align: "center", baseline: "middle" });
    }
  }

  if (showPageLabel) {
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Trang ${pageIndex}/${totalPages} — Hàng ${row + 1}, Cột ${col + 1}`, 14, 18);
  }
}

export interface ExportDiagramPdfOptions {
  layouts: ClusterLayout[];
  crossLinks: CrossLink[];
  bounds: Bounds;
  pageFormat: PageFormatId;
  filename?: string;
}

export async function exportDiagramToPdf(opts: ExportDiagramPdfOptions): Promise<void> {
  const { layouts, crossLinks, bounds, pageFormat, filename = "topic-cluster-diagram.pdf" } = opts;
  if (layouts.length === 0) throw new Error("Không có dữ liệu để xuất.");

  const grid = estimatePageGrid(bounds.width, bounds.height, pageFormat);
  const articleCount = layouts.reduce((sum, l) => sum + 1 + l.children.length, 0);

  const doc = new jsPDF({ unit: "pt", format: [grid.pageW, grid.pageH], orientation: "landscape" });
  await registerVietnameseFont(doc);

  const singlePage = grid.total === 1;
  if (!singlePage) {
    drawCoverPage(doc, { grid, clusterCount: layouts.length, articleCount });
  }

  let pageIndex = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      pageIndex++;
      if (!singlePage) doc.addPage([grid.pageW, grid.pageH], "landscape");
      drawTile(doc, {
        layouts,
        crossLinks,
        offsetX: bounds.minX + col * grid.stepX,
        offsetY: bounds.minY + row * grid.stepY,
        pageW: grid.pageW,
        pageH: grid.pageH,
        scale: grid.scale,
        pageIndex,
        totalPages: grid.total,
        row,
        col,
        showPageLabel: !singlePage,
      });
    }
  }

  doc.save(filename);
}
