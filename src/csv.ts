import Papa from "papaparse";
import type { ArticleRole } from "./types";

/** Strip accents, lowercase, drop non-alphanumerics — used to fuzzy-match CSV headers/values in VN or EN. */
export function normalizeKey(s: string): string {
  return s
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["title", "tieude", "tenbaiviet", "baiviet"],
  url: ["url", "link", "duongdan"],
  cluster: ["topiccluster", "cluster", "chude", "cumchude", "nhom", "topic"],
  role: ["role", "vaitro", "loai"],
  pillarOf: ["pillarof", "linksto", "lienketoi", "lienkettoi", "thuocpillar"],
  volume: ["volumesearch", "searchvolume", "volume", "luongtimkiem", "luottimkiem", "sotimkiem"],
};

const PILLAR_VALUES = new Set(["pillar", "trucot", "p"]);

export function normalizeRole(raw: string | undefined): ArticleRole {
  if (!raw) return "supporting";
  return PILLAR_VALUES.has(normalizeKey(raw)) ? "pillar" : "supporting";
}

/** Strips everything but digits so "1,200", "1.200" and "1200 lượt" all parse the same way. */
export function parseVolume(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

export interface RawCsvRow {
  title: string;
  url: string;
  cluster: string;
  role: ArticleRole;
  pillarOf: string;
  volume: number | null;
}

export interface ParseCsvResult {
  rows: RawCsvRow[];
  errors: string[];
}

export function parseCsv(text: string): ParseCsvResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = result.errors.map(
    (e) => `Dòng ${e.row != null ? e.row + 2 : "?"}: ${e.message}`
  );

  if (!result.data.length) {
    return { rows: [], errors: [...errors, "File CSV không có dữ liệu."] };
  }

  const rawHeaders = Object.keys(result.data[0] ?? {});
  const headerMap: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {};
  for (const header of rawHeaders) {
    const normalized = normalizeKey(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        headerMap[field as keyof typeof HEADER_ALIASES] = header;
      }
    }
  }

  if (!headerMap.title || !headerMap.cluster) {
    errors.push(
      "Không tìm thấy cột 'Title' và/hoặc 'TopicCluster' trong file CSV. Vui lòng kiểm tra lại tiêu đề cột."
    );
    return { rows: [], errors };
  }

  const rows: RawCsvRow[] = [];
  result.data.forEach((record, idx) => {
    const title = (headerMap.title ? record[headerMap.title] : "")?.trim();
    const cluster = (headerMap.cluster ? record[headerMap.cluster] : "")?.trim();
    if (!title || !cluster) {
      errors.push(`Dòng ${idx + 2}: thiếu Title hoặc TopicCluster, đã bỏ qua.`);
      return;
    }
    rows.push({
      title,
      url: (headerMap.url ? record[headerMap.url] : "")?.trim() ?? "",
      cluster,
      role: normalizeRole(headerMap.role ? record[headerMap.role] : undefined),
      pillarOf: (headerMap.pillarOf ? record[headerMap.pillarOf] : "")?.trim() ?? "",
      volume: parseVolume(headerMap.volume ? record[headerMap.volume] : undefined),
    });
  });

  return { rows, errors };
}

export function toCsv(rows: Record<string, string>[]): string {
  return Papa.unparse(rows);
}

const POSITION_HEADER_ALIASES: Record<string, string[]> = {
  title: ["topic", "title", "tieude", "tenbaiviet", "baiviet"],
  url: ["url", "link", "duongdan"],
  position: ["vitritrongsodo", "vitri", "position", "positioncode", "path", "mavitri", "sodo"],
  volume: ["volumesearch", "searchvolume", "volume", "luongtimkiem", "luottimkiem", "sotimkiem"],
};

/**
 * Alternative CSV shape: a flat list of {Topic, "Vị trí trong sơ đồ"} where the position is a
 * dot-notation path (0, 0.1, 0.1.1, ...) describing the tree directly, instead of separate
 * TopicCluster/Role/PillarOf columns. A position with children becomes the Pillar of a new cluster
 * chained onto its parent's title; a position with no children is a Supporting article inside its
 * parent's cluster. Returns the same RawCsvRow[] shape as parseCsv so callers don't need to care
 * which format was used.
 */
export function parsePositionCsv(text: string): ParseCsvResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = result.errors.map(
    (e) => `Dòng ${e.row != null ? e.row + 2 : "?"}: ${e.message}`
  );

  if (!result.data.length) {
    return { rows: [], errors: [...errors, "File CSV không có dữ liệu."] };
  }

  const rawHeaders = Object.keys(result.data[0] ?? {});
  const headerMap: Partial<Record<keyof typeof POSITION_HEADER_ALIASES, string>> = {};
  for (const header of rawHeaders) {
    const normalized = normalizeKey(header);
    for (const [field, aliases] of Object.entries(POSITION_HEADER_ALIASES)) {
      if (aliases.includes(normalized)) {
        headerMap[field as keyof typeof POSITION_HEADER_ALIASES] = header;
      }
    }
  }

  if (!headerMap.title || !headerMap.position) {
    errors.push(
      "Không tìm thấy cột 'Topic' và/hoặc 'Vị trí trong sơ đồ' trong file CSV. Vui lòng kiểm tra lại tiêu đề cột."
    );
    return { rows: [], errors };
  }

  const byPosition = new Map<string, { title: string; url: string; volume: number | null }>();
  const order: string[] = [];
  result.data.forEach((record, idx) => {
    const title = (headerMap.title ? record[headerMap.title] : "")?.trim();
    const position = (headerMap.position ? record[headerMap.position] : "")?.trim();
    if (!title || !position) {
      errors.push(`Dòng ${idx + 2}: thiếu Topic hoặc Vị trí trong sơ đồ, đã bỏ qua.`);
      return;
    }
    if (byPosition.has(position)) {
      errors.push(
        `Dòng ${idx + 2}: vị trí "${position}" bị lặp lại (đã dùng cho bài "${byPosition.get(position)!.title}"), đã bỏ qua.`
      );
      return;
    }
    byPosition.set(position, {
      title,
      url: (headerMap.url ? record[headerMap.url] : "")?.trim() ?? "",
      volume: parseVolume(headerMap.volume ? record[headerMap.volume] : undefined),
    });
    order.push(position);
  });

  const parentOf = (pos: string): string | null => {
    const idx = pos.lastIndexOf(".");
    return idx === -1 ? null : pos.slice(0, idx);
  };

  const hasChildren = new Set<string>();
  for (const pos of byPosition.keys()) {
    const parent = parentOf(pos);
    if (parent) hasChildren.add(parent);
  }

  const rows: RawCsvRow[] = order.map((pos) => {
    const entry = byPosition.get(pos)!;
    const parentPos = parentOf(pos);
    const parentEntry = parentPos ? byPosition.get(parentPos) : undefined;
    if (parentPos && !parentEntry) {
      errors.push(`Bài "${entry.title}" (vị trí ${pos}): không tìm thấy vị trí cha "${parentPos}", xem như cụm gốc riêng.`);
    }
    const isPillar = hasChildren.has(pos) || !parentEntry;
    return {
      title: entry.title,
      url: entry.url,
      cluster: isPillar ? entry.title : parentEntry!.title,
      role: isPillar ? "pillar" : "supporting",
      pillarOf: parentEntry?.title ?? "",
      volume: entry.volume,
    };
  });

  return { rows, errors };
}
