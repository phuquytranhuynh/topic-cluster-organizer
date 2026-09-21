/** Turns a user-entered diagram name into a safe download filename (no path separators or reserved chars). */
export function sanitizeFilename(name: string, fallback: string): string {
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").slice(0, 120);
}
