import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import { ColorPickerModal } from "./ColorPickerModal";
import {
  applyPositionOverrides,
  buildCrossLinks,
  colorForClusterIndex,
  computeBounds,
  computeLabelLayout,
  layoutDiagram,
  resolveParentClusterIds,
  type ClusterLayout,
  type DiagramLayout,
  type RadialNode,
} from "../diagramLayout";
import { clearPositions, loadPositions, savePositions, type PositionOverrides } from "../diagramPositions";
import { FIT_OPTION, PAGE_FORMATS, estimatePageGrid, type PageFormatId } from "../pdf/pageFormats";
import { useStore } from "../store";

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.3;

/** One undo-able edit made on the diagram — either a drag (whole previous position map) or a cluster recolor. */
type UndoEntry =
  | { type: "position"; prev: PositionOverrides }
  | { type: "color"; clusterId: string; prevColor: string | null };

export function ClusterDiagram() {
  const { clusters, articles, updateClusterColor } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<d3.ZoomTransform | null>(null);
  const prevBaseLayoutsRef = useRef<DiagramLayout["layouts"] | null>(null);
  const undoStackRef = useRef<UndoEntry[]>([]);
  const [pageFormat, setPageFormat] = useState<PageFormatId>("a3");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PositionOverrides>(() => loadPositions());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clusterId: string } | null>(null);
  const [colorPicker, setColorPicker] = useState<{ clusterId: string; initialColor: string } | null>(null);

  const { layouts: baseLayouts } = useMemo(() => layoutDiagram(clusters, articles), [clusters, articles]);
  const layouts = useMemo(() => applyPositionOverrides(baseLayouts, overrides), [baseLayouts, overrides]);
  const crossLinks = useMemo(() => buildCrossLinks(layouts), [layouts]);
  const bounds = useMemo(() => computeBounds(layouts), [layouts]);
  // clusterId -> parent clusterId it's chained onto (PillarOf), for the Ctrl+drag "move whole chain" gesture.
  const parentClusterOf = useMemo(() => resolveParentClusterIds(articles), [articles]);

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

  function undo() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    if (entry.type === "position") {
      setOverrides(entry.prev);
      savePositions(entry.prev);
    } else {
      updateClusterColor(entry.clusterId, entry.prevColor);
    }
  }

  // Ctrl/Cmd+Z undoes the last drag or cluster recolor made in this diagram, for the common
  // "misclicked and dragged a bubble by accident" slip. Mounted once — undoStackRef is a ref (always
  // current) and setOverrides/updateClusterColor are stable, so no stale-closure risk.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
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
    const layoutByClusterId = new Map<string, ClusterLayout>();
    for (const layout of layouts) {
      layoutByClusterId.set(layout.cluster.id, layout);
      for (const node of [layout.root, ...layout.children]) {
        livePos.set(node.id, { x: node.cx, y: node.cy });
        clusterByNodeId.set(node.id, layout);
      }
    }

    // clusterId -> ids of clusters chained directly onto it, for the Ctrl+drag "move whole chain" gesture.
    const childClusterIds = new Map<string, string[]>();
    for (const [childId, parentId] of parentClusterOf) {
      const list = childClusterIds.get(parentId);
      if (list) list.push(childId);
      else childClusterIds.set(parentId, [childId]);
    }
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

    // Right-click a bubble to recolor its whole cluster. Stops propagation so the svg-level handler
    // below (which closes the menu for a right-click on empty background) doesn't immediately re-close it.
    nodeGroups.on("contextmenu", function (event: MouseEvent, d) {
      event.preventDefault();
      event.stopPropagation();
      const layout = clusterByNodeId.get(d.id);
      if (!layout) return;
      setContextMenu({ x: event.clientX, y: event.clientY, clusterId: layout.cluster.id });
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
        undoStackRef.current.push({ type: "position", prev: overrides });
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
  }, [layouts, crossLinks, bounds, baseLayouts, parentClusterOf]);

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
      await exportDiagramToPdf({ layouts, crossLinks, bounds, pageFormat });
    } catch (err) {
      setExportError((err as Error).message || "Xuất PDF thất bại.");
    } finally {
      setExporting(false);
    }
  }

  function openColorPicker(clusterId: string) {
    const currentColor = layouts.find((l) => l.cluster.id === clusterId)?.colors.root ?? "#2563eb";
    setColorPicker({ clusterId, initialColor: currentColor });
    setContextMenu(null);
  }

  function applyClusterColor(clusterId: string, color: string | null) {
    const prevColor = clusters.find((c) => c.id === clusterId)?.color ?? null;
    undoStackRef.current.push({ type: "color", clusterId, prevColor });
    updateClusterColor(clusterId, color);
    setColorPicker(null);
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
        nhìn. Chuột phải vào 1 bong bóng để đổi màu cho cả cụm. Nhấn <code>Ctrl</code>+<code>Z</code> (hoặc{" "}
        <code>Cmd</code>+<code>Z</code>) để hoàn tác thao tác kéo thả hoặc đổi màu gần nhất.
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
    </section>
  );
}
