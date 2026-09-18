import Papa from "papaparse";
import type { ArticleRole } from "./types";

/** Strip accents, lowercase, drop non-alphanumerics — used to fuzzy-match CSV headers/values in VN or EN. */
export function normalizeKey(s: string): string {
  return s
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
};

const PILLAR_VALUES = new Set(["pillar", "trucot", "p"]);

export function normalizeRole(raw: string | undefined): ArticleRole {
  if (!raw) return "supporting";
  return PILLAR_VALUES.has(normalizeKey(raw)) ? "pillar" : "supporting";
}

export interface RawCsvRow {
  title: string;
  url: string;
  cluster: string;
  role: ArticleRole;
  pillarOf: string;
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
    });
  });

  return { rows, errors };
}

export function toCsv(rows: Record<string, string>[]): string {
  return Papa.unparse(rows);
}
