/** ISO paper sizes in points (1pt = 1/72in), landscape orientation (width > height). */
export const PAGE_FORMATS = {
  a4: { label: "A4 ngang (297×210mm)", width: 841.89, height: 595.28 },
  a3: { label: "A3 ngang (420×297mm)", width: 1190.55, height: 841.89 },
  a2: { label: "A2 ngang (594×420mm)", width: 1683.78, height: 1190.55 },
  a1: { label: "A1 ngang (841×594mm)", width: 2383.94, height: 1683.78 },
  a0: { label: "A0 ngang (1189×841mm)", width: 3370.39, height: 2383.94 },
} as const;

export type TiledFormatId = keyof typeof PAGE_FORMATS;
export type PageFormatId = TiledFormatId | "fit";

export const FIT_OPTION = { id: "fit" as const, label: "Một trang duy nhất (vừa khít sơ đồ)" };

/** Overlap between adjacent tiles (pt) so bubbles near a page edge aren't cut in half. */
export const OVERLAP = 40;

/** Most PDF readers refuse pages larger than 200in/side (14400pt); stay comfortably under that. */
const FIT_MAX_SIDE = 14000;

export interface Grid {
  cols: number;
  rows: number;
  total: number;
  pageW: number;
  pageH: number;
  stepX: number;
  stepY: number;
  /** Uniform factor applied to every drawn coordinate/size. 1 unless a "fit" page had to shrink to stay under the PDF reader limit. */
  scale: number;
}

export function estimatePageGrid(width: number, height: number, pageFormat: PageFormatId): Grid {
  if (pageFormat === "fit") {
    const scale = Math.min(1, FIT_MAX_SIDE / Math.max(width, 1), FIT_MAX_SIDE / Math.max(height, 1));
    const pageW = Math.max(1, width * scale);
    const pageH = Math.max(1, height * scale);
    return { cols: 1, rows: 1, total: 1, pageW, pageH, stepX: pageW, stepY: pageH, scale };
  }

  const { width: pageW, height: pageH } = PAGE_FORMATS[pageFormat];
  const stepX = pageW - OVERLAP;
  const stepY = pageH - OVERLAP;
  const cols = Math.max(1, Math.ceil((width - OVERLAP) / stepX));
  const rows = Math.max(1, Math.ceil((height - OVERLAP) / stepY));
  return { cols, rows, total: cols * rows, pageW, pageH, stepX, stepY, scale: 1 };
}
