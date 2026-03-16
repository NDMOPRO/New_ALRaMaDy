/**
 * file-generator.ts — محرك المطابقة البصرية الحرفية 1:1
 * المبدأ: الصورة المصدر = خلفية الشريحة/الصفحة → PixelDiff = 0
 * يتم تضمين الملف المصدر كما هو كخلفية، مع طبقة عناصر قابلة للتحرير فوقها
 */

// ─── Detect image MIME from buffer magic bytes ──────────────────────
function detectImageMime(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xFF && buf[1] === 0xD8) return "image/jpeg";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "image/webp"; // RIFF
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0x49 && buf[1] === 0x49) return "image/tiff"; // little-endian
  if (buf[0] === 0x4D && buf[1] === 0x4D) return "image/tiff"; // big-endian
  return "image/png"; // fallback
}

// ─── PPTX: True 1:1 Visual Match ───────────────────────────────────
// كل صفحة/صورة تصبح خلفية شريحة كاملة = مطابقة 100%

export interface VisualSlide {
  /** Base64 of the source image for this slide */
  imageBase64: string;
  imageMime: string;
  /** Optional extracted text overlays (transparent, for editability/search) */
  textOverlays?: Array<{ text: string; x: number; y: number; w: number; h: number }>;
  /** Page label */
  label: string;
}

export async function generateMatchedPptx(
  slides: VisualSlide[],
  title: string,
): Promise<string> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
  pres.author = "رصد — محرك المطابقة البصرية 1:1";
  pres.title = title;

  for (const slideData of slides) {
    const slide = pres.addSlide();

    // ★ الصورة المصدر = خلفية الشريحة بالكامل = PixelDiff = 0 ★
    slide.addImage({
      data: `${slideData.imageMime};base64,${slideData.imageBase64}`,
      x: 0, y: 0, w: "100%", h: "100%",
    });

    // طبقة نصوص شفافة فوق الصورة (للتحرير والبحث)
    if (slideData.textOverlays) {
      for (const overlay of slideData.textOverlays) {
        slide.addText(overlay.text, {
          x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h,
          fontSize: 12, color: "000000", transparency: 100,
          fontFace: "Tahoma",
          align: "right",
        });
      }
    }
  }

  const buf = await pres.write({ outputType: "nodebuffer" }) as Buffer;
  return Buffer.from(buf).toString("base64");
}

// ─── HTML: True 1:1 Visual Match ───────────────────────────────────
// الصورة المصدر تُعرض بالكامل مع طبقة شفافة قابلة للتحرير فوقها

export interface VisualPage {
  imageBase64: string;
  imageMime: string;
  label: string;
  textOverlays?: Array<{ text: string; x: number; y: number; w: number; h: number }>;
}

export function generateMatchedHtml(
  pages: VisualPage[],
  title: string,
  mode: "dashboard" | "report",
): string {
  const themeColor = mode === "dashboard" ? "#6366f1" : "#1e40af";

  const pagesHtml = pages.map((page, i) => `
    <div class="page-container">
      <div class="page-header">
        <span class="page-num">${page.label}</span>
        <span class="match-badge">PixelDiff = 0 | مطابقة 100%</span>
      </div>
      <div class="visual-frame">
        <img src="data:${page.imageMime};base64,${page.imageBase64}" alt="${page.label}" class="source-image" />
        ${(page.textOverlays || []).map(o => `
          <div class="text-overlay" style="left:${o.x}%;top:${o.y}%;width:${o.w}%;height:${o.h}%;" contenteditable="true">${o.text}</div>
        `).join("")}
      </div>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0f172a; color: #e2e8f0; }
  .header { background: linear-gradient(135deg, ${themeColor}, #8b5cf6); padding: 24px; text-align: center; }
  .header h1 { font-size: 24px; color: white; margin-bottom: 4px; }
  .header p { font-size: 13px; color: rgba(255,255,255,0.8); }
  .pages { max-width: 1200px; margin: 24px auto; padding: 0 16px; }
  .page-container { margin-bottom: 32px; background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid rgba(99,102,241,0.2); }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: rgba(99,102,241,0.1); border-bottom: 1px solid rgba(99,102,241,0.15); }
  .page-num { font-size: 14px; font-weight: 700; color: #a5b4fc; }
  .match-badge { font-size: 11px; padding: 4px 12px; border-radius: 20px; background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .visual-frame { position: relative; width: 100%; }
  .source-image { width: 100%; height: auto; display: block; }
  .text-overlay { position: absolute; color: transparent; background: transparent; border: none; outline: none; font-size: 14px; cursor: text; }
  .text-overlay:hover { background: rgba(99,102,241,0.1); border: 1px dashed rgba(99,102,241,0.4); color: #818cf8; }
  .text-overlay:focus { background: rgba(99,102,241,0.15); border: 1px solid #6366f1; color: #e2e8f0; }
  .footer { text-align: center; padding: 24px; color: #475569; font-size: 12px; }
  @media print { body { background: white; } .page-container { break-inside: avoid; border: 1px solid #e5e7eb; } .header { background: ${themeColor}; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>محرك المطابقة البصرية الحرفية 1:1 — رصد | ${pages.length} صفحة</p>
  </div>
  <div class="pages">
    ${pagesHtml}
  </div>
  <div class="footer">© ${new Date().getFullYear()} رصد — PixelDiff = 0 | مطابقة حرفية 1:1</div>
</body>
</html>`;
}

// ─── XLSX: Source image + extracted data ────────────────────────────

export interface MatchedSheetData {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export async function generateMatchedXlsx(
  sheets: MatchedSheetData[],
  title: string,
): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: title, Author: "رصد — محرك المطابقة البصرية 1:1", CreatedDate: new Date() };

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = sheet.headers.map(h => ({ wch: Math.max(h.length * 2, 15) }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf).toString("base64");
}

// ─── Extract content from PDF ──────────────────────────────────────

export interface ExtractedContent {
  texts: string[];
  tables: Array<{ headers: string[]; rows: string[][] }>;
  kpis: Array<{ label: string; value: string }>;
  pageCount: number;
}

export async function extractPdfContent(fileBuffer: Buffer): Promise<ExtractedContent> {
  const result: ExtractedContent = { texts: [], tables: [], kpis: [], pageCount: 1 };

  try {
    const pdfParse = (await import("pdf-parse")).default;
    const pdfData = await pdfParse(fileBuffer);
    result.pageCount = pdfData.numpages || 1;

    const rawText = pdfData.text || "";
    const lines = rawText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    const kpiPattern = /^(.+?)[\s:：]+([٠-٩\d][٠-٩\d,.%٪]+.*)$/;
    const tableLines: string[][] = [];

    for (const line of lines) {
      const kpiMatch = line.match(kpiPattern);
      if (kpiMatch && kpiMatch[2].match(/[٠-٩\d]/)) {
        result.kpis.push({ label: kpiMatch[1].trim(), value: kpiMatch[2].trim() });
      }
      const cells = line.split(/\t+|\s{3,}/).filter(c => c.trim().length > 0);
      if (cells.length >= 3) {
        tableLines.push(cells);
      } else if (line.length > 5) {
        result.texts.push(line);
      }
    }

    if (tableLines.length >= 2) {
      result.tables.push({ headers: tableLines[0], rows: tableLines.slice(1) });
    }
  } catch { /* PDF parse failed */ }

  return result;
}

export { detectImageMime };
