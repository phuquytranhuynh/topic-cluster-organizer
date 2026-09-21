import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { ColorPickerModal } from "./ColorPickerModal";
import { DistanceAdjustModal } from "./DistanceAdjustModal";
import { RotateAdjustModal } from "./RotateAdjustModal";
import { SizeAdjustModal } from "./SizeAdjustModal";
import { SpacingAdjustModal } from "./SpacingAdjustModal";
import { TextStyleAdjustModal } from "./TextStyleAdjustModal";
import {
  applyPositionOverrides,
  buildCrossLinks,
  colorForClusterIndex,
  computeBounds,
  computeLabelLayout,
  layoutDiagram,
  resolveClusterChainLinks,
  type ClusterLayout,
  type DiagramLayout,
  type RadialNode,
} from "../diagramLayout";
import { clearPositions, loadPositions, savePositions, type PositionOverrides } from "../diagramPositions";
import { sanitizeFilename } from "../filename";
import { FIT_OPTION, PAGE_FORMATS, estimatePageGrid, type PageFormatId } from "../pdf/pageFormats";
import { useStore, type ArticleDisplayOverrides } from "../store";

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.3;

/**
 * One undo/redo-able edit made on the diagram — a batch of position moves (drag, distance, or spacing
 * adjust), a cluster recolor, or a batch of per-article display overrides (size/font/chars/padding).
 */
type UndoEntry =
  | { type: "position"; prev: PositionOverrides }
  | { type: "color"; clusterId: string; prevColor: string | null }
  | { type: "display"; patchByArticleId: Record<string, ArticleDisplayOverrides> };

export function ClusterDiagram() {
  const { data, clusters, articles, updateClusterColor, updateArticlesDisplay } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<d3.ZoomTransform | null>(null);
  const prevBaseLayoutsRef = useRef<DiagramLayout["layouts"] | null>(null);
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  // Kept in sync every render so the keydown-triggered undo/redo (attached once, on mount) always
  // reads the current values instead of whatever they were when that listener was first attached.
  const overridesRef = useRef<PositionOverrides>({});
  const clustersRef = useRef(clusters);
  const articlesRef = useRef(articles);
  const [pageFormat, setPageFormat] = useState<PageFormatId>("a3");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PositionOverrides>(() => loadPositions());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clusterId: string; nodeId: string } | null>(
    null
  );
  const [colorPicker, setColorPicker] = useState<{ clusterId: string; initialColor: string } | null>(null);
  const [distancePicker, setDistancePicker] = useState<{
    clusterId: string;
    referenceLabel: string;
    referenceDistance: number;
  } | null>(null);
  const [spacingPicker, setSpacingPicker] = useState<{ clusterId: string; currentCount: number } | null>(null);
  const [sizePicker, setSizePicker] = useState<{ clusterId: string; referenceLabel: string; referenceRadius: number } | null>(
    null
  );
  const [textStylePicker, setTextStylePicker] = useState<{
    clusterId: string;
    referenceLabel: string;
    fontSize: number;
    maxChars: number;
    labelPadding: number;
  } | null>(null);
  const [rotatePicker, setRotatePicker] = useState<{ clusterId: string } | null>(null);
  overridesRef.current = overrides;
  clustersRef.current = clusters;
  articlesRef.current = articles;

  const { layouts: baseLayouts } = useMemo(() => layoutDiagram(clusters, articles), [clusters, articles]);
  const layouts = useMemo(() => applyPositionOverrides(baseLayouts, overrides), [baseLayouts, overrides]);
  const crossLinks = useMemo(() => buildCrossLinks(layouts), [layouts]);
  const bounds = useMemo(() => computeBounds(layouts), [layouts]);
  // clusterId -> {parentClusterId, anchorNodeId}, for the Ctrl+drag "move whole chain" gesture and for
  // cascading a distance adjustment down into whatever's chained onto the bubbles that just moved.
  const chainLinks = useMemo(() => resolveClusterChainLinks(articles), [articles]);
  // clusterId -> ids of clusters chained directly onto it.
  const childClusterIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [childId, link] of chainLinks) {
      const list = map.get(link.parentClusterId);
      if (list) list.push(childId);
      else map.set(link.parentClusterId, [childId]);
    }
    return map;
  }, [chainLinks]);
  // anchor article id -> ids of clusters chained onto exactly that article.
  const clustersAnchoredAt = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [childId, link] of chainLinks) {
      const list = map.get(link.anchorNodeId);
      if (list) list.push(childId);
      else map.set(link.anchorNodeId, [childId]);
    }
    return map;
  }, [chainLinks]);
  const layoutByClusterId = useMemo(() => new Map(layouts.map((l) => [l.cluster.id, l])), [layouts]);
  const nodeById = useMemo(() => {
    const map = new Map<string, RadialNode>();
    for (const l of layouts) for (const n of [l.root, ...l.children]) map.set(n.id, n);
    return map;
  }, [layouts]);
  // nodeId -> id of the cluster it belongs to (as its root OR as one of its Supporting children).
  const clusterIdByNodeId = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of layouts) for (const n of [l.root, ...l.children]) map.set(n.id, l.cluster.id);
    return map;
  }, [layouts]);

  function collectChainNodes(clusterId: string, visited = new Set<string>()): RadialNode[] {
    if (visited.has(clusterId)) return [];
    visited.add(clusterId);
    const layout = layoutByClusterId.get(clusterId);
    const nodes = layout ? [layout.root, ...layout.children] : [];
    for (const childId of childClusterIds.get(clusterId) ?? []) {
      nodes.push(...collectChainNodes(childId, visited));
    }
    return nodes;
  }

  /**
   * A cluster's "ring" for distance/spacing purposes is its own Supporting bubbles PLUS the Pillar
   * bubble of every cluster chained directly onto it (anywhere within it) — a chained cluster's Pillar
   * reads visually as "one of this cluster's satellites" even though it's the root of its own cluster.
   */
  function getRingPeers(clusterId: string): { node: RadialNode; ownClusterId: string | null }[] {
    const liveLayout = layoutByClusterId.get(clusterId);
    if (!liveLayout) return [];
    const peers: { node: RadialNode; ownClusterId: string | null }[] = liveLayout.children.map((node) => ({
      node,
      ownClusterId: null,
    }));
    for (const childClusterId of childClusterIds.get(clusterId) ?? []) {
      const childLayout = layoutByClusterId.get(childClusterId);
      if (childLayout) peers.push({ node: childLayout.root, ownClusterId: childClusterId });
    }
    return peers;
  }

  /**
   * Which cluster's ring a right-clicked bubble belongs to, for distance/spacing purposes: its own
   * cluster if it's a Supporting bubble, or the PARENT cluster if it's the Pillar of a chained cluster
   * (null if it's a Pillar with no parent — a standalone/root cluster has no ring to be a member of).
   */
  function targetClusterForNode(nodeId: string): string | null {
    const node = nodeById.get(nodeId);
    const ownClusterId = clusterIdByNodeId.get(nodeId);
    if (!node || !ownClusterId) return null;
    if (!node.isRoot) return ownClusterId;
    return chainLinks.get(ownClusterId)?.parentClusterId ?? null;
  }

  const pageEstimate = useMemo(
    () => estimatePageGrid(bounds.width, bounds.height, pageFormat),
    [bounds, pageFormat]
  );

  function commitOverrides(updates: PositionOverrides) {
    setOverrides((prev) => {
      const next = { ...prev, ...updates };
      savePositions(next);
      return next;
    });
  }

  function handleResetPositions() {
    setOverrides({});
    clearPositions();
  }

  function pushUndo(entry: UndoEntry) {
    undoStackRef.current.push(entry);
    redoStackRef.current = [];
  }

  /** The entry that would reverse `entry`, captured from the state right before `entry` is (re)applied. */
  function captureInverse(entry: UndoEntry): UndoEntry {
    if (entry.type === "position") return { type: "position", prev: overridesRef.current };
    if (entry.type === "color") {
      return {
        type: "color",
        clusterId: entry.clusterId,
        prevColor: clustersRef.current.find((c) => c.id === entry.clusterId)?.color ?? null,
      };
    }
    const patchByArticleId: Record<string, ArticleDisplayOverrides> = {};
    for (const [articleId, patch] of Object.entries(entry.patchByArticleId)) {
      const article = articlesRef.current.find((a) => a.id === articleId);
      const prev: ArticleDisplayOverrides = {};
      for (const key of Object.keys(patch) as (keyof ArticleDisplayOverrides)[]) {
        prev[key] = article?.[key] ?? null;
      }
      patchByArticleId[articleId] = prev;
    }
    return { type: "display", patchByArticleId };
  }

  function applyEntry(entry: UndoEntry) {
    if (entry.type === "position") {
      setOverrides(entry.prev);
      savePositions(entry.prev);
    } else if (entry.type === "color") {
      updateClusterColor(entry.clusterId, entry.prevColor);
    } else {
      updateArticlesDisplay(entry.patchByArticleId);
    }
  }

  function undo() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    redoStackRef.current.push(captureInverse(entry));
    applyEntry(entry);
  }

  function redo() {
    const entry = redoStackRef.current.pop();
    if (!entry) return;
    undoStackRef.current.push(captureInverse(entry));
    applyEntry(entry);
  }

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, the last drag / distance adjustment / cluster recolor
  // made in this diagram. Mounted once — undo/redo read overridesRef/clustersRef (kept fresh every
  // render above) rather than closing over stale state, so there's no stale-closure risk here.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Dismiss the context menu on Escape or on any click elsewhere; the menu/modal backdrops handle
  // click-outside themselves, this only needs to cover the keyboard case.
  useEffect(() => {
    if (!contextMenu) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setContextMenu(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenu]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    if (layouts.length === 0) return;

    const zoomLayer = svg.append("g").attr("class", "zoom-layer");
    const linkLayer = zoomLayer.append("g").attr("class", "links");
    const nodeLayer = zoomLayer.append("g").attr("class", "nodes");

    // Live positions for this render pass. Drag mutates only this map + the DOM directly (never the
    // memoized RadialNode objects), so redraws stay driven purely by React state.
    const livePos = new Map<string, { x: number; y: number }>();
    const clusterByNodeId = new Map<string, ClusterLayout>();
    for (const layout of layouts) {
      for (const node of [layout.root, ...layout.children]) {
        livePos.set(node.id, { x: node.cx, y: node.cy });
        clusterByNodeId.set(node.id, layout);
      }
    }

    const linesByNodeId = new Map<string, { el: SVGLineElement; end: "from" | "to" }[]>();
    function addLineRef(nodeId: string, el: SVGLineElement, end: "from" | "to") {
      let list = linesByNodeId.get(nodeId);
      if (!list) {
        list = [];
        linesByNodeId.set(nodeId, list);
      }
      list.push({ el, end });
    }
    function registerLine(el: SVGLineElement, fromId: string, toId: string) {
      addLineRef(fromId, el, "from");
      addLineRef(toId, el, "to");
    }

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
        .attr("stroke-width", 2)
        .each(function (d) {
          registerLine(this as SVGLineElement, d.from.id, d.to.id);
        });
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
      .attr("stroke-dasharray", "6 4")
      .each(function (d) {
        registerLine(this as SVGLineElement, d.from.id, d.to.id);
      });

    const allNodes = layouts.flatMap((l) => [l.root, ...l.children]);
    const groupByNodeId = new Map<string, SVGGElement>();

    const nodeGroups = nodeLayer
      .selectAll<SVGGElement, RadialNode>("g.node")
      .data(allNodes)
      .join("g")
      .attr("class", "node")
      .attr("data-id", (d) => d.id)
      .attr("transform", (d) => `translate(${d.cx}, ${d.cy})`)
      .each(function (d) {
        groupByNodeId.set(d.id, this);
      });

    nodeGroups
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => d.fill);

    nodeGroups.each(function (d) {
      const label = computeLabelLayout(d);
      const text = d3
        .select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("fill", "#fff")
        .attr("font-weight", 700)
        .attr("font-size", d.fontSize);
      label.titleLines.forEach((line, i) => {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("y", label.startY + i * label.lineHeight)
          .text(line);
      });
      if (label.volumeText) {
        text
          .append("tspan")
          .attr("x", 0)
          .attr("y", label.volumeY)
          .attr("font-size", label.volumeFontSize)
          .attr("font-weight", 400)
          .attr("fill-opacity", 0.85)
          .text(label.volumeText);
      }
      const titleAttr = d.volume != null ? `${d.title} (${d.volume.toLocaleString("vi-VN")})` : d.title;
      d3.select(this).append("title").text(`${titleAttr}${d.url ? ` — ${d.url}` : ""}`);
    });

    // Right-click a bubble to recolor its whole cluster or adjust distances. Stops propagation so the
    // svg-level handler below (which closes the menu for a right-click on empty background) doesn't
    // immediately re-close it.
    nodeGroups.on("contextmenu", function (event: MouseEvent, d) {
      event.preventDefault();
      event.stopPropagation();
      const layout = clusterByNodeId.get(d.id);
      if (!layout) return;
      setContextMenu({ x: event.clientX, y: event.clientY, clusterId: layout.cluster.id, nodeId: d.id });
    });
    svg.on("contextmenu", (event: MouseEvent) => {
      event.preventDefault();
      setContextMenu(null);
    });

    function moveNode(node: RadialNode, x: number, y: number) {
      livePos.set(node.id, { x, y });
      const g = groupByNodeId.get(node.id);
      if (g) g.setAttribute("transform", `translate(${x}, ${y})`);
      const lines = linesByNodeId.get(node.id);
      if (!lines) return;
      for (const { el, end } of lines) {
        el.setAttribute(end === "from" ? "x1" : "x2", String(x));
        el.setAttribute(end === "from" ? "y1" : "y2", String(y));
      }
    }

    // Set once at the start of each drag gesture (single-pointer mouse/touch drag, so one gesture at
    // a time) and reused for its "drag"/"end" ticks.
    let dragMoveSet: RadialNode[] = [];

    const dragBehavior = d3
      .drag<SVGGElement, RadialNode>()
      // d3-drag's default filter ignores any gesture where ctrlKey is held — override it so
      // Ctrl+drag (the "move the whole chain" gesture) can still start.
      .filter((event) => !event.button)
      .on("start", function (event, d) {
        // Keep the svg-level zoom/pan behavior from also treating this pointerdown as a pan gesture.
        event.sourceEvent?.stopPropagation();
        d3.select(this).raise().classed("dragging", true);
        const layout = clusterByNodeId.get(d.id);
        const ctrlHeld = Boolean(event.sourceEvent?.ctrlKey || event.sourceEvent?.metaKey);
        if (ctrlHeld && layout) {
          dragMoveSet = collectChainNodes(layout.cluster.id);
        } else {
          dragMoveSet = d.isRoot && layout ? [layout.root, ...layout.children] : [d];
        }
      })
      .on("drag", function (event) {
        for (const node of dragMoveSet) {
          const p = livePos.get(node.id)!;
          moveNode(node, p.x + event.dx, p.y + event.dy);
        }
      })
      .on("end", function () {
        d3.select(this).classed("dragging", false);
        const updates: PositionOverrides = {};
        for (const node of dragMoveSet) updates[node.id] = livePos.get(node.id)!;
        pushUndo({ type: "position", prev: overrides });
        commitOverrides(updates);
        dragMoveSet = [];
      });

    nodeGroups.call(dragBehavior);

    // Pan/zoom the whole canvas. Attached to the svg background; node drags stop propagation above
    // so the two gestures never fight over the same pointer.
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([ZOOM_MIN, ZOOM_MAX])
      .on("zoom", (event) => {
        zoomLayer.attr("transform", event.transform.toString());
        currentTransformRef.current = event.transform;
      });
    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    const viewportW = svgEl.clientWidth || bounds.width;
    const viewportH = svgEl.clientHeight || bounds.height;
    const fitScale = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(viewportW / bounds.width, viewportH / bounds.height) * 0.92)
    );
    const fitTransform = d3.zoomIdentity
      .translate(
        viewportW / 2 - (bounds.minX + bounds.width / 2) * fitScale,
        viewportH / 2 - (bounds.minY + bounds.height / 2) * fitScale
      )
      .scale(fitScale);

    const isNewData = prevBaseLayoutsRef.current !== baseLayouts;
    prevBaseLayoutsRef.current = baseLayouts;

    if (isNewData || !currentTransformRef.current) {
      svg.call(zoomBehavior.transform, fitTransform);
    } else {
      svg.call(zoomBehavior.transform, currentTransformRef.current);
    }
  }, [layouts, crossLinks, bounds, baseLayouts, childClusterIds]);

  function zoomBy(factor: number) {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomBehaviorRef.current) return;
    d3.select(svgEl).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor);
  }

  function handleFitToScreen() {
    const svgEl = svgRef.current;
    if (!svgEl || !zoomBehaviorRef.current) return;
    const viewportW = svgEl.clientWidth || bounds.width;
    const viewportH = svgEl.clientHeight || bounds.height;
    const fitScale = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(viewportW / bounds.width, viewportH / bounds.height) * 0.92)
    );
    const fitTransform = d3.zoomIdentity
      .translate(
        viewportW / 2 - (bounds.minX + bounds.width / 2) * fitScale,
        viewportH / 2 - (bounds.minY + bounds.height / 2) * fitScale
      )
      .scale(fitScale);
    d3.select(svgEl).transition().duration(250).call(zoomBehaviorRef.current.transform, fitTransform);
  }

  async function handleExportPdf() {
    setExporting(true);
    setExportError(null);
    try {
      const { exportDiagramToPdf } = await import("../pdf/exportDiagramPdf");
      const baseFilename = sanitizeFilename(data.diagramName ?? "", "topic-cluster-diagram");
      await exportDiagramToPdf({
        layouts,
        crossLinks,
        bounds,
        pageFormat,
        filename: `${baseFilename}.pdf`,
        title: data.diagramName?.trim() || undefined,
      });
    } catch (err) {
      setExportError((err as Error).message || "Xuất PDF thất bại.");
    } finally {
      setExporting(false);
    }
  }

  function openColorPicker(clusterId: string) {
    // Reference the Supporting color, not the Pillar's — this action only ever recolors Supporting
    // bubbles, so the picker should preview/start from the color it's actually about to change.
    const currentColor = layouts.find((l) => l.cluster.id === clusterId)?.colors.child ?? "#2563eb";
    setColorPicker({ clusterId, initialColor: currentColor });
    setContextMenu(null);
  }

  function applyClusterColor(clusterId: string, color: string | null) {
    const prevColor = clusters.find((c) => c.id === clusterId)?.color ?? null;
    pushUndo({ type: "color", clusterId, prevColor });
    updateClusterColor(clusterId, color);
    setColorPicker(null);
  }

  function openDistancePicker(nodeId: string) {
    const clusterId = targetClusterForNode(nodeId);
    const targetLayout = clusterId ? layoutByClusterId.get(clusterId) : null;
    const node = nodeById.get(nodeId);
    if (!clusterId || !targetLayout || !node) return;
    const referenceDistance = Math.hypot(node.cx - targetLayout.root.cx, node.cy - targetLayout.root.cy);
    setDistancePicker({ clusterId, referenceLabel: node.title, referenceDistance });
    setContextMenu(null);
  }

  /**
   * Moves every peer in `clusterId`'s ring (its own Supporting bubbles, plus the Pillar bubble of any
   * cluster chained directly onto it — see {@link getRingPeers}) to the position `place` computes from
   * its current position and the ring's root. A peer that is itself a chained cluster's Pillar carries
   * its whole subtree along, rigidly, by the same delta (own children plus anything chained further
   * below, however deep); a genuine Supporting peer instead cascades into whatever's chained onto that
   * specific bubble — same as Ctrl+drag's "move the whole chain" gesture, just per-peer instead of
   * one uniform delta for the whole gesture.
   */
  function applyRingTransform(
    clusterId: string,
    place: (node: RadialNode, rootPos: { x: number; y: number }) => { x: number; y: number }
  ): PositionOverrides | null {
    const liveLayout = layoutByClusterId.get(clusterId);
    const peers = getRingPeers(clusterId);
    if (!liveLayout || peers.length === 0) return null;

    const rootPos = { x: liveLayout.root.cx, y: liveLayout.root.cy };
    const updates: PositionOverrides = {};
    const shiftedClusters = new Set([clusterId]);

    for (const { node, ownClusterId } of peers) {
      const { x: newX, y: newY } = place(node, rootPos);
      updates[node.id] = { x: newX, y: newY };
      const dx = newX - node.cx;
      const dy = newY - node.cy;
      if (dx === 0 && dy === 0) continue;

      if (ownClusterId) {
        // This peer is the Pillar of a chained cluster — its own children, and anything chained
        // beneath it at any depth, move with it as one rigid unit.
        shiftedClusters.add(ownClusterId);
        for (const chainNode of collectChainNodes(ownClusterId)) {
          if (chainNode.id === node.id) continue;
          const current = nodeById.get(chainNode.id);
          if (current) updates[chainNode.id] = { x: current.cx + dx, y: current.cy + dy };
        }
      } else {
        for (const childClusterId of clustersAnchoredAt.get(node.id) ?? []) {
          if (shiftedClusters.has(childClusterId)) continue;
          shiftedClusters.add(childClusterId);
          for (const chainNode of collectChainNodes(childClusterId)) {
            const current = nodeById.get(chainNode.id);
            if (current) updates[chainNode.id] = { x: current.cx + dx, y: current.cy + dy };
          }
        }
      }
    }
    return updates;
  }

  /**
   * Sets every peer in this cluster's ring to the SAME absolute distance from its Pillar — whichever
   * peer was longer or shorter before, all end up at exactly `targetDistance`. Each peer keeps its
   * current direction from the Pillar; only the distance changes.
   */
  function applyDistanceScale(clusterId: string, targetDistance: number) {
    const updates = applyRingTransform(clusterId, (node, rootPos) => {
      const angle = Math.atan2(node.cy - rootPos.y, node.cx - rootPos.x);
      return { x: rootPos.x + targetDistance * Math.cos(angle), y: rootPos.y + targetDistance * Math.sin(angle) };
    });
    setDistancePicker(null);
    if (!updates) return;
    pushUndo({ type: "position", prev: overrides });
    commitOverrides(updates);
  }

  function openSpacingPicker(nodeId: string) {
    const clusterId = targetClusterForNode(nodeId);
    const currentCount = clusterId ? getRingPeers(clusterId).length : 0;
    if (!clusterId || currentCount === 0) return;
    setSpacingPicker({ clusterId, currentCount });
    setContextMenu(null);
  }

  /**
   * Redistributes every peer in this cluster's ring evenly across `slotCount` angular positions around
   * its Pillar (kept in their current rotational order), leaving unused arc as open space when
   * slotCount exceeds the actual peer count. Each peer's current distance from the Pillar is kept —
   * only its angle changes.
   */
  function applySpacing(clusterId: string, slotCount: number) {
    const liveLayout = layoutByClusterId.get(clusterId);
    if (!liveLayout) {
      setSpacingPicker(null);
      return;
    }
    const rootPos = { x: liveLayout.root.cx, y: liveLayout.root.cy };
    const ordered = getRingPeers(clusterId).sort(
      (a, b) =>
        Math.atan2(a.node.cy - rootPos.y, a.node.cx - rootPos.x) -
        Math.atan2(b.node.cy - rootPos.y, b.node.cx - rootPos.x)
    );
    const slotAngleByNodeId = new Map<string, number>();
    ordered.forEach(({ node }, i) => slotAngleByNodeId.set(node.id, (i * (2 * Math.PI)) / slotCount - Math.PI / 2));

    const updates = applyRingTransform(clusterId, (node, rootPos) => {
      const dist = Math.hypot(node.cx - rootPos.x, node.cy - rootPos.y);
      const angle = slotAngleByNodeId.get(node.id) ?? 0;
      return { x: rootPos.x + dist * Math.cos(angle), y: rootPos.y + dist * Math.sin(angle) };
    });
    setSpacingPicker(null);
    if (!updates) return;
    pushUndo({ type: "position", prev: overrides });
    commitOverrides(updates);
  }

  function openRotatePicker(nodeId: string) {
    const clusterId = targetClusterForNode(nodeId);
    if (!clusterId) return;
    setRotatePicker({ clusterId });
    setContextMenu(null);
  }

  /**
   * Spins every peer in this cluster's ring around its Pillar by `degrees` — each peer keeps its
   * current distance and its angular spacing relative to the others, only the whole ring's orientation
   * changes. Only bubble POSITIONS rotate; each label is still drawn upright, never rotated with it.
   */
  function applyRotation(clusterId: string, degrees: number) {
    const radians = (degrees * Math.PI) / 180;
    const updates = applyRingTransform(clusterId, (node, rootPos) => {
      const dist = Math.hypot(node.cx - rootPos.x, node.cy - rootPos.y);
      const angle = Math.atan2(node.cy - rootPos.y, node.cx - rootPos.x) + radians;
      return { x: rootPos.x + dist * Math.cos(angle), y: rootPos.y + dist * Math.sin(angle) };
    });
    setRotatePicker(null);
    if (!updates) return;
    pushUndo({ type: "position", prev: overrides });
    commitOverrides(updates);
  }

  /**
   * Writes the same display-override patch onto every peer article in this cluster's ring — used by
   * size and text-style adjustment alike. Passing `null` for a field clears that override, falling
   * back to the auto depth-based default.
   */
  function applyDisplayPatch(clusterId: string, patch: ArticleDisplayOverrides) {
    const peerArticleIds = getRingPeers(clusterId)
      .map(({ node }) => node.id)
      .filter((id) => articles.some((a) => a.id === id));
    if (peerArticleIds.length === 0) return;

    const keys = Object.keys(patch) as (keyof ArticleDisplayOverrides)[];
    const patchByArticleId: Record<string, ArticleDisplayOverrides> = {};
    const prevByArticleId: Record<string, ArticleDisplayOverrides> = {};
    for (const articleId of peerArticleIds) {
      const article = articles.find((a) => a.id === articleId)!;
      patchByArticleId[articleId] = patch;
      const prev: ArticleDisplayOverrides = {};
      for (const key of keys) prev[key] = article[key] ?? null;
      prevByArticleId[articleId] = prev;
    }
    pushUndo({ type: "display", patchByArticleId: prevByArticleId });
    updateArticlesDisplay(patchByArticleId);
  }

  function openSizePicker(nodeId: string) {
    const clusterId = targetClusterForNode(nodeId);
    const node = nodeById.get(nodeId);
    if (!clusterId || !node) return;
    setSizePicker({ clusterId, referenceLabel: node.title, referenceRadius: node.r });
    setContextMenu(null);
  }

  function applySizeScale(clusterId: string, targetRadius: number) {
    applyDisplayPatch(clusterId, { radiusOverride: targetRadius });
    setSizePicker(null);
  }

  function resetSize(clusterId: string) {
    applyDisplayPatch(clusterId, { radiusOverride: null });
    setSizePicker(null);
  }

  function openTextStylePicker(nodeId: string) {
    const clusterId = targetClusterForNode(nodeId);
    const node = nodeById.get(nodeId);
    if (!clusterId || !node) return;
    setTextStylePicker({
      clusterId,
      referenceLabel: node.title,
      fontSize: node.fontSize,
      maxChars: node.maxChars,
      labelPadding: node.labelPadding,
    });
    setContextMenu(null);
  }

  function applyTextStyle(clusterId: string, values: { fontSize: number; maxChars: number; labelPadding: number }) {
    applyDisplayPatch(clusterId, {
      fontSizeOverride: values.fontSize,
      maxCharsOverride: values.maxChars,
      labelPaddingOverride: values.labelPadding,
    });
    setTextStylePicker(null);
  }

  function resetTextStyle(clusterId: string) {
    applyDisplayPatch(clusterId, { fontSizeOverride: null, maxCharsOverride: null, labelPaddingOverride: null });
    setTextStylePicker(null);
  }

  if (clusters.length === 0) {
    return (
      <section className="panel">
        <h2>Sơ đồ Topic Cluster</h2>
        <p className="hint">Chưa có dữ liệu để vẽ sơ đồ. Hãy nhập CSV hoặc thêm bài viết trước.</p>
      </section>
    );
  }

  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <section className="panel">
      <h2>Sơ đồ Topic Cluster</h2>
      <p className="hint">
        <span className="legend-dot" style={{ background: colorForClusterIndex(0).root }} /> Bài Pillar &nbsp;
        <span className="legend-dot" style={{ background: colorForClusterIndex(0).child }} /> Bài Supporting &nbsp; —
        mỗi cụm một tông màu riêng, không trùng với cụm khác. Đường nét đứt nối cụm này với bài viết mà nó khai báo là nhánh con (xem tab "Nhập tay"/CSV,
        cột PillarOf). Kéo bong bóng Pillar để di chuyển cả cụm; kéo bong bóng Supporting để chỉnh riêng nó. Giữ{" "}
        <code>Ctrl</code> (hoặc <code>Cmd</code>) trong lúc kéo để di chuyển cả chuỗi — cụm đang kéo cùng mọi cụm nối
        chuỗi bên dưới nó — theo trỏ chuột. Cuộn chuột hoặc chụm 2 ngón để zoom, kéo nền trống để di chuyển khung
        nhìn. Chuột phải vào 1 bong bóng để đổi màu cho cả cụm; chuột phải vào 1 bong bóng Supporting để điều chỉnh
        khoảng cách tới Pillar hoặc khoảng trống (góc) giữa các bong bóng Supporting trong cụm. Nhấn{" "}
        <code>Ctrl</code>+<code>Z</code> (hoặc <code>Cmd</code>+<code>Z</code>) để hoàn tác,{" "}
        <code>Ctrl</code>+<code>Shift</code>+<code>Z</code> để làm lại thao tác vừa hoàn tác.
      </p>

      <div className="row pdf-export-row">
        <label className="inline-label">
          Khổ giấy xuất PDF
          <select value={pageFormat} onChange={(e) => setPageFormat(e.target.value as PageFormatId)}>
            <option value={FIT_OPTION.id}>{FIT_OPTION.label}</option>
            {Object.entries(PAGE_FORMATS).map(([id, f]) => (
              <option key={id} value={id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handleExportPdf} disabled={exporting}>
          {exporting
            ? "Đang tạo PDF…"
            : pageFormat === "fit"
              ? "Xuất PDF (1 trang)"
              : `Xuất PDF (~${pageEstimate.total} trang)`}
        </button>
        {hasOverrides && (
          <button type="button" className="secondary" onClick={handleResetPositions}>
            Đặt lại vị trí
          </button>
        )}
        <span className="hint" style={{ marginBottom: 0 }}>
          {pageFormat === "fit"
            ? pageEstimate.scale < 1
              ? `Sơ đồ lớn hơn khổ trang PDF tối đa nên tự thu nhỏ còn ${Math.round(pageEstimate.scale * 100)}% — vẫn là vector, zoom trên máy tính vẫn nét, chỉ in giấy sẽ khó đọc hơn.`
              : "Toàn bộ sơ đồ nằm gọn 1 trang, đúng kích thước gốc — dạng vector nên zoom sâu vẫn nét."
            : `Lưới ${pageEstimate.cols} cột × ${pageEstimate.rows} hàng — PDF theo đúng vị trí bạn đã sắp xếp, dạng vector nên zoom sâu vẫn nét.`}
        </span>
      </div>
      {exportError && <p className="errors">{exportError}</p>}

      <div className="diagram-scroll">
        <svg ref={svgRef} />
        <div className="zoom-controls">
          <button type="button" title="Phóng to" onClick={() => zoomBy(ZOOM_STEP)}>
            +
          </button>
          <button type="button" title="Thu nhỏ" onClick={() => zoomBy(1 / ZOOM_STEP)}>
            −
          </button>
          <button type="button" title="Vừa màn hình" onClick={handleFitToScreen}>
            ⤢
          </button>
        </div>
      </div>

      {contextMenu && (
        <div className="modal-backdrop" style={{ background: "transparent" }} onClick={() => setContextMenu(null)}>
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => openColorPicker(contextMenu.clusterId)}>
              Đổi màu cụm…
            </button>
            {targetClusterForNode(contextMenu.nodeId) && (
              <>
                <button type="button" onClick={() => openDistancePicker(contextMenu.nodeId)}>
                  Điều chỉnh khoảng cách…
                </button>
                <button type="button" onClick={() => openSpacingPicker(contextMenu.nodeId)}>
                  Điều chỉnh khoảng trống…
                </button>
                <button type="button" onClick={() => openSizePicker(contextMenu.nodeId)}>
                  Điều chỉnh kích thước…
                </button>
                <button type="button" onClick={() => openTextStylePicker(contextMenu.nodeId)}>
                  Điều chỉnh chữ…
                </button>
                <button type="button" onClick={() => openRotatePicker(contextMenu.nodeId)}>
                  Xoay cấu trúc…
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {colorPicker && (
        <ColorPickerModal
          initialColor={colorPicker.initialColor}
          onConfirm={(hex) => applyClusterColor(colorPicker.clusterId, hex)}
          onReset={() => applyClusterColor(colorPicker.clusterId, null)}
          onCancel={() => setColorPicker(null)}
        />
      )}

      {distancePicker && (
        <DistanceAdjustModal
          referenceLabel={distancePicker.referenceLabel}
          referenceDistance={distancePicker.referenceDistance}
          onConfirm={(targetDistance) => applyDistanceScale(distancePicker.clusterId, targetDistance)}
          onCancel={() => setDistancePicker(null)}
        />
      )}

      {spacingPicker && (
        <SpacingAdjustModal
          currentCount={spacingPicker.currentCount}
          onConfirm={(slotCount) => applySpacing(spacingPicker.clusterId, slotCount)}
          onCancel={() => setSpacingPicker(null)}
        />
      )}

      {sizePicker && (
        <SizeAdjustModal
          referenceLabel={sizePicker.referenceLabel}
          referenceRadius={sizePicker.referenceRadius}
          onConfirm={(targetRadius) => applySizeScale(sizePicker.clusterId, targetRadius)}
          onReset={() => resetSize(sizePicker.clusterId)}
          onCancel={() => setSizePicker(null)}
        />
      )}

      {textStylePicker && (
        <TextStyleAdjustModal
          referenceLabel={textStylePicker.referenceLabel}
          initialFontSize={textStylePicker.fontSize}
          initialMaxChars={textStylePicker.maxChars}
          initialLabelPadding={textStylePicker.labelPadding}
          onConfirm={(values) => applyTextStyle(textStylePicker.clusterId, values)}
          onReset={() => resetTextStyle(textStylePicker.clusterId)}
          onCancel={() => setTextStylePicker(null)}
        />
      )}

      {rotatePicker && (
        <RotateAdjustModal
          onConfirm={(degrees) => applyRotation(rotatePicker.clusterId, degrees)}
          onCancel={() => setRotatePicker(null)}
        />
      )}
    </section>
  );
}
