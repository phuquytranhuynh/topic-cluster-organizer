import type { jsPDF } from "jspdf";

export const FONT_NAME = "Roboto";

async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được font: ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Embeds a Vietnamese-capable Unicode font (Roboto) into the PDF so diacritics render correctly. */
export async function registerVietnameseFont(doc: jsPDF): Promise<void> {
  const [regular, bold] = await Promise.all([
    fetchBase64("/fonts/Roboto-Regular.ttf"),
    fetchBase64("/fonts/Roboto-Bold.ttf"),
  ]);
  doc.addFileToVFS("Roboto-Regular.ttf", regular);
  doc.addFont("Roboto-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", bold);
  doc.addFont("Roboto-Bold.ttf", FONT_NAME, "bold");
}
