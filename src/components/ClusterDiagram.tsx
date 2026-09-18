import * as d3 from "d3";
import { useEffect, useMemo, useRef } from "react";
import { normalizeKey } from "../csv";
import { useStore } from "../store";
import type { TopicCluster } from "../types";

const ROOT_R = 70;
const CHILD_R = 56;
const RING_R = 158;

const PALETTE: { root: string; child: string }[] = [
  { root: "#1f6fd1", child: "#1c2541" },
  { root: "#1c2541", child: "#e0212b" },
  { root: "#0d9488", child: "#0f766e" },
  { root: "#7c3aed", child: "#4c1d95" },
  { root: "#ea580c", child: "#7c2d12" },
  { root: "#be185d", child: "#701a3a" },
];

interface RadialNode {
  id: string;
  title: string;
  url?: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  isRoot: boolean;
}

interface ClusterLayout {
  cluster: TopicCluster;
  colors: { root: string; child: string };
  root: RadialNode;
  children: RadialNode[];
}

function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const attempt = current ? `${current} ${w}` : w;
    if (attempt.length > maxCharsPerLine && current) {
      lines.push(current);
      current = w;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

export function ClusterDiagram() {
  const { clusters, articles } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const clusterSize = 2 * (RING_R + CHILD_R) + 30;
  const cols = Math.max(1, Math.min(clusters.length, Math.floor(1500 / clusterSize) || 1));

  const layouts = useMemo<ClusterLayout[]>(() => {
    return clusters.map((cluster, idx) => {
      const colors = PALETTE[idx % PALETTE.length];
      const clusterArticles = articles.filter((a) => a.clusterId === cluster.id);
      const pillar = clusterArticles.find((a) => a.role === "pillar");
      const rest = clusterArticles.filter((a) => a.id !== pillar?.id);

      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = col * clusterSize + clusterSize / 2;
      const cy = row * clusterSize + clusterSize / 2;

      const root: RadialNode = {
        id: pillar?.id ?? `cluster-${cluster.id}`,
        title: pillar?.title ?? cluster.name,
        url: pillar?.url,
        cx,
        cy,
        r: ROOT_R,
        fill: colors.root,
        isRoot: true,
      };

      const n = rest.length;
      const children: RadialNode[] = rest.map((a, i) => {
        const angle = n ? (i * (2 * Math.PI)) / n - Math.PI / 2 : 0;
        return {
          id: a.id,
          title: a.title,
          url: a.url,
          cx: cx + RING_R * Math.cos(angle),
          cy: cy + RING_R * Math.sin(angle),
          r: CHILD_R,
          fill: colors.child,
          isRoot: false,
        };
      });

      return { cluster, colors, root, children };
    });
  }, [clusters, articles, cols, clusterSize]);

  const crossLinks = useMemo(() => {
    const links: { from: RadialNode; to: RadialNode; color: string }[] = [];
    for (const layout of layouts) {
      const rootKey = normalizeKey(layout.root.title);
      for (const other of layouts) {
        if (other === layout) continue;
        for (const child of other.children) {
          if (normalizeKey(child.title) === rootKey) {
            links.push({ from: child, to: layout.root, color: layout.colors.root });
          }
        }
      }
    }
    return links;
  }, [layouts]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    if (layouts.length === 0) return;

    const rows = Math.ceil(layouts.length / cols);
    const width = cols * clusterSize;
    const height = rows * clusterSize;
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
      const lines = wrapLabel(d.title, d.isRoot ? 12 : 10);
      const lineHeight = d.isRoot ? 17 : 14.5;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      const text = d3
        .select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", 700)
        .attr("font-size", d.isRoot ? 15 : 13);
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
  }, [layouts, crossLinks, cols, clusterSize]);

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
        Mỗi cụm hiển thị bài Pillar ở trung tâm và các bài liên quan xoay quanh. Đường nét đứt nối các bài viết trùng
        tên giữa các cụm khác nhau — thể hiện chủ đề đó vừa là bài vệ tinh ở cụm này, vừa là trụ cột ở cụm khác.
      </p>
      <div className="diagram-scroll">
        <svg ref={svgRef} />
      </div>
    </section>
  );
}
