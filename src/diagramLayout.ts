import { normalizeKey } from "./csv";
import type { Article, TopicCluster } from "./types";

export const ROOT_R = 70;
const CHILD_R_BASE = 56;
const CHILD_R_MIN = 26;
const RING_R_BASE = 158;
const NODE_GAP = 10;
const CLUSTER_MARGIN = 60;

export const PALETTE: { root: string; child: string }[] = [
  { root: "#1f6fd1", child: "#1c2541" },
  { root: "#1c2541", child: "#e0212b" },
  { root: "#0d9488", child: "#0f766e" },
  { root: "#7c3aed", child: "#4c1d95" },
  { root: "#ea580c", child: "#7c2d12" },
  { root: "#be185d", child: "#701a3a" },
];

export interface RadialNode {
  id: string;
  title: string;
  url?: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  isRoot: boolean;
  fontSize: number;
  maxChars: number;
}

export interface ClusterLayout {
  cluster: TopicCluster;
  colors: { root: string; child: string };
  root: RadialNode;
  children: RadialNode[];
}

export interface CrossLink {
  from: RadialNode;
  to: RadialNode;
  color: string;
}

export interface DiagramLayout {
  layouts: ClusterLayout[];
  width: number;
  height: number;
}

/** Shrinks child bubbles as a cluster gets crowded, so labels stay legible instead of overlapping. */
function childRadiusFor(n: number): number {
  if (n <= 10) return CHILD_R_BASE;
  return Math.max(CHILD_R_MIN, CHILD_R_BASE - (n - 10) * 1.4);
}

/** Grows the ring so evenly-spaced children never overlap each other or the root, however many there are. */
function ringRadiusFor(n: number, childR: number): number {
  if (n === 0) return 0;
  const minChord = 2 * childR + NODE_GAP;
  const bySpacing = n === 1 ? 0 : minChord / (2 * Math.sin(Math.PI / n));
  return Math.max(RING_R_BASE, ROOT_R + childR + NODE_GAP, bySpacing);
}

function buildSingleCluster(
  cluster: TopicCluster,
  articles: Article[],
  colorIdx: number
): { cluster: TopicCluster; colors: { root: string; child: string }; root: RadialNode; children: RadialNode[]; diameter: number } {
  const colors = PALETTE[colorIdx % PALETTE.length];
  const clusterArticles = articles.filter((a) => a.clusterId === cluster.id);
  const pillar = clusterArticles.find((a) => a.role === "pillar");
  const rest = clusterArticles.filter((a) => a.id !== pillar?.id);

  const n = rest.length;
  const childR = childRadiusFor(n);
  const ringR = ringRadiusFor(n, childR);

  const root: RadialNode = {
    id: pillar?.id ?? `cluster-${cluster.id}`,
    title: pillar?.title ?? cluster.name,
    url: pillar?.url,
    cx: 0,
    cy: 0,
    r: ROOT_R,
    fill: colors.root,
    isRoot: true,
    fontSize: 15,
    maxChars: 12,
  };

  const fontSize = Math.max(8, Math.round((13 * childR) / CHILD_R_BASE));
  const maxChars = Math.max(6, Math.round((10 * childR) / CHILD_R_BASE));

  const children: RadialNode[] = rest.map((a, i) => {
    const angle = n ? (i * (2 * Math.PI)) / n - Math.PI / 2 : 0;
    return {
      id: a.id,
      title: a.title,
      url: a.url,
      cx: ringR * Math.cos(angle),
      cy: ringR * Math.sin(angle),
      r: childR,
      fill: colors.child,
      isRoot: false,
      fontSize,
      maxChars,
    };
  });

  const diameter = 2 * (ringR + childR) + CLUSTER_MARGIN;
  return { cluster, colors, root, children, diameter };
}

/**
 * Packs clusters left-to-right, wrapping into rows (shelf packing), so the overall
 * canvas stays roughly square regardless of how many clusters/articles there are —
 * this keeps PDF tiling from degenerating into one absurdly tall column.
 */
export function layoutDiagram(clusters: TopicCluster[], articles: Article[]): DiagramLayout {
  if (clusters.length === 0) return { layouts: [], width: 0, height: 0 };

  const items = clusters.map((cluster, idx) => buildSingleCluster(cluster, articles, idx));
  const totalArea = items.reduce((sum, it) => sum + it.diameter * it.diameter, 0);
  const maxRowWidth = Math.max(1600, Math.sqrt(totalArea) * 1.15, ...items.map((it) => it.diameter));

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const layouts: ClusterLayout[] = [];

  for (const it of items) {
    if (cursorX > 0 && cursorX + it.diameter > maxRowWidth) {
      cursorY += rowHeight;
      cursorX = 0;
      rowHeight = 0;
    }
    const centerX = cursorX + it.diameter / 2;
    const centerY = cursorY + it.diameter / 2;

    layouts.push({
      cluster: it.cluster,
      colors: it.colors,
      root: { ...it.root, cx: centerX, cy: centerY },
      children: it.children.map((c) => ({ ...c, cx: c.cx + centerX, cy: c.cy + centerY })),
    });

    cursorX += it.diameter;
    rowHeight = Math.max(rowHeight, it.diameter);
  }

  return { layouts, width: maxRowWidth, height: cursorY + rowHeight };
}

export function buildCrossLinks(layouts: ClusterLayout[]): CrossLink[] {
  const links: CrossLink[] = [];
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
}

export function wrapLabel(text: string, maxCharsPerLine: number): string[] {
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
