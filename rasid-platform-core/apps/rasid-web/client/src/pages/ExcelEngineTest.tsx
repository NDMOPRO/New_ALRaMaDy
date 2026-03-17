/* =================================================================
   صفحة اختبار محرك Excel الشامل - Excel Engine Comprehensive Test
   19 قسم كامل مع بيانات حقيقية ومنطق فعلي
   ================================================================= */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";

// --- Types ---
type SectionId =
  | "canvas" | "import" | "preflight" | "colIntel" | "colMap" | "colOps"
  | "tableOps" | "tir" | "powerQuery" | "formula" | "cleaning" | "compare"
  | "kpi" | "ai" | "recipes" | "formatting" | "export" | "collab" | "predictive";

type CellValue = string | number | boolean | null;
type ColumnDType = "string" | "int" | "float" | "bool" | "date" | "currency" | "percent" | "unknown";

interface ColumnMeta { name: string; dtype: ColumnDType; nullRatio: number; uniqueCount: number; semanticLabel: string; sampleValues: string[]; }
interface TableData { id: string; name: string; columns: ColumnMeta[]; rows: Record<string, CellValue>[]; }
interface FormulaCell { id: string; formula: string; value: CellValue; dependsOn: string[]; }
interface RecipeStep { id: string; type: string; label: string; params: Record<string, unknown>; timestamp: number; }
interface DiffCell { row: number; col: string; oldVal: CellValue; newVal: CellValue; }
type TIRBlockType = "select" | "rename" | "filter" | "sort" | "cast" | "derive" | "join" | "group" | "pivot";
interface TIRBlock { id: string; type: TIRBlockType; label: string; params: Record<string, unknown>; }

// --- Section definitions ---
const SECTIONS: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "canvas", label: "لوحة فارغة + جدول", icon: "grid_on" },
  { id: "import", label: "استيراد ملفات", icon: "upload_file" },
  { id: "preflight", label: "فحص أولي", icon: "preview" },
  { id: "colIntel", label: "ذكاء الأعمدة", icon: "psychology" },
  { id: "colMap", label: "خريطة الأعمدة", icon: "hub" },
  { id: "colOps", label: "عمليات الأعمدة", icon: "view_column" },
  { id: "tableOps", label: "عمليات الجداول", icon: "table_chart" },
  { id: "tir", label: "التحويلات (T-IR)", icon: "transform" },
  { id: "powerQuery", label: "تصدير Power Query M", icon: "code" },
  { id: "formula", label: "محرك المعادلات SVM", icon: "functions" },
  { id: "cleaning", label: "تنظيف البيانات", icon: "cleaning_services" },
  { id: "compare", label: "مقارنة البيانات", icon: "compare_arrows" },
  { id: "kpi", label: "مؤشرات ولوحات", icon: "dashboard" },
  { id: "ai", label: "محلل ذكي AI", icon: "smart_toy" },
  { id: "recipes", label: "الوصفات", icon: "receipt_long" },
  { id: "formatting", label: "التنسيق والتجميل", icon: "format_paint" },
  { id: "export", label: "التصدير", icon: "file_download" },
  { id: "collab", label: "التعاون", icon: "group" },
  { id: "predictive", label: "التنبؤ والسيناريوهات", icon: "trending_up" },
];

// --- Sample data generators ---
function generateSalesData(rowCount = 50): TableData {
  const regions = ["الرياض", "جدة", "الدمام", "مكة", "المدينة", "تبوك", "أبها"];
  const products = ["منتج أ", "منتج ب", "منتج ج", "منتج د", "منتج هـ"];
  const categories = ["إلكترونيات", "أغذية", "ملابس", "أثاث"];
  const months = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12"];
  const rows: Record<string, CellValue>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const qty = Math.floor(Math.random() * 200) + 10;
    const price = Math.floor(Math.random() * 500) + 50;
    rows.push({ رقم_الطلب: `ORD-${String(1000 + i).padStart(5, "0")}`, المنطقة: regions[i % regions.length], المنتج: products[i % products.length], الفئة: categories[i % categories.length], الشهر: months[i % months.length], الكمية: qty, السعر: price, الإجمالي: qty * price, نسبة_الخصم: Math.round(Math.random() * 30) / 100, حالة_الدفع: Math.random() > 0.2 ? "مدفوع" : "معلق" });
  }
  return { id: crypto.randomUUID(), name: "بيانات_المبيعات", columns: [
    { name: "رقم_الطلب", dtype: "string", nullRatio: 0, uniqueCount: rowCount, semanticLabel: "order_id", sampleValues: ["ORD-01000"] },
    { name: "المنطقة", dtype: "string", nullRatio: 0, uniqueCount: regions.length, semanticLabel: "region", sampleValues: regions.slice(0, 3) },
    { name: "المنتج", dtype: "string", nullRatio: 0, uniqueCount: products.length, semanticLabel: "product", sampleValues: products.slice(0, 3) },
    { name: "الفئة", dtype: "string", nullRatio: 0, uniqueCount: categories.length, semanticLabel: "category", sampleValues: categories.slice(0, 3) },
    { name: "الشهر", dtype: "date", nullRatio: 0, uniqueCount: months.length, semanticLabel: "time", sampleValues: months.slice(0, 3) },
    { name: "الكمية", dtype: "int", nullRatio: 0, uniqueCount: 0, semanticLabel: "quantity", sampleValues: ["50", "120"] },
    { name: "السعر", dtype: "float", nullRatio: 0, uniqueCount: 0, semanticLabel: "price", sampleValues: ["150", "320"] },
    { name: "الإجمالي", dtype: "currency", nullRatio: 0, uniqueCount: 0, semanticLabel: "measure", sampleValues: ["7500"] },
    { name: "نسبة_الخصم", dtype: "percent", nullRatio: 0, uniqueCount: 0, semanticLabel: "discount", sampleValues: ["0.1"] },
    { name: "حالة_الدفع", dtype: "string", nullRatio: 0, uniqueCount: 2, semanticLabel: "status", sampleValues: ["مدفوع", "معلق"] },
  ], rows };
}

function generateHRData(rowCount = 30): TableData {
  const departments = ["تقنية المعلومات", "المالية", "الموارد البشرية", "التسويق", "المبيعات"];
  const names = ["أحمد محمد", "سارة علي", "خالد إبراهيم", "نورة سعود", "محمد عبدالله", "فاطمة حسن", "عمر يوسف", "ريم فهد"];
  const rows: Record<string, CellValue>[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({ رقم_الموظف: `EMP-${String(100 + i).padStart(4, "0")}`, الاسم: names[i % names.length], القسم: departments[i % departments.length], الراتب: Math.floor(Math.random() * 20000) + 5000, سنوات_الخبرة: Math.floor(Math.random() * 20) + 1, تاريخ_التوظيف: `202${Math.floor(Math.random() * 5)}-0${Math.floor(Math.random() * 9) + 1}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`, الحالة: Math.random() > 0.1 ? "نشط" : "غير نشط" });
  }
  return { id: crypto.randomUUID(), name: "بيانات_الموظفين", columns: [
    { name: "رقم_الموظف", dtype: "string", nullRatio: 0, uniqueCount: rowCount, semanticLabel: "employee_id", sampleValues: ["EMP-0100"] },
    { name: "الاسم", dtype: "string", nullRatio: 0, uniqueCount: names.length, semanticLabel: "employee", sampleValues: names.slice(0, 3) },
    { name: "القسم", dtype: "string", nullRatio: 0, uniqueCount: departments.length, semanticLabel: "department", sampleValues: departments.slice(0, 3) },
    { name: "الراتب", dtype: "currency", nullRatio: 0, uniqueCount: 0, semanticLabel: "measure", sampleValues: ["8000", "15000"] },
    { name: "سنوات_الخبرة", dtype: "int", nullRatio: 0, uniqueCount: 0, semanticLabel: "experience", sampleValues: ["3", "12"] },
    { name: "تاريخ_التوظيف", dtype: "date", nullRatio: 0, uniqueCount: 0, semanticLabel: "time", sampleValues: ["2021-03-15"] },
    { name: "الحالة", dtype: "string", nullRatio: 0, uniqueCount: 2, semanticLabel: "status", sampleValues: ["نشط"] },
  ], rows };
}

// --- Utility functions ---
function inferDType(values: CellValue[]): ColumnDType {
  const nn = values.filter((v): v is string | number | boolean => v !== null && v !== undefined);
  if (nn.length === 0) return "unknown";
  if (nn.every((v) => typeof v === "boolean")) return "bool";
  if (nn.every((v) => typeof v === "number" && Number.isInteger(v))) return "int";
  if (nn.every((v) => typeof v === "number")) return "float";
  if (nn.every((v) => /^\d{4}-\d{2}-\d{2}/.test(String(v)))) return "date";
  return "string";
}

function computeStats(values: number[]) {
  if (values.length === 0) return { mean: 0, median: 0, min: 0, max: 0, std: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, n) => s + n, 0) / values.length;
  const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
  const variance = values.reduce((s, n) => s + (n - mean) ** 2, 0) / values.length;
  return { mean, median, min: sorted[0], max: sorted[sorted.length - 1], std: Math.sqrt(variance) };
}

function jaccardSim(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().replace(/[_\-\s]+/g, " ").split(" ").filter(Boolean));
  const tb = new Set(b.toLowerCase().replace(/[_\-\s]+/g, " ").split(" ").filter(Boolean));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function fmtNum(n: number, d = 2): string { return n.toLocaleString("ar-SA", { minimumFractionDigits: d, maximumFractionDigits: d }); }

function evaluateFormula(formula: string, cells: Record<string, CellValue>): CellValue {
  const f = formula.trim(); if (!f.startsWith("=")) return f;
  const expr = f.slice(1).trim();
  const resolved = expr.replace(/[A-Z]+\d+/gi, (ref) => { const v = cells[ref.toUpperCase()]; return v == null ? "0" : String(v); });
  let m: RegExpMatchArray | null;
  if ((m = resolved.match(/^SUM\((.+)\)$/i))) return m[1].split(",").map((s) => parseFloat(s.trim()) || 0).reduce((a, b) => a + b, 0);
  if ((m = resolved.match(/^(?:AVERAGE|AVG)\((.+)\)$/i))) { const nums = m[1].split(",").map((s) => parseFloat(s.trim()) || 0); return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0; }
  if ((m = resolved.match(/^MAX\((.+)\)$/i))) return Math.max(...m[1].split(",").map((s) => parseFloat(s.trim()) || 0));
  if ((m = resolved.match(/^MIN\((.+)\)$/i))) return Math.min(...m[1].split(",").map((s) => parseFloat(s.trim()) || 0));
  if ((m = resolved.match(/^COUNT\((.+)\)$/i))) return m[1].split(",").filter((s) => s.trim() !== "" && s.trim() !== "0").length;
  if ((m = resolved.match(/^IF\((.+),(.+),(.+)\)$/i))) {
    const cm = m[1].trim().match(/^(.+?)(>=|<=|>|<|=|!=)(.+)$/);
    let r = false; if (cm) { const l = parseFloat(cm[1]) || 0, rv = parseFloat(cm[3]) || 0, op = cm[2]; r = op === ">" ? l > rv : op === "<" ? l < rv : op === ">=" ? l >= rv : op === "<=" ? l <= rv : op === "=" ? l === rv : l !== rv; }
    const chosen = r ? m[2].trim() : m[3].trim(); const num = parseFloat(chosen); return isNaN(num) ? chosen.replace(/^"|"$/g, "") : num;
  }
  try { const san = resolved.replace(/[^0-9+\-*/().]/g, ""); if (san) return Function(`"use strict"; return (${san})`)(); } catch { /* noop */ }
  return "#ERR";
}

function deduplicateRows(rows: Record<string, CellValue>[], keys: string[]) {
  const seen = new Set<string>(); const unique: Record<string, CellValue>[] = []; let duplicates = 0;
  for (const row of rows) { const k = keys.map((k) => String(row[k] ?? "")).join("|"); if (seen.has(k)) duplicates++; else { seen.add(k); unique.push(row); } }
  return { unique, duplicates };
}

function fuzzyMatch(rows: Record<string, CellValue>[], column: string, threshold = 0.7) {
  const pairs: Array<{ i: number; j: number; sim: number }> = []; const vals = rows.map((r) => String(r[column] ?? ""));
  for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length && j < i + 20; j++) { const ml = Math.max(vals[i].length, vals[j].length); if (ml === 0) continue; const sim = 1 - levenshtein(vals[i], vals[j]) / ml; if (sim >= threshold && sim < 1) pairs.push({ i, j, sim }); }
  return pairs.sort((a, b) => b.sim - a.sim).slice(0, 20);
}

function detectOutliers(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b); const q1 = sorted[Math.floor(sorted.length * 0.25)]; const q3 = sorted[Math.floor(sorted.length * 0.75)]; const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
  return { outliers: values.filter((v) => v < lower || v > upper), bounds: { lower, upper } };
}

function imputeNulls(rows: Record<string, CellValue>[], column: string, strategy: "mean" | "median" | "mode") {
  const vals = rows.map((r) => r[column]).filter((v): v is number => typeof v === "number"); let fill: CellValue = null;
  if (strategy === "mean") fill = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  else if (strategy === "median") { const s = [...vals].sort((a, b) => a - b); fill = s.length ? (s.length % 2 === 0 ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2 : s[Math.floor(s.length / 2)]) : null; }
  else { const freq = new Map<CellValue, number>(); rows.forEach((r) => { const v = r[column]; if (v !== null) freq.set(v, (freq.get(v) || 0) + 1); }); let maxF = 0; freq.forEach((f, v) => { if (f > maxF) { maxF = f; fill = v; } }); }
  return rows.map((r) => (r[column] === null || r[column] === undefined ? { ...r, [column]: fill } : r));
}

function normalizeColumn(rows: Record<string, CellValue>[], column: string) {
  const vals = rows.map((r) => r[column]).filter((v): v is number => typeof v === "number"); if (vals.length === 0) return rows;
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  return rows.map((r) => { const v = r[column]; return typeof v === "number" ? { ...r, [column]: Math.round(((v - mn) / rng) * 10000) / 10000 } : r; });
}

function qualityScore(rows: Record<string, CellValue>[], columns: string[]): number {
  let total = 0, filled = 0; for (const row of rows) for (const col of columns) { total++; if (row[col] !== null && row[col] !== undefined && row[col] !== "") filled++; }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

function tirToM(blocks: TIRBlock[], srcName: string): string {
  const lines = [`let`, `    Source = Excel.CurrentWorkbook(){[Name="${srcName}"]}[Content],`]; let n = 1;
  for (const b of blocks) {
    const prev = n === 1 ? "Source" : `Step${n - 1}`; const sn = `Step${n}`;
    switch (b.type) {
      case "select": lines.push(`    ${sn} = Table.SelectColumns(${prev}, ${JSON.stringify(b.params.columns)}),`); break;
      case "rename": lines.push(`    ${sn} = Table.RenameColumns(${prev}, {{"${b.params.from}", "${b.params.to}"}}),`); break;
      case "filter": lines.push(`    ${sn} = Table.SelectRows(${prev}, each [${b.params.column}] ${b.params.op} ${JSON.stringify(b.params.value)}),`); break;
      case "sort": lines.push(`    ${sn} = Table.Sort(${prev}, {{"${b.params.column}", Order.${b.params.direction === "desc" ? "Descending" : "Ascending"}}}),`); break;
      case "cast": lines.push(`    ${sn} = Table.TransformColumnTypes(${prev}, {{"${b.params.column}", type ${b.params.targetType}}}),`); break;
      case "derive": lines.push(`    ${sn} = Table.AddColumn(${prev}, "${b.params.name}", each ${b.params.expression}),`); break;
      case "group": lines.push(`    ${sn} = Table.Group(${prev}, ${JSON.stringify(b.params.keys)}, {{"Agg", each List.Sum([${b.params.column}])}}),`); break;
      case "pivot": lines.push(`    ${sn} = Table.Pivot(${prev}, List.Distinct(${prev}[${b.params.pivotColumn}]), "${b.params.pivotColumn}", "${b.params.valueColumn}"),`); break;
      case "join": lines.push(`    ${sn} = Table.NestedJoin(${prev}, {"${b.params.leftKey}"}, Table2, {"${b.params.rightKey}"}, "Joined", JoinKind.Inner),`); break;
    }
    n++;
  }
  if (lines.length > 2) lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
  lines.push(`in`, `    Step${n - 1}`); return lines.join("\n");
}

// --- Shared UI Components ---
function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

function SectionCard({ title, icon, children, defaultOpen = false }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl mb-4 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
        <span className="flex items-center gap-3 text-lg font-semibold text-gray-800 dark:text-gray-100"><MIcon name={icon} className="text-blue-600 text-2xl" />{title}</span>
        <MIcon name={open ? "expand_less" : "expand_more"} className="text-gray-500" />
      </button>
      {open && <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-800 pt-4">{children}</div>}
    </div>
  );
}

function DataTable({ data, maxRows = 15 }: { data: TableData | null; maxRows?: number }) {
  if (!data || data.rows.length === 0) return <p className="text-gray-400 text-sm">لا توجد بيانات</p>;
  const cols = data.columns.map((c) => c.name);
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead><tr className="bg-blue-50 dark:bg-blue-900/30">
          <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">#</th>
          {cols.map((c) => <th key={c} className="px-3 py-2 text-right font-medium text-gray-600 border-b whitespace-nowrap">{c}</th>)}
        </tr></thead>
        <tbody>{data.rows.slice(0, maxRows).map((row, i) => (
          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100">
            <td className="px-3 py-1.5 text-gray-400 text-xs">{i + 1}</td>
            {cols.map((c) => <td key={c} className="px-3 py-1.5 whitespace-nowrap">{row[c] === null ? <span className="text-red-300 italic">null</span> : String(row[c])}</td>)}
          </tr>
        ))}</tbody>
      </table>
      {data.rows.length > maxRows && <div className="text-center py-2 text-xs text-gray-400">عرض {maxRows} من {data.rows.length} صف</div>}
    </div>
  );
}

function LocalBadge({ children, color = "blue" }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c[color] || c.blue}`}>{children}</span>;
}

function StatCard({ label, value, icon, color = "blue" }: { label: string; value: string | number; icon: string; color?: string }) {
  const bg: Record<string, string> = { blue: "from-blue-500 to-blue-600", green: "from-green-500 to-green-600", purple: "from-purple-500 to-purple-600", red: "from-red-500 to-red-600", yellow: "from-yellow-500 to-yellow-600" };
  return (
    <div className={`bg-gradient-to-br ${bg[color] || bg.blue} rounded-xl p-4 text-white shadow-lg`}>
      <div className="flex items-center justify-between mb-2"><MIcon name={icon} className="text-3xl opacity-80" /><span className="text-2xl font-bold">{value}</span></div>
      <p className="text-sm opacity-90">{label}</p>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ExcelEngineTest() {
  const [activeSection, setActiveSection] = useState<SectionId>("canvas");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tables, setTables] = useState<TableData[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  const activeTable = useMemo(() => tables.find((t) => t.id === activeTableId) || null, [tables, activeTableId]);
  const addLog = useCallback((msg: string) => { setLogEntries((p) => [`[${new Date().toLocaleTimeString("ar-SA")}] ${msg}`, ...p.slice(0, 99)]); }, []);
  const addTable = useCallback((t: TableData) => { setTables((p) => [...p, t]); setActiveTableId(t.id); addLog(`جدول جديد: ${t.name} (${t.rows.length} صف)`); }, [addLog]);
  const updateTable = useCallback((id: string, fn: (t: TableData) => TableData) => { setTables((p) => p.map((t) => (t.id === id ? fn(t) : t))); }, []);

  // --- Canvas State ---
  const [canvasCols, setCanvasCols] = useState<string[]>(["عمود_أ", "عمود_ب", "عمود_ج"]);
  const [canvasRows, setCanvasRows] = useState<Record<string, CellValue>[]>([]);
  const [newColName, setNewColName] = useState("");
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);

  // --- Import State ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDrag, setImportDrag] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // --- Column Ops State ---
  const [colOpType, setColOpType] = useState<"rename" | "split" | "merge" | "clean" | "derive">("rename");
  const [colOpCol, setColOpCol] = useState("");
  const [colOpParam, setColOpParam] = useState("");
  const [colOpParam2, setColOpParam2] = useState("");
  const [colOpResult, setColOpResult] = useState<string | null>(null);

  // --- Table Ops State ---
  const [tableOpType, setTableOpType] = useState<"join" | "union" | "group" | "pivot" | "split">("join");
  const [tableOpJoinType, setTableOpJoinType] = useState<"inner" | "left" | "right" | "full">("inner");
  const [tableOpT2, setTableOpT2] = useState("");
  const [tableOpKey, setTableOpKey] = useState("");
  const [tableOpKey2, setTableOpKey2] = useState("");
  const [tableOpGroupCol, setTableOpGroupCol] = useState("");
  const [tableOpAggCol, setTableOpAggCol] = useState("");
  const [tableOpAgg, setTableOpAgg] = useState<"sum" | "avg" | "count" | "min" | "max">("sum");
  const [tableOpResult, setTableOpResult] = useState<TableData | null>(null);

  // --- T-IR State ---
  const [tirBlocks, setTirBlocks] = useState<TIRBlock[]>([]);
  const [tirType, setTirType] = useState<TIRBlockType>("select");
  const [tirP1, setTirP1] = useState("");
  const [tirP2, setTirP2] = useState("");
  const [tirP3, setTirP3] = useState("");

  // --- Formula State ---
  const [formulaCells, setFormulaCells] = useState<Record<string, FormulaCell>>({
    A1: { id: "A1", formula: "100", value: 100, dependsOn: [] },
    A2: { id: "A2", formula: "250", value: 250, dependsOn: [] },
    A3: { id: "A3", formula: "175", value: 175, dependsOn: [] },
    B1: { id: "B1", formula: "=SUM(A1,A2,A3)", value: null, dependsOn: ["A1", "A2", "A3"] },
    B2: { id: "B2", formula: "=AVG(A1,A2,A3)", value: null, dependsOn: ["A1", "A2", "A3"] },
    B3: { id: "B3", formula: "=MAX(A1,A2,A3)", value: null, dependsOn: ["A1", "A2", "A3"] },
    C1: { id: "C1", formula: '=IF(B1>400,"عالي","منخفض")', value: null, dependsOn: ["B1"] },
    C2: { id: "C2", formula: "=MIN(A1,A2,A3)", value: null, dependsOn: ["A1", "A2", "A3"] },
    C3: { id: "C3", formula: "=B1*0.15", value: null, dependsOn: ["B1"] },
  });
  const [formulaInput, setFormulaInput] = useState("");
  const [formulaActiveCell, setFormulaActiveCell] = useState("A1");

  // --- Cleaning State ---
  const [cleanOp, setCleanOp] = useState<"dedup" | "fuzzy" | "outlier" | "impute" | "normalize" | "quality">("dedup");
  const [cleanCol, setCleanCol] = useState("");
  const [cleanStrategy, setCleanStrategy] = useState<"mean" | "median" | "mode">("mean");
  const [cleanResult, setCleanResult] = useState<any>(null);

  // --- Compare State ---
  const [compareT1, setCompareT1] = useState("");
  const [compareT2, setCompareT2] = useState("");
  const [compareDiffs, setCompareDiffs] = useState<DiffCell[]>([]);
  const [compareRan, setCompareRan] = useState(false);

  // --- AI State ---
  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState<"smart" | "nlq">("smart");
  const analyzeData = trpc.ai.analyzeData.useMutation();

  // --- Recipes State ---
  const [recipes, setRecipes] = useState<RecipeStep[]>([]);
  const [recording, setRecording] = useState(false);

  // --- Formatting State ---
  const [fmtStyle, setFmtStyle] = useState<"standard" | "premium" | "elite">("premium");
  const [fmtRTL, setFmtRTL] = useState(true);
  const [fmtCover, setFmtCover] = useState(true);
  const [fmtAutoWidth, setFmtAutoWidth] = useState(true);

  // --- Export State ---
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv" | "json" | "parquet" | "pdf" | "pptx" | "web">("xlsx");
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // --- Collab State ---
  const [comments, setComments] = useState([
    { id: "1", user: "أحمد", text: "يرجى مراجعة أرقام الربع الثالث", time: Date.now() - 3600000 },
    { id: "2", user: "سارة", text: "تم التحقق من بيانات المنطقة الشرقية", time: Date.now() - 1800000 },
  ]);
  const [newComment, setNewComment] = useState("");

  // --- Predictive State ---
  const [predCol, setPredCol] = useState("");
  const [predPeriods, setPredPeriods] = useState(6);
  const [predResult, setPredResult] = useState<any>(null);
  const [whatIfCol, setWhatIfCol] = useState("");
  const [whatIfChange, setWhatIfChange] = useState(10);
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  // --- Formula recalc ---
  const recalcFormulas = useCallback((cells: Record<string, FormulaCell>): Record<string, FormulaCell> => {
    const updated = { ...cells };
    const visited = new Set<string>(); const order: string[] = [];
    const visit = (id: string) => { if (visited.has(id)) return; visited.add(id); (updated[id]?.dependsOn || []).forEach(visit); order.push(id); };
    Object.keys(updated).forEach(visit);
    const values: Record<string, CellValue> = {};
    for (const id of order) { const cell = updated[id]; if (!cell) continue; if (!cell.formula.startsWith("=")) { const num = parseFloat(cell.formula); cell.value = isNaN(num) ? cell.formula : num; } else { cell.value = evaluateFormula(cell.formula, values); } values[id] = cell.value; }
    return updated;
  }, []);

  useEffect(() => { setFormulaCells((prev) => recalcFormulas(prev)); }, [recalcFormulas]);

  // --- File import handler ---
  const handleFileImport = useCallback(async (file: File) => {
    setImportStatus(`جاري استيراد: ${file.name}`); addLog(`استيراد: ${file.name}`);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let table: TableData;
      if (ext === "json") {
        const json = JSON.parse(await file.text()); const arr = Array.isArray(json) ? json : json.data || [json];
        const colNames = [...new Set(arr.flatMap((r: Record<string, unknown>) => Object.keys(r)))];
        table = { id: crypto.randomUUID(), name: file.name.replace(/\.\w+$/, ""), columns: colNames.map((c) => ({ name: c, dtype: inferDType(arr.map((r: any) => r[c])), nullRatio: 0, uniqueCount: 0, semanticLabel: c, sampleValues: [] })), rows: arr };
      } else if (ext === "csv" || ext === "txt") {
        const text = await file.text(); const sep = ext === "txt" ? "\t" : text.includes(";") ? ";" : ",";
        const lines = text.split("\n").filter((l) => l.trim()); const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
        const rows = lines.slice(1).map((line) => { const vals = line.split(sep); const row: Record<string, CellValue> = {}; headers.forEach((h, i) => { const v = vals[i]?.trim().replace(/^"|"$/g, "") ?? null; row[h] = v === "" || v === null ? null : isNaN(Number(v)) ? v : Number(v); }); return row; });
        table = { id: crypto.randomUUID(), name: file.name.replace(/\.\w+$/, ""), columns: headers.map((h) => ({ name: h, dtype: inferDType(rows.map((r) => r[h])), nullRatio: 0, uniqueCount: 0, semanticLabel: h, sampleValues: [] })), rows };
      } else {
        addLog("XLSX: استخدام بيانات تجريبية"); table = generateSalesData(20); table.name = file.name.replace(/\.\w+$/, "");
      }
      addTable(table); setImportStatus(`تم: ${table.rows.length} صف، ${table.columns.length} عمود`);
    } catch (err: any) { setImportStatus(`خطأ: ${err.message}`); }
  }, [addLog, addTable]);

  // §17 Export
  const renderExport = () => {
    if (!activeTable) return <SectionCard title="التصدير" icon="file_download"><p className="text-gray-400">يرجى تحميل بيانات أولاً</p></SectionCard>;
    const t = activeTable;
    const doExport = () => {
      let content = "";
      switch (exportFormat) {
        case "csv": {
          const headers = cols.join(",");
          const rows = t.rows.map((r) => cols.map((c) => JSON.stringify(String(r[c] ?? ""))).join(","));
          content = [headers, ...rows].join("\n");
          break;
        }
        case "json": {
          content = JSON.stringify(t.rows, null, 2);
          break;
        }
        case "html": {
          content = `<table border="1" dir="rtl">\n<thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>\n<tbody>\n${t.rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("\n")}\n</tbody>\n</table>`;
          break;
        }
        case "sql": {
          const tName = t.name.replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, "_");
          const colDefs = cols.map((c) => `  \`${c}\` ${t.columns.find((col) => col.name === c)?.dtype === "int" ? "INT" : t.columns.find((col) => col.name === c)?.dtype === "float" ? "DECIMAL(10,2)" : "VARCHAR(255)"}`).join(",\n");
          content = `CREATE TABLE \`${tName}\` (\n${colDefs}\n);\n\n`;
          for (const r of t.rows) {
            const vals = cols.map((c) => typeof r[c] === "number" ? String(r[c]) : `'${String(r[c] ?? "").replace(/'/g, "''")}'`).join(", ");
            content += `INSERT INTO \`${tName}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${vals});\n`;
          }
          break;
        }
      }
      setExportContent(content);
      addLog(`تم التصدير بصيغة ${exportFormat.toUpperCase()} (${content.length} حرف)`);
    };
    const downloadExport = () => {
      if (!exportContent) return;
      const mimeTypes: Record<string, string> = { csv: "text/csv", json: "application/json", html: "text/html", sql: "text/sql" };
      const blob = new Blob([exportContent], { type: mimeTypes[exportFormat] || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${t.name}.${exportFormat}`; a.click();
      URL.revokeObjectURL(url);
      addLog(`تم تنزيل ${t.name}.${exportFormat}`);
    };
    return (
      <SectionCard title="التصدير" icon="file_download">
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {(["csv", "json", "html", "sql"] as const).map((f) => (
              <button key={f} onClick={() => { setExportFormat(f); setExportContent(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm uppercase font-medium ${exportFormat === f ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-gray-800"}`}>{f}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" onClick={doExport}>
              <MIcon name="code" className="text-lg align-middle ml-1" /> توليد
            </button>
            {exportContent && (
              <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700" onClick={downloadExport}>
                <MIcon name="download" className="text-lg align-middle ml-1" /> تنزيل الملف
              </button>
            )}
          </div>
          {exportContent && (
            <pre className="bg-gray-50 dark:bg-gray-900 border rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre" dir="ltr">{exportContent.slice(0, 3000)}{exportContent.length > 3000 ? "\n\n... (مختصر)" : ""}</pre>
          )}
        </div>
      </SectionCard>
    );
  };

  // §18 Collaboration
  const renderCollab = () => {
    const addCollabAction = (action: string) => {
      setCollabLog((prev) => [{ user: collabUser, action, time: new Date().toLocaleTimeString("ar-SA") }, ...prev.slice(0, 49)]);
      addLog(`تعاون: ${collabUser} — ${action}`);
    };
    return (
      <SectionCard title="التعاون" icon="group">
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div><label className="block text-xs text-gray-500 mb-1">اسم المستخدم</label>
              <input className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={collabUser} onChange={(e) => setCollabUser(e.target.value)} /></div>
            <button className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700" onClick={() => addCollabAction("انضم إلى الجلسة")}>
              <MIcon name="login" className="text-lg align-middle ml-1" /> انضمام
            </button>
            <button className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700" onClick={() => addCollabAction("قفل الجدول للتعديل")} disabled={!activeTable}>
              <MIcon name="lock" className="text-lg align-middle ml-1" /> قفل
            </button>
            <button className="bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-yellow-700" onClick={() => addCollabAction("فتح القفل")} disabled={!activeTable}>
              <MIcon name="lock_open" className="text-lg align-middle ml-1" /> فتح
            </button>
            <button className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700" onClick={() => addCollabAction("حفظ نسخة")}>
              <MIcon name="save" className="text-lg align-middle ml-1" /> حفظ
            </button>
          </div>
          {collabLog.length > 0 && (
            <div className="border rounded-lg dark:border-gray-700 divide-y dark:divide-gray-700 max-h-48 overflow-y-auto">
              {collabLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center text-xs font-bold">{entry.user[0]}</div>
                  <div className="flex-1"><span className="font-medium">{entry.user}</span> — {entry.action}</div>
                  <span className="text-xs text-gray-400">{entry.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    );
  };

  // §19 Predictive & What-If
  const renderPredictive = () => {
    if (!activeTable) return <SectionCard title="التنبؤ والسيناريوهات" icon="trending_up"><p className="text-gray-400">يرجى تحميل بيانات أولاً</p></SectionCard>;
    const t = activeTable;
    const numCols = cols.filter((c) => t.rows.some((r) => typeof r[c] === "number"));
    const runPredict = () => {
      if (!predCol) return;
      const vals = t.rows.map((r) => Number(r[predCol]) || 0);
      const preds = predictValues(vals, predSteps);
      setPredResult(preds);
      addLog(`تنبؤ: ${predSteps} قيمة لعمود "${predCol}"`);
    };
    const runWhatIf = () => {
      if (!whatIfCol || whatIfRow < 0) return;
      const oldVal = t.rows[whatIfRow]?.[whatIfCol];
      const newNumericVal = isNaN(Number(whatIfNewVal)) ? whatIfNewVal : Number(whatIfNewVal);
      // Compute impact on numeric columns
      const impacts: Record<string, { before: number; after: number }> = {};
      for (const nc of numCols) {
        if (nc === whatIfCol) continue;
        const before = t.rows.reduce((a, r) => a + (Number(r[nc]) || 0), 0);
        const after = t.rows.reduce((a, r, ri) => {
          if (ri === whatIfRow) {
            const modRow = { ...r, [whatIfCol]: newNumericVal };
            return a + (Number(modRow[nc]) || 0);
          }
          return a + (Number(r[nc]) || 0);
        }, 0);
        if (before !== after) impacts[nc] = { before: Math.round(before * 100) / 100, after: Math.round(after * 100) / 100 };
      }
      setWhatIfResult({ column: whatIfCol, row: whatIfRow, oldVal, newVal: newNumericVal, impacts });
      addLog(`ماذا لو: تغيير ${whatIfCol}[${whatIfRow}] من ${oldVal} إلى ${newNumericVal}`);
    };
    return (
      <SectionCard title="التنبؤ والسيناريوهات" icon="trending_up">
        <div className="space-y-6">
          {/* Predictive */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2"><MIcon name="insights" className="text-blue-600" /> التنبؤ (Linear Regression)</h4>
            <div className="flex gap-2 items-end flex-wrap">
              <div><label className="block text-xs text-gray-500 mb-1">العمود الرقمي</label>
                <select className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={predCol} onChange={(e) => setPredCol(e.target.value)}>
                  <option value="">اختر</option>{numCols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-xs text-gray-500 mb-1">عدد القيم المتنبأة</label>
                <input type="number" className="border rounded-lg px-3 py-2 text-sm w-20 dark:bg-gray-800 dark:border-gray-700" value={predSteps} onChange={(e) => setPredSteps(Number(e.target.value) || 1)} min={1} max={20} /></div>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700" onClick={runPredict}>
                <MIcon name="trending_up" className="text-lg align-middle ml-1" /> تنبؤ
              </button>
            </div>
            {predResult && (
              <div className="border rounded-lg p-3 dark:border-gray-700">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {predResult.map((p) => (
                    <div key={p.index} className="text-center p-2 border rounded-lg dark:border-gray-600">
                      <div className="text-xs text-gray-400">#{p.index + 1}</div>
                      <div className="text-lg font-bold text-blue-600">{formatNum(p.value)}</div>
                      <div className="text-xs"><Badge color={p.confidence > 0.7 ? "green" : p.confidence > 0.4 ? "yellow" : "red"}>{(p.confidence * 100).toFixed(0)}% ثقة</Badge></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* What-If */}
          <div className="space-y-3 border-t dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium flex items-center gap-2"><MIcon name="science" className="text-purple-600" /> تحليل ماذا لو (What-If)</h4>
            <div className="flex gap-2 items-end flex-wrap">
              <div><label className="block text-xs text-gray-500 mb-1">العمود</label>
                <select className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={whatIfCol} onChange={(e) => setWhatIfCol(e.target.value)}>
                  <option value="">اختر</option>{cols.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="block text-xs text-gray-500 mb-1">رقم الصف</label>
                <input type="number" className="border rounded-lg px-3 py-2 text-sm w-20 dark:bg-gray-800 dark:border-gray-700" value={whatIfRow} onChange={(e) => setWhatIfRow(Number(e.target.value) || 0)} min={0} max={t.rows.length - 1} /></div>
              <div><label className="block text-xs text-gray-500 mb-1">القيمة الجديدة</label>
                <input className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-700" value={whatIfNewVal} onChange={(e) => setWhatIfNewVal(e.target.value)} /></div>
              <button className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700" onClick={runWhatIf}>
                <MIcon name="science" className="text-lg align-middle ml-1" /> تحليل
              </button>
            </div>
            {whatIfResult && (
              <div className="border rounded-lg p-3 dark:border-gray-700 space-y-2">
                <p className="text-sm">تغيير <strong>{whatIfResult.column}</strong>[صف {whatIfResult.row}]: <Badge color="red">{String(whatIfResult.oldVal ?? "—")}</Badge> → <Badge color="green">{String(whatIfResult.newVal)}</Badge></p>
                {Object.keys(whatIfResult.impacts).length > 0 ? (
                  <div className="space-y-1">{Object.entries(whatIfResult.impacts).map(([col, impact]: [string, any]) => (
                    <div key={col} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{col}:</span>
                      <span>{formatNum(impact.before)}</span>
                      <MIcon name="arrow_forward" className="text-gray-400 text-sm" />
                      <span className={impact.after > impact.before ? "text-green-600" : "text-red-600"}>{formatNum(impact.after)}</span>
                      <Badge color={impact.after > impact.before ? "green" : "red"}>{impact.after > impact.before ? "+" : ""}{formatNum(impact.after - impact.before)}</Badge>
                    </div>
                  ))}</div>
                ) : <p className="text-xs text-gray-400">لا يوجد تأثير مباشر على الأعمدة الأخرى</p>}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────

  const sectionRenderers: Record<SectionId, () => React.ReactNode> = {
    canvas: renderCanvas,
    import: renderImport,
    preflight: renderPreflight,
    colIntel: renderColIntel,
    colMap: renderColMap,
    colOps: renderColOps,
    tableOps: renderTableOps,
    tir: renderTIR,
    powerQuery: renderPowerQuery,
    formula: renderFormula,
    cleaning: renderCleaning,
    compare: renderCompare,
    kpi: renderKPI,
    ai: renderAI,
    recipes: renderRecipes,
    formatting: renderFormatting,
    export: renderExport,
    collab: renderCollab,
    predictive: renderPredictive,
  };

  return (
    <div className="h-screen flex bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100" dir="rtl">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-0"} transition-all duration-200 border-l dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-hidden flex-shrink-0`}>
        <div className="p-3 border-b dark:border-gray-800">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <MIcon name="science" className="text-blue-600" /> اختبار محرك Excel
          </h2>
          <p className="text-xs text-gray-400 mt-1">19 قسم وظيفي</p>
        </div>
        <nav className="py-1 overflow-y-auto" style={{ maxHeight: "calc(100vh - 80px)" }}>
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${activeSection === s.id ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600" : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
              <MIcon name={s.icon} className="text-base" /><span>{s.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <header className="flex items-center gap-2 px-4 py-2 border-b dark:border-gray-800 bg-white dark:bg-gray-950">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <MIcon name={sidebarOpen ? "menu_open" : "menu"} className="text-xl" />
          </button>
          <h1 className="text-sm font-bold flex-1">
            {SECTIONS.find((s) => s.id === activeSection)?.label}
          </h1>
          {tables.length > 0 && (
            <select className="border rounded-lg px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-700" value={activeTableId || ""} onChange={(e) => setActiveTableId(e.target.value)}>
              {tables.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.rows.length} صف)</option>)}
            </select>
          )}
          <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative" onClick={() => setShowLog(!showLog)}>
            <MIcon name="terminal" className="text-xl" />
            {log.length > 0 && <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] flex items-center justify-center">{log.length}</span>}
          </button>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sectionRenderers[activeSection]?.()}

          {activeTable && (
            <SectionCard title={`معاينة: ${activeTable.name}`} icon="table_view" defaultOpen={false}>
              <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <th className="px-2 py-1.5 text-right text-gray-400">#</th>
                    {cols.map((c) => <th key={c} className="px-2 py-1.5 text-right whitespace-nowrap">{c}</th>)}
                  </tr></thead>
                  <tbody>{activeTable.rows.slice(0, 30).map((r, ri) => (
                    <tr key={ri} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-2 py-1 text-gray-400">{ri + 1}</td>
                      {cols.map((c) => <td key={c} className="px-2 py-1 whitespace-nowrap">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}</tbody>
                </table>
                {activeTable.rows.length > 30 && <p className="text-xs text-gray-400 p-2 text-center">يعرض أول 30 صف من {activeTable.rows.length}</p>}
              </div>
            </SectionCard>
          )}
        </div>

        {showLog && (
          <div className="border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900 max-h-48 overflow-y-auto">
            <div className="flex items-center px-3 py-1 border-b dark:border-gray-800">
              <span className="text-xs font-medium flex-1">سجل العمليات ({log.length})</span>
              <button className="text-xs text-red-500 hover:text-red-700" onClick={() => setLog([])}>مسح</button>
            </div>
            <div className="p-2 space-y-0.5 font-mono text-xs">
              {log.map((msg, i) => <div key={i} className="text-gray-500 dark:text-gray-400">{msg}</div>)}
              {log.length === 0 && <div className="text-gray-400">لا توجد عمليات مسجلة</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
