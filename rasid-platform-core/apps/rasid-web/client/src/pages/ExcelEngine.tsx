/* ═══════════════════════════════════════════════════════════════
   RASID — Excel Engine: Data Canvas
   Full production UI for Excel/CSV ingestion, transformation,
   quality analysis, KPI discovery, and export.
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";

// ── Types ────────────────────────────────────────────────────
interface ColumnDef {
  name: string;
  type: "string" | "number" | "date" | "boolean" | "unknown";
  nullCount: number;
  uniqueCount: number;
}

interface SheetMeta {
  sheetName: string;
  tableName: string;
  columns: ColumnDef[];
  rowCount: number;
}

interface UploadedFile {
  fileId: string;
  fileName: string;
  sheets: SheetMeta[];
}

interface PreflightResult {
  totalSheets: number;
  totalRows: number;
  totalColumns: number;
  nullRatio: number;
  contentMap: UploadedFile[];
  qualitySummary: { score: number; issues: string[] };
  joinSuggestions: JoinSuggestion[];
}

interface JoinSuggestion {
  tableA: string;
  tableB: string;
  columnA: string;
  columnB: string;
  confidence: number;
  joinType: string;
}

interface TransformStep {
  id: string;
  operation: string;
  params: Record<string, unknown>;
  label: string;
}

interface QualityIssue {
  column: string;
  issue: string;
  severity: "high" | "medium" | "low";
  autoFixable: boolean;
}

interface KpiItem {
  name: string;
  value: string;
  formula: string;
  chartType: string;
}

interface Recipe {
  id: string;
  name: string;
  steps: TransformStep[];
  createdAt: string;
}

type Mode = "smart" | "pro";
type LeftTab = "library" | "columnMap" | "operations" | "recipes" | "quality" | "export" | "kpi";

// ── Color Palette ────────────────────────────────────────────
const C = {
  bg: "#0f1117",
  surface: "#1a1d27",
  surfaceAlt: "#222632",
  border: "#2d3348",
  borderActive: "#6366f1",
  text: "#e2e8f0",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  accent: "#6366f1",
  accentHover: "#818cf8",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#f59e0b",
  blue: "#3b82f6",
  cyan: "#06b6d4",
};

// ── Helpers ──────────────────────────────────────────────────
let _stepId = 0;
function nextStepId() {
  return `step_${++_stepId}_${Date.now()}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadBlob(data: string, filename: string, mime: string) {
  const byteChars = atob(data);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ExcelEngine() {
  // ── Core State ───────────────────────────────────────────
  const [mode, setMode] = useState<Mode>("smart");
  const [leftTab, setLeftTab] = useState<LeftTab>("library");
  const [leftOpen, setLeftOpen] = useState(true);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [tableColumns, setTableColumns] = useState<ColumnDef[]>([]);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string } | null>(null);
  const [formulaText, setFormulaText] = useState("");
  const [steps, setSteps] = useState<TransformStep[]>([]);
  const [qualityScore, setQualityScore] = useState<number>(0);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [statusMsg, setStatusMsg] = useState("جاهز");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [smartRunning, setSmartRunning] = useState(false);
  const [smartLog, setSmartLog] = useState<string[]>([]);
  const [joinSuggestions, setJoinSuggestions] = useState<JoinSuggestion[]>([]);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinConfig, setJoinConfig] = useState({ tableB: "", colA: "", colB: "", type: "inner" });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [exportRtl, setExportRtl] = useState(true);
  const [exportLineage, setExportLineage] = useState(true);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [recipeName, setRecipeName] = useState("");
  const [columnIntel, setColumnIntel] = useState<Record<string, unknown>[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ROWS_PER_PAGE = 200;

  // ── tRPC Mutations ─────────────────────────────────────
  const uploadMut = trpc.excelEngine.ingest.upload.useMutation();
  const preflightMut = trpc.excelEngine.ingest.preflight.useMutation();
  const colIntelMut = trpc.excelEngine.catalog.columnIntelligence.useMutation();
  const unifyCols = trpc.excelEngine.catalog.unifyColumns.useMutation();
  const suggestJoins = trpc.excelEngine.relation.suggestJoins.useMutation();
  const addColumnMut = trpc.excelEngine.canvas.addColumn.useMutation();
  const transformMut = trpc.excelEngine.transform.apply.useMutation();
  const exportPqMut = trpc.excelEngine.transform.exportPowerQuery.useMutation();
  const recalcMut = trpc.excelEngine.svm.recalc.useMutation();
  const cleanAnalyze = trpc.excelEngine.clean.analyze.useMutation();
  const cleanApply = trpc.excelEngine.clean.apply.useMutation();
  const compareDiff = trpc.excelEngine.compare.diff.useMutation();
  const kpiSuggest = trpc.excelEngine.kpi.suggest.useMutation();
  const formatBeautify = trpc.excelEngine.format.beautify.useMutation();
  const exportXlsx = trpc.excelEngine.exportXlsx.useMutation();
  const recipeSave = trpc.excelEngine.recipe.save.useMutation();
  const recipeApplyMut = trpc.excelEngine.recipe.apply.useMutation();
  const aiAnalyze = trpc.excelEngine.ai.analyzeDataset.useMutation();
  const recipeListQuery = trpc.excelEngine.recipe.list.useQuery(undefined, { enabled: false });
  const createEmptyMut = trpc.excelEngine.canvas.createEmpty.useMutation();

  // ── File Upload ────────────────────────────────────────
  const handleFileUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploadProgress(10);
    setStatusMsg(`جارِ رفع ${file.name}...`);
    try {
      const base64 = await fileToBase64(file);
      setUploadProgress(40);
      const result = await uploadMut.mutateAsync({
        fileName: file.name,
        data: base64,
        mimeType: file.type || "application/octet-stream",
      });
      setUploadProgress(80);
      const uploaded: UploadedFile = {
        fileId: (result as any).fileId || `f_${Date.now()}`,
        fileName: file.name,
        sheets: (result as any).sheets || [],
      };
      setFiles((prev) => [...prev, uploaded]);
      setActiveFileId(uploaded.fileId);
      if (uploaded.sheets.length > 0) {
        setActiveSheet(uploaded.sheets[0].sheetName);
        setTableData((result as any).preview || []);
        setTableColumns(uploaded.sheets[0].columns || []);
      }
      setUploadProgress(100);
      setStatusMsg(`تم رفع ${file.name} بنجاح`);
      setTimeout(() => setUploadProgress(null), 1200);

      // Run preflight automatically
      const pf = await preflightMut.mutateAsync({ fileId: uploaded.fileId });
      setPreflight(pf as any);
      setJoinSuggestions((pf as any).joinSuggestions || []);
      if ((pf as any).qualitySummary) {
        setQualityScore((pf as any).qualitySummary.score || 0);
      }
    } catch (err: any) {
      setStatusMsg(`خطأ في الرفع: ${err.message}`);
      setUploadProgress(null);
    }
  }, [uploadMut, preflightMut]);

  // ── Drag & Drop ────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  // ── Smart Mode (Analyze Everything) ────────────────────
  const runSmartAnalysis = useCallback(async () => {
    if (!activeFileId) return;
    setSmartRunning(true);
    setSmartLog([]);
    const log = (msg: string) => setSmartLog((p) => [...p, msg]);
    try {
      log("تشغيل الفحص الأولي...");
      const pf = await preflightMut.mutateAsync({ fileId: activeFileId });
      setPreflight(pf as any);
      log(`تم: ${(pf as any).totalSheets} ورقة، ${(pf as any).totalRows} صف`);

      log("تحليل ذكاء الأعمدة...");
      const intel = await colIntelMut.mutateAsync({ fileId: activeFileId });
      setColumnIntel((intel as any).columns || []);
      log("تم تحليل الأعمدة");

      log("توحيد أسماء الأعمدة...");
      await unifyCols.mutateAsync({ fileId: activeFileId });
      log("تم التوحيد");

      log("اقتراح الروابط بين الجداول...");
      const joins = await suggestJoins.mutateAsync({ fileId: activeFileId });
      setJoinSuggestions((joins as any).suggestions || []);
      log(`تم: ${((joins as any).suggestions || []).length} رابط مقترح`);

      log("تحليل الجودة...");
      const qa = await cleanAnalyze.mutateAsync({ fileId: activeFileId });
      setQualityScore((qa as any).score || 0);
      setQualityIssues((qa as any).issues || []);
      log(`جودة: ${(qa as any).score}%`);

      log("اقتراح مؤشرات الأداء...");
      const kpiRes = await kpiSuggest.mutateAsync({ fileId: activeFileId });
      setKpis((kpiRes as any).kpis || []);
      log(`تم: ${((kpiRes as any).kpis || []).length} مؤشر`);

      log("اكتمل التحليل الذكي");
      setStatusMsg("اكتمل التحليل الذكي");
    } catch (err: any) {
      log(`خطأ: ${err.message}`);
    }
    setSmartRunning(false);
  }, [activeFileId, preflightMut, colIntelMut, unifyCols, suggestJoins, cleanAnalyze, kpiSuggest]);

  // ── Column Operations ──────────────────────────────────
  const applyTransform = useCallback(async (operation: string, params: Record<string, unknown>, label: string) => {
    if (!activeFileId) return;
    setStatusMsg(`جارِ تنفيذ: ${label}...`);
    try {
      const res = await transformMut.mutateAsync({
        fileId: activeFileId,
        sheet: activeSheet || "",
        operation,
        params,
      });
      const step: TransformStep = { id: nextStepId(), operation, params, label };
      setSteps((p) => [...p, step]);
      if ((res as any).data) setTableData((res as any).data);
      if ((res as any).columns) setTableColumns((res as any).columns);
      setStatusMsg(`تم: ${label}`);
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, activeSheet, transformMut]);

  const handleRenameCol = useCallback(() => {
    if (!selectedCol) return;
    const newName = prompt("اسم العمود الجديد:", selectedCol);
    if (newName && newName !== selectedCol) {
      applyTransform("rename", { column: selectedCol, newName }, `إعادة تسمية ${selectedCol} → ${newName}`);
    }
  }, [selectedCol, applyTransform]);

  const handleCastCol = useCallback(() => {
    if (!selectedCol) return;
    const type = prompt("النوع الجديد (string/number/date):", "string");
    if (type) {
      applyTransform("cast", { column: selectedCol, targetType: type }, `تحويل نوع ${selectedCol} → ${type}`);
    }
  }, [selectedCol, applyTransform]);

  const handleSplitCol = useCallback(() => {
    if (!selectedCol) return;
    const delimiter = prompt("الفاصل:", ",");
    if (delimiter) {
      applyTransform("split", { column: selectedCol, delimiter }, `تقسيم ${selectedCol} بـ "${delimiter}"`);
    }
  }, [selectedCol, applyTransform]);

  const handleCleanCol = useCallback(() => {
    if (!selectedCol) return;
    applyTransform("clean", { column: selectedCol, ops: ["trim", "normalize", "dedupe"] }, `تنظيف ${selectedCol}`);
  }, [selectedCol, applyTransform]);

  const handleDerivedCol = useCallback(() => {
    if (!selectedCol) return;
    const expr = prompt("التعبير (مثلاً: col1 * col2):", "");
    const name = prompt("اسم العمود المشتق:", "derived_1");
    if (expr && name) {
      applyTransform("derive", { expression: expr, newColumn: name }, `عمود مشتق: ${name}`);
    }
  }, [selectedCol, applyTransform]);

  const handleFilterCol = useCallback(() => {
    if (!selectedCol) return;
    const op = prompt("العملية (=, !=, >, <, contains):", "=");
    const val = prompt("القيمة:", "");
    if (op && val !== null) {
      applyTransform("filter", { column: selectedCol, operator: op, value: val }, `تصفية ${selectedCol} ${op} ${val}`);
    }
  }, [selectedCol, applyTransform]);

  const handleSortCol = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol]);

  // ── Table Operations ───────────────────────────────────
  const handleJoinTables = useCallback(async () => {
    if (!activeFileId || !joinConfig.tableB) return;
    setShowJoinDialog(false);
    await applyTransform("join", {
      tableA: activeSheet,
      tableB: joinConfig.tableB,
      columnA: joinConfig.colA,
      columnB: joinConfig.colB,
      joinType: joinConfig.type,
    }, `ربط ${activeSheet} مع ${joinConfig.tableB}`);
  }, [activeFileId, activeSheet, joinConfig, applyTransform]);

  const handleGroupBy = useCallback(() => {
    const cols = prompt("أعمدة التجميع (مفصولة بفاصلة):", "");
    const agg = prompt("دالة التجميع (sum/avg/count/min/max):", "sum");
    const valCol = prompt("عمود القيم:", "");
    if (cols && agg && valCol) {
      applyTransform("groupBy", {
        groupColumns: cols.split(",").map((s) => s.trim()),
        aggregate: agg,
        valueColumn: valCol,
      }, `تجميع حسب ${cols} (${agg})`);
    }
  }, [applyTransform]);

  const handlePivot = useCallback(() => {
    const rowCol = prompt("عمود الصفوف:", "");
    const colCol = prompt("عمود الأعمدة:", "");
    const valCol = prompt("عمود القيم:", "");
    if (rowCol && colCol && valCol) {
      applyTransform("pivot", { rowColumn: rowCol, columnColumn: colCol, valueColumn: valCol }, `محور: ${rowCol} × ${colCol}`);
    }
  }, [applyTransform]);

  const handleUnpivot = useCallback(() => {
    const cols = prompt("الأعمدة المراد فكها (مفصولة بفاصلة):", "");
    if (cols) {
      applyTransform("unpivot", { columns: cols.split(",").map((s) => s.trim()) }, `فك المحور: ${cols}`);
    }
  }, [applyTransform]);

  const handleCompare = useCallback(async () => {
    if (!activeFileId) return;
    const tableB = prompt("اسم الجدول الثاني للمقارنة:", "");
    if (!tableB) return;
    setStatusMsg("جارِ المقارنة...");
    try {
      const res = await compareDiff.mutateAsync({ fileId: activeFileId, tableA: activeSheet || "", tableB });
      setStatusMsg(`تم: ${(res as any).diffCount || 0} فرق`);
      if ((res as any).data) setTableData((res as any).data);
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, activeSheet, compareDiff]);

  const handleUnion = useCallback(() => {
    const tableB = prompt("اسم الجدول لإلحاقه:", "");
    if (tableB) {
      applyTransform("union", { tableB }, `إلحاق ${tableB}`);
    }
  }, [applyTransform]);

  // ── Formula Bar ────────────────────────────────────────
  const handleFormulaSubmit = useCallback(async () => {
    if (!activeFileId || !formulaText) return;
    setStatusMsg("جارِ الحساب...");
    try {
      const res = await recalcMut.mutateAsync({
        fileId: activeFileId,
        sheet: activeSheet || "",
        formula: formulaText,
        cell: selectedCell ? `${selectedCell.col}${selectedCell.row + 1}` : undefined,
      });
      if ((res as any).data) setTableData((res as any).data);
      setStatusMsg("تم الحساب");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, activeSheet, formulaText, selectedCell, recalcMut]);

  // ── Quality ────────────────────────────────────────────
  const handleAutoFix = useCallback(async (issue: QualityIssue) => {
    if (!activeFileId) return;
    setStatusMsg(`جارِ الإصلاح: ${issue.issue}...`);
    try {
      const res = await cleanApply.mutateAsync({
        fileId: activeFileId,
        sheet: activeSheet || "",
        fixes: [{ column: issue.column, issue: issue.issue }],
      });
      if ((res as any).data) setTableData((res as any).data);
      setQualityIssues((p) => p.filter((q) => q !== issue));
      setQualityScore((res as any).newScore || qualityScore);
      setSteps((p) => [...p, { id: nextStepId(), operation: "autoFix", params: { column: issue.column, issue: issue.issue }, label: `إصلاح: ${issue.issue} في ${issue.column}` }]);
      setStatusMsg("تم الإصلاح");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, activeSheet, cleanApply, qualityScore]);

  // ── Export ─────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!activeFileId) return;
    setStatusMsg("جارِ التصدير...");
    try {
      if (exportFormat === "xlsx") {
        const res = await exportXlsx.mutateAsync({
          fileId: activeFileId,
          options: { rtl: exportRtl, includeLineage: exportLineage },
        });
        downloadBlob((res as any).data, `${files.find((f) => f.fileId === activeFileId)?.fileName || "export"}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      } else {
        const csvContent = [
          tableColumns.map((c) => c.name).join(","),
          ...tableData.map((row) => tableColumns.map((c) => String((row as any)[c.name] ?? "")).join(",")),
        ].join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${files.find((f) => f.fileId === activeFileId)?.fileName || "export"}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      setStatusMsg("تم التصدير");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, exportFormat, exportRtl, exportLineage, exportXlsx, files, tableColumns, tableData]);

  const handleExportPowerQuery = useCallback(async () => {
    if (!activeFileId) return;
    try {
      const res = await exportPqMut.mutateAsync({ fileId: activeFileId, steps });
      const text = (res as any).mCode || "";
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "query.pq";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg("تم تصدير Power Query");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, steps, exportPqMut]);

  // ── Recipes ────────────────────────────────────────────
  const handleSaveRecipe = useCallback(async () => {
    if (!recipeName || steps.length === 0) return;
    try {
      await recipeSave.mutateAsync({ name: recipeName, steps });
      setRecipes((p) => [...p, { id: `r_${Date.now()}`, name: recipeName, steps: [...steps], createdAt: new Date().toISOString() }]);
      setRecipeName("");
      setStatusMsg("تم حفظ الوصفة");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [recipeName, steps, recipeSave]);

  const handleLoadRecipes = useCallback(async () => {
    try {
      const res = await recipeListQuery.refetch();
      if (res.data) setRecipes((res.data as any).recipes || []);
    } catch (_) { /* ignore */ }
  }, [recipeListQuery]);

  const handleApplyRecipe = useCallback(async (recipe: Recipe) => {
    if (!activeFileId) return;
    setStatusMsg(`جارِ تطبيق الوصفة: ${recipe.name}...`);
    try {
      const res = await recipeApplyMut.mutateAsync({ fileId: activeFileId, recipeId: recipe.id });
      if ((res as any).data) setTableData((res as any).data);
      setSteps((p) => [...p, ...recipe.steps]);
      setStatusMsg(`تم تطبيق: ${recipe.name}`);
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, recipeApplyMut]);

  // ── Beautify ───────────────────────────────────────────
  const handleBeautify = useCallback(async () => {
    if (!activeFileId) return;
    try {
      await formatBeautify.mutateAsync({ fileId: activeFileId });
      setStatusMsg("تم التنسيق");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, formatBeautify]);

  // ── AI Analyze ─────────────────────────────────────────
  const handleAiAnalyze = useCallback(async () => {
    if (!activeFileId) return;
    setStatusMsg("تحليل بالذكاء الاصطناعي...");
    try {
      const res = await aiAnalyze.mutateAsync({ fileId: activeFileId });
      setStatusMsg((res as any).summary || "اكتمل التحليل");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [activeFileId, aiAnalyze]);

  // ── Create Empty Canvas ────────────────────────────────
  const handleCreateEmpty = useCallback(async () => {
    try {
      const res = await createEmptyMut.mutateAsync({});
      const fid = (res as any).fileId || `f_${Date.now()}`;
      const uploaded: UploadedFile = { fileId: fid, fileName: "مصنف جديد.xlsx", sheets: [{ sheetName: "Sheet1", tableName: "Sheet1", columns: [], rowCount: 0 }] };
      setFiles((p) => [...p, uploaded]);
      setActiveFileId(fid);
      setActiveSheet("Sheet1");
      setTableData([]);
      setTableColumns([]);
      setStatusMsg("تم إنشاء مصنف فارغ");
    } catch (err: any) {
      setStatusMsg(`خطأ: ${err.message}`);
    }
  }, [createEmptyMut]);

  // ── Remove Step ────────────────────────────────────────
  const removeStep = useCallback((stepId: string) => {
    setSteps((p) => p.filter((s) => s.id !== stepId));
  }, []);

  // ── Sorted / Paginated Data ────────────────────────────
  const sortedData = useMemo(() => {
    if (!sortCol) return tableData;
    const copy = [...tableData];
    copy.sort((a, b) => {
      const va = (a as any)[sortCol] ?? "";
      const vb = (b as any)[sortCol] ?? "";
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [tableData, sortCol, sortDir]);

  const pagedData = useMemo(() => {
    const start = page * ROWS_PER_PAGE;
    return sortedData.slice(start, start + ROWS_PER_PAGE);
  }, [sortedData, page]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / ROWS_PER_PAGE));

  // ── Active file for display ────────────────────────────
  const activeFile = files.find((f) => f.fileId === activeFileId);

  // ── Close context menu on outside click ────────────────
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // Load recipes on mount
  useEffect(() => { handleLoadRecipes(); }, []);

  // ═══════════════════════════════════════════════════════
  //  SUB-COMPONENTS (inline)
  // ═══════════════════════════════════════════════════════

  // ── Button ─────────────────────────────────────────────
  const Btn = useCallback(({ label, onClick, accent, small, disabled, style: extra }: {
    label: string; onClick: () => void; accent?: boolean; small?: boolean; disabled?: boolean; style?: React.CSSProperties;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? "4px 10px" : "7px 16px",
        borderRadius: 6,
        border: accent ? "none" : `1px solid ${C.border}`,
        background: accent ? C.accent : "transparent",
        color: disabled ? C.textMuted : C.text,
        fontSize: small ? 12 : 13,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.5 : 1,
        ...extra,
      }}
    >
      {label}
    </button>
  ), []);

  // ═══════════════════════════════════════════════════════
  //  LEFT PANEL
  // ═══════════════════════════════════════════════════════
  const renderLeftPanel = () => {
    if (!leftOpen) return null;
    const tabStyle = (t: LeftTab): React.CSSProperties => ({
      padding: "6px 10px",
      fontSize: 11,
      cursor: "pointer",
      borderRadius: 4,
      background: leftTab === t ? C.accent : "transparent",
      color: leftTab === t ? "#fff" : C.textDim,
      border: "none",
      fontFamily: "inherit",
    });

    return (
      <div style={{ width: 280, minWidth: 280, background: C.surface, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Tab Bar */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "8px 8px 4px", borderBottom: `1px solid ${C.border}` }}>
          <button style={tabStyle("library")} onClick={() => setLeftTab("library")}>المكتبة</button>
          <button style={tabStyle("columnMap")} onClick={() => setLeftTab("columnMap")}>خريطة الأعمدة</button>
          <button style={tabStyle("operations")} onClick={() => setLeftTab("operations")}>العمليات</button>
          <button style={tabStyle("recipes")} onClick={() => setLeftTab("recipes")}>الوصفات</button>
          <button style={tabStyle("quality")} onClick={() => setLeftTab("quality")}>الجودة</button>
          <button style={tabStyle("kpi")} onClick={() => setLeftTab("kpi")}>المؤشرات</button>
          <button style={tabStyle("export")} onClick={() => setLeftTab("export")}>تصدير</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
          {/* ─── Library ───────────────────────────── */}
          {leftTab === "library" && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <Btn label="مصنف فارغ جديد" onClick={handleCreateEmpty} small />
              </div>

              {/* Upload Zone */}
              <div
                ref={dropRef}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? C.accentHover : C.border}`,
                  borderRadius: 8,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "rgba(99,102,241,0.1)" : "transparent",
                  marginBottom: 12,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                <div style={{ color: C.textDim, fontSize: 12 }}>اسحب ملفات Excel/CSV هنا أو انقر للاختيار</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
              </div>

              {uploadProgress !== null && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2 }}>
                    <div style={{ height: 4, width: `${uploadProgress}%`, background: C.accent, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{uploadProgress}%</div>
                </div>
              )}

              {/* File Tree */}
              {files.map((file) => (
                <div key={file.fileId} style={{ marginBottom: 8 }}>
                  <div
                    onClick={() => { setActiveFileId(file.fileId); if (file.sheets[0]) { setActiveSheet(file.sheets[0].sheetName); } }}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 4,
                      background: activeFileId === file.fileId ? C.surfaceAlt : "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: C.text,
                      fontWeight: 600,
                    }}
                  >
                    {file.fileName}
                  </div>
                  {file.sheets.map((sheet) => (
                    <div key={sheet.sheetName} style={{ paddingRight: 16 }}>
                      <div
                        onClick={() => { setActiveFileId(file.fileId); setActiveSheet(sheet.sheetName); }}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          color: activeSheet === sheet.sheetName && activeFileId === file.fileId ? C.accent : C.textDim,
                          cursor: "pointer",
                        }}
                      >
                        {sheet.sheetName} ({sheet.rowCount} صف)
                      </div>
                      {sheet.columns.map((col) => (
                        <div
                          key={col.name}
                          onClick={() => setSelectedCol(col.name)}
                          style={{
                            paddingRight: 32,
                            padding: "2px 8px 2px 32px",
                            fontSize: 11,
                            color: selectedCol === col.name ? C.accentHover : C.textMuted,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ display: "inline-block", width: 18, fontSize: 9, color: C.cyan, fontWeight: 700 }}>
                            {col.type === "number" ? "#" : col.type === "date" ? "D" : col.type === "boolean" ? "?" : "T"}
                          </span>
                          {col.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}

              {/* Preflight Summary */}
              {preflight && (
                <div style={{ marginTop: 12, padding: 8, background: C.surfaceAlt, borderRadius: 6, fontSize: 11, color: C.textDim }}>
                  <div style={{ fontWeight: 700, color: C.text, marginBottom: 4 }}>نتائج الفحص الأولي</div>
                  <div>الأوراق: {preflight.totalSheets} | الصفوف: {preflight.totalRows} | الأعمدة: {preflight.totalColumns}</div>
                  <div>نسبة الفراغات: {(preflight.nullRatio * 100).toFixed(1)}%</div>
                  <div>الجودة: {preflight.qualitySummary.score}%</div>
                  {joinSuggestions.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 700, color: C.text }}>روابط مقترحة:</div>
                      {joinSuggestions.map((j, i) => (
                        <div key={i} style={{ fontSize: 10, marginTop: 2 }}>
                          {j.tableA}.{j.columnA} ↔ {j.tableB}.{j.columnB} ({(j.confidence * 100).toFixed(0)}%)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Column Map ────────────────────────── */}
          {leftTab === "columnMap" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>خريطة الأعمدة</div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>خطوط بين الأعمدة المتشابهة في ملفات مختلفة</div>
              {files.length < 2 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>ارفع ملفين أو أكثر لرؤية خريطة الأعمدة</div>
              ) : (
                <div style={{ position: "relative", minHeight: 200 }}>
                  {files.map((file, fi) => (
                    <div key={file.fileId} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: fi === 0 ? C.blue : C.cyan, marginBottom: 4 }}>{file.fileName}</div>
                      {file.sheets.flatMap((s) => s.columns).map((col) => (
                        <div key={col.name} style={{ padding: "2px 8px", fontSize: 11, color: C.textDim, borderRight: `3px solid ${fi === 0 ? C.blue : C.cyan}`, marginBottom: 2 }}>
                          {col.name} ({col.type})
                        </div>
                      ))}
                    </div>
                  ))}
                  {joinSuggestions.map((j, i) => (
                    <div key={i} style={{ padding: "4px 8px", background: "rgba(99,102,241,0.15)", borderRadius: 4, marginTop: 4, fontSize: 10, color: C.accentHover }}>
                      {j.columnA} ↔ {j.columnB} (ثقة {(j.confidence * 100).toFixed(0)}%)
                    </div>
                  ))}
                </div>
              )}
              {columnIntel.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>ذكاء الأعمدة</div>
                  {columnIntel.map((ci: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: C.textDim, padding: "2px 0" }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{ci.name || ci.column}: </span>
                      {ci.semanticType || ci.type || "غير معروف"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Operations ────────────────────────── */}
          {leftTab === "operations" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>عمليات العمود {selectedCol && <span style={{ color: C.accent }}>: {selectedCol}</span>}</div>
              {!selectedCol ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>اختر عمودًا من المكتبة أو انقر على رأس العمود</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn label="إعادة تسمية" onClick={handleRenameCol} />
                  <Btn label="تغيير النوع" onClick={handleCastCol} />
                  <Btn label="تقسيم بفاصل" onClick={handleSplitCol} />
                  <Btn label="تنظيف (قص، توحيد، حذف مكرر)" onClick={handleCleanCol} />
                  <Btn label="عمود مشتق (تعبير)" onClick={handleDerivedCol} />
                  <Btn label="تصفية" onClick={handleFilterCol} />
                  <Btn label="ترتيب" onClick={() => handleSortCol(selectedCol)} />
                </div>
              )}
              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>عمليات الجدول</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Btn label="ربط جداول (Join)" onClick={() => setShowJoinDialog(true)} />
                <Btn label="إلحاق (Union)" onClick={handleUnion} />
                <Btn label="تجميع (Group By)" onClick={handleGroupBy} />
                <Btn label="محور (Pivot)" onClick={handlePivot} />
                <Btn label="فك المحور (Unpivot)" onClick={handleUnpivot} />
                <Btn label="مقارنة جدولين (Diff)" onClick={handleCompare} />
                <Btn label="تنسيق تلقائي" onClick={handleBeautify} />
                <Btn label="تحليل AI" onClick={handleAiAnalyze} />
              </div>
            </div>
          )}

          {/* ─── Recipes ───────────────────────────── */}
          {leftTab === "recipes" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>سجل التحويلات ({steps.length} خطوة)</div>
              {steps.map((step, i) => (
                <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, color: C.textMuted, width: 20 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{step.label}</span>
                  <button onClick={() => removeStep(step.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>×</button>
                </div>
              ))}
              {steps.length === 0 && <div style={{ color: C.textMuted, fontSize: 12 }}>لا توجد خطوات بعد</div>}

              <div style={{ marginTop: 12, display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="اسم الوصفة"
                  style={{ flex: 1, padding: "5px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, fontFamily: "inherit" }}
                />
                <Btn label="حفظ" onClick={handleSaveRecipe} accent small disabled={!recipeName || steps.length === 0} />
              </div>
              <Btn label="تصدير Power Query M" onClick={handleExportPowerQuery} small style={{ marginTop: 8 }} />

              <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>الوصفات المحفوظة</div>
              <Btn label="تحديث القائمة" onClick={handleLoadRecipes} small style={{ marginBottom: 8 }} />
              {recipes.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{r.name} ({r.steps.length} خطوة)</span>
                  <Btn label="تطبيق" onClick={() => handleApplyRecipe(r)} small accent />
                </div>
              ))}
            </div>
          )}

          {/* ─── Quality ───────────────────────────── */}
          {leftTab === "quality" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>تقرير الجودة</div>
              {/* Gauge */}
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{
                  width: 100, height: 100, borderRadius: "50%", margin: "0 auto",
                  background: `conic-gradient(${qualityScore >= 70 ? C.green : qualityScore >= 40 ? C.orange : C.red} ${qualityScore * 3.6}deg, ${C.surfaceAlt} 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{qualityScore}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>من 100</div>
              </div>

              {qualityIssues.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>لم يتم العثور على مشاكل. شغّل التحليل الذكي أولاً.</div>
              ) : (
                qualityIssues.map((issue, i) => (
                  <div key={i} style={{ padding: "6px 8px", background: C.surfaceAlt, borderRadius: 4, marginBottom: 6, borderRight: `3px solid ${issue.severity === "high" ? C.red : issue.severity === "medium" ? C.orange : C.textMuted}` }}>
                    <div style={{ fontSize: 12, color: C.text }}>{issue.issue}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>العمود: {issue.column} | الخطورة: {issue.severity === "high" ? "عالية" : issue.severity === "medium" ? "متوسطة" : "منخفضة"}</div>
                    {issue.autoFixable && (
                      <Btn label="إصلاح تلقائي" onClick={() => handleAutoFix(issue)} small accent style={{ marginTop: 4 }} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ─── KPI ───────────────────────────────── */}
          {leftTab === "kpi" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>مؤشرات الأداء المقترحة</div>
              {kpis.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 12 }}>شغّل التحليل الذكي لاقتراح المؤشرات</div>
              ) : (
                <>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.textDim }}>المؤشر</th>
                        <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.textDim }}>القيمة</th>
                        <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.textDim }}>الرسم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpis.map((kpi, i) => (
                        <tr key={i}>
                          <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.text }}>{kpi.name}</td>
                          <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.accent, fontWeight: 600 }}>{kpi.value}</td>
                          <td style={{ padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.textDim }}>{kpi.chartType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {kpis.map((kpi, i) => (
                    <div key={i} style={{ marginTop: 6, fontSize: 10, color: C.textMuted }}>
                      {kpi.name}: <span style={{ color: C.textDim, fontFamily: "monospace" }}>{kpi.formula}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ─── Export ────────────────────────────── */}
          {leftTab === "export" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>خيارات التصدير</div>

              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: C.textDim, display: "block", marginBottom: 4 }}>الصيغة</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "xlsx" | "csv")}
                  style={{ width: "100%", padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, fontFamily: "inherit" }}
                >
                  <option value="xlsx">Excel (.xlsx)</option>
                  <option value="csv">CSV (.csv)</option>
                </select>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, marginBottom: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={exportRtl} onChange={(e) => setExportRtl(e.target.checked)} />
                اتجاه RTL
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, marginBottom: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={exportLineage} onChange={(e) => setExportLineage(e.target.checked)} />
                تضمين ورقة النسب (Lineage)
              </label>

              <Btn label="تحميل الملف" onClick={handleExport} accent disabled={!activeFileId} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  //  JOIN DIALOG
  // ═══════════════════════════════════════════════════════
  const renderJoinDialog = () => {
    if (!showJoinDialog) return null;
    const allSheets = files.flatMap((f) => f.sheets.map((s) => s.sheetName));
    const allCols = files.flatMap((f) => f.sheets.flatMap((s) => s.columns.map((c) => c.name)));
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowJoinDialog(false)}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, width: 380, direction: "rtl" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>ربط الجداول</div>

          <label style={{ fontSize: 12, color: C.textDim }}>الجدول الثاني</label>
          <select value={joinConfig.tableB} onChange={(e) => setJoinConfig((p) => ({ ...p, tableB: e.target.value }))} style={{ width: "100%", padding: 6, marginBottom: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}>
            <option value="">اختر...</option>
            {allSheets.filter((s) => s !== activeSheet).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <label style={{ fontSize: 12, color: C.textDim }}>عمود المفتاح (الجدول الحالي)</label>
          <select value={joinConfig.colA} onChange={(e) => setJoinConfig((p) => ({ ...p, colA: e.target.value }))} style={{ width: "100%", padding: 6, marginBottom: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}>
            <option value="">اختر...</option>
            {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ fontSize: 12, color: C.textDim }}>عمود المفتاح (الجدول الثاني)</label>
          <select value={joinConfig.colB} onChange={(e) => setJoinConfig((p) => ({ ...p, colB: e.target.value }))} style={{ width: "100%", padding: 6, marginBottom: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}>
            <option value="">اختر...</option>
            {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ fontSize: 12, color: C.textDim }}>نوع الربط</label>
          <select value={joinConfig.type} onChange={(e) => setJoinConfig((p) => ({ ...p, type: e.target.value }))} style={{ width: "100%", padding: 6, marginBottom: 16, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12 }}>
            <option value="inner">Inner</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="full">Full Outer</option>
          </select>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn label="تنفيذ الربط" onClick={handleJoinTables} accent />
            <Btn label="إلغاء" onClick={() => setShowJoinDialog(false)} />
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  //  CONTEXT MENU
  // ═══════════════════════════════════════════════════════
  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const items = [
      { label: "ربط جداول (Join)", action: () => setShowJoinDialog(true) },
      { label: "إلحاق (Union)", action: handleUnion },
      { label: "تجميع (Group By)", action: handleGroupBy },
      { label: "محور (Pivot)", action: handlePivot },
      { label: "فك المحور (Unpivot)", action: handleUnpivot },
      { label: "مقارنة (Diff)", action: handleCompare },
    ];
    return (
      <div style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 4, zIndex: 999, minWidth: 180 }}>
        {items.map((item, i) => (
          <div
            key={i}
            onClick={() => { item.action(); setContextMenu(null); }}
            style={{ padding: "6px 12px", fontSize: 12, color: C.text, cursor: "pointer", borderRadius: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.surfaceAlt)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {item.label}
          </div>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{ direction: "rtl", fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", background: C.bg, color: C.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top Bar ─────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface, minHeight: 48 }}>
        {/* Toggle Left */}
        <button onClick={() => setLeftOpen((p) => !p)} style={{ background: "none", border: "none", color: C.textDim, fontSize: 18, cursor: "pointer", padding: "2px 6px" }}>
          {leftOpen ? "◁" : "▷"}
        </button>

        {/* Mode Toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
          <button onClick={() => setMode("smart")} style={{ padding: "5px 14px", fontSize: 12, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "smart" ? C.accent : "transparent", color: mode === "smart" ? "#fff" : C.textDim }}>ذكي</button>
          <button onClick={() => setMode("pro")} style={{ padding: "5px 14px", fontSize: 12, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "pro" ? C.accent : "transparent", color: mode === "pro" ? "#fff" : C.textDim }}>احترافي</button>
        </div>

        {/* File Name */}
        <div style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeFile ? activeFile.fileName : "محرك البيانات - رصيد"}
        </div>

        {/* Smart Analyze Button */}
        <button
          onClick={runSmartAnalysis}
          disabled={!activeFileId || smartRunning}
          style={{
            padding: "7px 20px",
            borderRadius: 8,
            border: "none",
            background: smartRunning ? C.surfaceAlt : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: !activeFileId || smartRunning ? "not-allowed" : "pointer",
            opacity: !activeFileId ? 0.5 : 1,
            fontFamily: "inherit",
          }}
        >
          {smartRunning ? "جارِ التحليل..." : "تحليل شامل"}
        </button>

        <Btn label="تنسيق" onClick={handleBeautify} small />
        <Btn label="AI تحليل" onClick={handleAiAnalyze} small />
      </div>

      {/* ── Smart Log (if running) ──────────────────────── */}
      {smartLog.length > 0 && (
        <div style={{ background: C.surfaceAlt, padding: "4px 16px", borderBottom: `1px solid ${C.border}`, maxHeight: 80, overflowY: "auto" }}>
          {smartLog.map((msg, i) => (
            <div key={i} style={{ fontSize: 11, color: i === smartLog.length - 1 ? C.accent : C.textDim, padding: "1px 0" }}>
              {smartRunning && i === smartLog.length - 1 ? "⟳ " : "✓ "}{msg}
            </div>
          ))}
        </div>
      )}

      {/* ── Formula Bar ─────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <span style={{ fontSize: 12, color: C.textDim, minWidth: 20, fontFamily: "monospace" }}>
          {selectedCell ? `${selectedCell.col}${selectedCell.row + 1}` : "fx"}
        </span>
        <input
          value={formulaText}
          onChange={(e) => setFormulaText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleFormulaSubmit(); }}
          placeholder="أدخل صيغة مثل =SUM(A1:A10)"
          style={{ flex: 1, padding: "4px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, fontFamily: "monospace", direction: "ltr", textAlign: "left" }}
        />
        <Btn label="حساب" onClick={handleFormulaSubmit} small accent />
      </div>

      {/* ── Main Area ───────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Panel */}
        {renderLeftPanel()}

        {/* Center: Table */}
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }); }}
        >
          {tableData.length === 0 && files.length === 0 ? (
            /* Empty State */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ fontSize: 48, opacity: 0.3 }}>📊</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.textDim }}>محرك البيانات</div>
              <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 400, textAlign: "center", lineHeight: 1.6 }}>
                ارفع ملفات Excel أو CSV من اللوحة اليمنى، أو اسحبها إلى هنا لبدء التحليل
              </div>
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? C.accentHover : C.border}`,
                  borderRadius: 12,
                  padding: "40px 60px",
                  cursor: "pointer",
                  background: dragOver ? "rgba(99,102,241,0.08)" : "transparent",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 14, color: C.accent, fontWeight: 600, marginBottom: 4 }}>اسحب ملفاتك هنا</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>أو انقر لاختيار الملفات (.xlsx, .csv)</div>
              </div>
            </div>
          ) : tableData.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ color: C.textMuted, fontSize: 14 }}>اختر ورقة من المكتبة لعرض البيانات</div>
            </div>
          ) : (
            /* Data Table */
            <div style={{ flex: 1, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", top: 0, zIndex: 2, padding: "6px 8px", background: C.surfaceAlt, borderBottom: `2px solid ${C.border}`, color: C.textMuted, fontSize: 10, textAlign: "center", minWidth: 40 }}>#</th>
                    {tableColumns.map((col) => (
                      <th
                        key={col.name}
                        onClick={() => { setSelectedCol(col.name); handleSortCol(col.name); }}
                        style={{
                          position: "sticky",
                          top: 0,
                          zIndex: 2,
                          padding: "6px 10px",
                          background: selectedCol === col.name ? C.accent : C.surfaceAlt,
                          borderBottom: `2px solid ${C.border}`,
                          color: selectedCol === col.name ? "#fff" : C.text,
                          cursor: "pointer",
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          minWidth: 80,
                          userSelect: "none",
                        }}
                      >
                        <span style={{ fontSize: 9, color: selectedCol === col.name ? "rgba(255,255,255,0.7)" : C.cyan, marginLeft: 4, fontWeight: 700 }}>
                          {col.type === "number" ? "#" : col.type === "date" ? "D" : col.type === "boolean" ? "?" : "T"}
                        </span>
                        {col.name}
                        {sortCol === col.name && <span style={{ marginRight: 4, fontSize: 10 }}>{sortDir === "asc" ? " ▲" : " ▼"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.map((row, ri) => {
                    const rowIdx = page * ROWS_PER_PAGE + ri;
                    return (
                      <tr key={ri} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "4px 8px", color: C.textMuted, textAlign: "center", fontSize: 10, background: C.surface }}>{rowIdx + 1}</td>
                        {tableColumns.map((col) => {
                          const val = (row as any)[col.name];
                          const isSelected = selectedCell?.row === rowIdx && selectedCell?.col === col.name;
                          return (
                            <td
                              key={col.name}
                              onClick={() => {
                                setSelectedCell({ row: rowIdx, col: col.name });
                                setFormulaText(val != null ? String(val) : "");
                              }}
                              style={{
                                padding: "4px 10px",
                                color: val == null ? C.textMuted : C.text,
                                textAlign: col.type === "number" ? "left" : "right",
                                background: isSelected ? "rgba(99,102,241,0.15)" : "transparent",
                                cursor: "cell",
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                outline: isSelected ? `2px solid ${C.accent}` : "none",
                              }}
                            >
                              {val != null ? String(val) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sheet Tabs (at bottom of table) */}
          {files.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "2px 8px", borderTop: `1px solid ${C.border}`, background: C.surface, overflowX: "auto" }}>
              {files.flatMap((f) => f.sheets.map((s) => (
                <button
                  key={`${f.fileId}-${s.sheetName}`}
                  onClick={() => { setActiveFileId(f.fileId); setActiveSheet(s.sheetName); }}
                  style={{
                    padding: "4px 12px",
                    fontSize: 11,
                    border: "none",
                    borderBottom: activeSheet === s.sheetName && activeFileId === f.fileId ? `2px solid ${C.accent}` : "2px solid transparent",
                    background: "transparent",
                    color: activeSheet === s.sheetName && activeFileId === f.fileId ? C.accent : C.textDim,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.sheetName}
                </button>
              )))}
            </div>
          )}

          {/* Pagination */}
          {tableData.length > ROWS_PER_PAGE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 8px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ background: "none", border: "none", color: page === 0 ? C.textMuted : C.accent, cursor: page === 0 ? "default" : "pointer", fontSize: 13 }}>◀</button>
              <span style={{ fontSize: 11, color: C.textDim }}>صفحة {page + 1} من {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ background: "none", border: "none", color: page >= totalPages - 1 ? C.textMuted : C.accent, cursor: page >= totalPages - 1 ? "default" : "pointer", fontSize: 13 }}>▶</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 16px", borderTop: `1px solid ${C.border}`, background: C.surface, fontSize: 11, color: C.textDim, minHeight: 28 }}>
        <span>{statusMsg}</span>
        <span style={{ marginRight: "auto" }} />
        {tableData.length > 0 && <span>الصفوف: {tableData.length.toLocaleString("ar-SA")}</span>}
        {tableColumns.length > 0 && <span>الأعمدة: {tableColumns.length}</span>}
        {qualityScore > 0 && (
          <span style={{ color: qualityScore >= 70 ? C.green : qualityScore >= 40 ? C.orange : C.red }}>
            الجودة: {qualityScore}%
          </span>
        )}
        <span>الوضع: {mode === "smart" ? "ذكي" : "احترافي"}</span>
        {steps.length > 0 && <span>خطوات: {steps.length}</span>}
      </div>

      {/* Dialogs / Overlays */}
      {renderJoinDialog()}
      {renderContextMenu()}
    </div>
  );
}
