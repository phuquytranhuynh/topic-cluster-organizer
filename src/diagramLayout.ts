import type { Article, TopicCluster } from "./types";

export const ROOT_R = 70;
const CHILD_R_MIN = 26;
const RING_R_BASE = 158;
const NODE_GAP = 10;
const CLUSTER_MARGIN = 60;

/** Successive multiples of the golden angle spread hues evenly around the wheel with no exact repeats. */
const GOLDEN_ANGLE = 137.50776405003785;

/** h in degrees [0,360); s, l as fractions [0,1]. */
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Deterministic, effectively-unlimited color for a cluster by index — no two clusters ever collide,
 * unlike a small fixed palette that has to repeat once you run out of entries. Root/child share a hue
 * (so a cluster still reads as one family) but differ in lightness so the two roles stay visually
 * distinct from each other too.
 */
export function colorForClusterIndex(index: number): { root: string; child: string } {
  const hue = (index * GOLDEN_ANGLE) % 360;
  return {
    root: hslToHex(hue, 0.62, 0.42),
    child: hslToHex(hue, 0.55, 0.26),
  };
}

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
  /** id of the article this node's PillarOf points to (may live in another cluster) — drives cross-cluster links. */
  linksTo: string | null;
  /** monthly search volume, shown as a smaller line under the title; null if not provided. */
  volume: number | null;
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

export interface Bounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface DiagramLayout {
  layouts: ClusterLayout[];
  bounds: Bounds;
}

/** Room around a node's true radius reserved for its wrapped label overshooting the circle. */
const BOUNDS_PADDING = 90;

/**
 * Bounding box of every node's full extent (radius + label padding). Works for the auto-packed layout
 * as well as one with manual drag overrides applied — including overrides that push nodes into negative
 * coordinates — so callers never need to assume the diagram starts at (0, 0).
 */
export function computeBounds(layouts: ClusterLayout[]): Bounds {
  if (layouts.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layout of layouts) {
    for (const node of [layout.root, ...layout.children]) {
      minX = Math.min(minX, node.cx - node.r - BOUNDS_PADDING);
      maxX = Math.max(maxX, node.cx + node.r + BOUNDS_PADDING);
      minY = Math.min(minY, node.cy - node.r - BOUNDS_PADDING);
      maxY = Math.max(maxY, node.cy + node.r + BOUNDS_PADDING);
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/** Replaces node positions with any manually dragged overrides (keyed by node id), leaving layout shape/colors/links intact. */
export function applyPositionOverrides(
  layouts: ClusterLayout[],
  overrides: Record<string, { x: number; y: number }>
): ClusterLayout[] {
  if (Object.keys(overrides).length === 0) return layouts;
  const withOverride = (node: RadialNode): RadialNode => {
    const o = overrides[node.id];
    return o ? { ...node, cx: o.x, cy: o.y } : node;
  };
  return layouts.map((layout) => ({
    ...layout,
    root: withOverride(layout.root),
    children: layout.children.map(withOverride),
  }));
}

/**
 * Base radius for a Supporting bubble before its depth-based scale is applied — same base as a
 * Pillar (ROOT_R), since size should depend only on depth, not on Pillar vs. Supporting role.
 * Shrinks as a cluster gets crowded, so labels stay legible instead of overlapping.
 */
function childRadiusFor(n: number): number {
  if (n <= 10) return ROOT_R;
  return Math.max(CHILD_R_MIN, ROOT_R - (n - 10) * 1.4);
}

/** Grows the ring so evenly-spaced children never overlap each other or the root, however many there are. */
function ringRadiusFor(n: number, childR: number, rootR: number, levelScale: number): number {
  if (n === 0) return 0;
  const minChord = 2 * childR + NODE_GAP;
  const bySpacing = n === 1 ? 0 : minChord / (2 * Math.sin(Math.PI / n));
  return Math.max(RING_R_BASE * levelScale, rootR + childR + NODE_GAP, bySpacing);
}

interface ClusterMeta {
  colors: { root: string; child: string };
  /** 0 for a standalone/root cluster; parentDepth+1 for one chained onto another via PillarOf. */
  depth: number;
}

/**
 * For each cluster, the id of the OTHER cluster it hangs off of — i.e. some article in this cluster
 * (its Pillar first, else whichever Supporting article declares it) has PillarOf pointing at a node
 * that lives in a different cluster. Clusters with no such link are standalone/root clusters.
 */
function resolveParentClusterIds(articles: Article[]): Map<string, string> {
  const clusterIdByArticleId = new Map<string, string>();
  for (const a of articles) clusterIdByArticleId.set(a.id, a.clusterId);

  const parentOf = new Map<string, string>();
  const pillarsFirst = [...articles].sort((a, b) => Number(a.role !== "pillar") - Number(b.role !== "pillar"));
  for (const a of pillarsFirst) {
    if (parentOf.has(a.clusterId) || !a.linksTo) continue;
    const targetClusterId = clusterIdByArticleId.get(a.linksTo);
    if (targetClusterId && targetClusterId !== a.clusterId) {
      parentOf.set(a.clusterId, targetClusterId);
    }
  }
  return parentOf;
}

/**
 * Resolves each cluster's color and depth by walking the PillarOf chain: a chained cluster's root
 * takes its parent's Supporting color (so every cluster chained onto the same parent visually reads
 * as "part of that branch", duplicates included) and sits one level deeper for sizing purposes. A
 * standalone cluster — and the fallback for a cycle or a dangling link — gets its own unique hue.
 *
 * A cluster with a manually-set `color` (via the right-click "Đổi màu cụm" picker) overrides all of
 * this: every bubble in that cluster — Pillar and Supporting alike — uses the exact same custom color,
 * and any cluster chained onto it still inherits that color for its own root, same as auto-colors do.
 */
function resolveClusterMeta(clusters: TopicCluster[], parentOf: Map<string, string>): Map<string, ClusterMeta> {
  const clusterIds = new Set(clusters.map((c) => c.id));
  const clusterById = new Map(clusters.map((c) => [c.id, c]));
  const meta = new Map<string, ClusterMeta>();
  const resolving = new Set<string>();
  let nextIdx = 0;

  function resolve(clusterId: string) {
    if (meta.has(clusterId)) return;
    const parentId = parentOf.get(clusterId);
    let colors: { root: string; child: string };
    let depth: number;
    if (!parentId || !clusterIds.has(parentId) || resolving.has(clusterId)) {
      colors = colorForClusterIndex(nextIdx++);
      depth = 0;
    } else {
      resolving.add(clusterId);
      resolve(parentId);
      resolving.delete(clusterId);
      const parentMeta = meta.get(parentId)!;
      colors = { root: parentMeta.colors.child, child: colorForClusterIndex(nextIdx++).child };
      depth = parentMeta.depth + 1;
    }
    const customColor = clusterById.get(clusterId)?.color;
    if (customColor) colors = { root: customColor, child: customColor };
    meta.set(clusterId, { colors, depth });
  }

  for (const c of clusters) resolve(c.id);
  return meta;
}

/** Bubbles shrink 7% of the original size per hierarchy level (linear, not compounding), floored so a long chain never collapses to nothing. */
function levelScaleFor(depth: number): number {
  return Math.max(0.25, 1 - 0.07 * depth);
}

function buildSingleCluster(
  cluster: TopicCluster,
  articles: Article[],
  meta: ClusterMeta
): { cluster: TopicCluster; colors: { root: string; child: string }; root: RadialNode; children: RadialNode[]; diameter: number } {
  const { colors, depth } = meta;
  // Size depends only on depth, not on Pillar vs. Supporting role — a Supporting bubble sits one
  // level deeper than its own Pillar, so it's the same size as a Pillar chained directly onto that
  // Pillar would be (e.g. a Supporting bubble in the root cluster == the root's own chained clusters).
  const rootScale = levelScaleFor(depth);
  const childScale = levelScaleFor(depth + 1);

  const clusterArticles = articles.filter((a) => a.clusterId === cluster.id);
  const pillar = clusterArticles.find((a) => a.role === "pillar");
  const rest = clusterArticles.filter((a) => a.id !== pillar?.id);

  const n = rest.length;
  const rootR = ROOT_R * rootScale;
  const childR = childRadiusFor(n) * childScale;
  const ringR = ringRadiusFor(n, childR, rootR, rootScale);

  const root: RadialNode = {
    id: pillar?.id ?? `cluster-${cluster.id}`,
    title: pillar?.title ?? cluster.name,
    url: pillar?.url,
    cx: 0,
    cy: 0,
    r: rootR,
    fill: colors.root,
    isRoot: true,
    fontSize: Math.max(9, Math.round(15 * rootScale)),
    maxChars: Math.max(6, Math.round(12 * rootScale)),
    linksTo: pillar?.linksTo ?? null,
    volume: pillar?.volume ?? null,
  };

  const fontSize = Math.max(8, Math.round((13 * childR) / ROOT_R));
  const maxChars = Math.max(6, Math.round((10 * childR) / ROOT_R));

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
      linksTo: a.linksTo,
      volume: a.volume,
    };
  });

  const diameter = 2 * (ringR + childR) + CLUSTER_MARGIN * rootScale;
  return { cluster, colors, root, children, diameter };
}

/**
 * Packs clusters left-to-right, wrapping into rows (shelf packing), so the overall
 * canvas stays roughly square regardless of how many clusters/articles there are —
 * this keeps PDF tiling from degenerating into one absurdly tall column.
 */
export function layoutDiagram(clusters: TopicCluster[], articles: Article[]): DiagramLayout {
  if (clusters.length === 0) return { layouts: [], bounds: { minX: 0, minY: 0, width: 0, height: 0 } };

  const parentOf = resolveParentClusterIds(articles);
  const clusterMeta = resolveClusterMeta(clusters, parentOf);
  const items = clusters.map((cluster) => buildSingleCluster(cluster, articles, clusterMeta.get(cluster.id)!));
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

  return { layouts, bounds: computeBounds(layouts) };
}

/**
 * Draws a line between clusters whenever a node explicitly declares (via PillarOf) that it hangs
 * off a node in ANOTHER cluster — this is how a Pillar's whole cluster chains onto a parent cluster,
 * letting you build maps with as many levels as you have clusters willing to link up.
 */
export function buildCrossLinks(layouts: ClusterLayout[]): CrossLink[] {
  const nodeIndex = new Map<string, { node: RadialNode; clusterId: string; clusterColor: string }>();
  for (const layout of layouts) {
    for (const node of [layout.root, ...layout.children]) {
      nodeIndex.set(node.id, { node, clusterId: layout.cluster.id, clusterColor: layout.colors.root });
    }
  }

  const links: CrossLink[] = [];
  for (const layout of layouts) {
    for (const node of [layout.root, ...layout.children]) {
      if (!node.linksTo) continue;
      const target = nodeIndex.get(node.linksTo);
      if (!target || target.clusterId === layout.cluster.id) continue;
      links.push({ from: node, to: target.node, color: target.clusterColor });
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

/** "12345" -> "12.345" (Vietnamese thousands separator), for the volume line under a title. */
export function formatVolume(n: number): string {
  return n.toLocaleString("vi-VN");
}

export interface LabelLayout {
  titleLines: string[];
  lineHeight: number;
  /** y of the first title line, relative to the node's center. */
  startY: number;
  volumeText: string | null;
  volumeFontSize: number;
  /** y of the volume line, relative to the node's center; only meaningful when volumeText is set. */
  volumeY: number;
}

/**
 * Vertical layout for a node's label (wrapped title, plus an optional smaller search-volume line
 * right below it), centered as one block on the node. Shared by the on-screen SVG renderer and the
 * PDF exporter so the two never drift apart.
 */
export function computeLabelLayout(node: RadialNode): LabelLayout {
  const titleLines = wrapLabel(node.title, node.maxChars);
  const lineHeight = node.fontSize * 1.15;
  const hasVolume = node.volume != null;
  const volumeFontSize = Math.max(7, Math.round(node.fontSize * 0.7));
  const volumeLineHeight = volumeFontSize * 1.15;
  const gap = 2;
  const totalHeight = titleLines.length * lineHeight + (hasVolume ? gap + volumeLineHeight : 0);
  const startY = -totalHeight / 2 + lineHeight / 2;
  const volumeY = hasVolume
    ? startY + (titleLines.length - 1) * lineHeight + lineHeight / 2 + gap + volumeLineHeight / 2
    : 0;
  return {
    titleLines,
    lineHeight,
    startY,
    volumeText: hasVolume ? formatVolume(node.volume as number) : null,
    volumeFontSize,
    volumeY,
  };
}
