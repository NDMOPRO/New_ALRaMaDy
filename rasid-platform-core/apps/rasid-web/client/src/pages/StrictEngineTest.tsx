/* ═══════════════════════════════════════════════════════════════
   محرك المطابقة البصرية الحرفية 1:1 — صفحة المطابقة والتحويل
   STRICT Replication Engine — Upload → Match → Convert
   PixelDiff = 0 | 100% pixel-perfect | No exceptions
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

// ─── Types ─────────────────────────────────────────────────────────────

type TargetFormat = "dashboard" | "presentation" | "report" | "spreadsheet";

interface PipelineStep {
  step: string;
  status: "success" | "failure";
  detail: string;
  duration_ms: number;
}

interface PipelineSummary {
  source: string;
  source_type: string;
  target_format: TargetFormat;
  target_label: string;
  page_count: number;
  total_elements: number;
  element_counts: Record<string, number>;
  pixel_diff: number;
  pixel_match: boolean;
  fingerprints: { engine_fingerprint: string; pixel_hash: string; render_config_hash: string };
  evidence_hash: string;
  fidelity_score: number;
  functional_parity: Record<string, boolean>;
  components: Array<{ id: string; type: string; editable: boolean; data_bound: boolean; interactive: boolean }>;
  interactions: Array<{ type: string; source: string; targets: string[] }>;
}

interface PipelineResult {
  success: boolean;
  summary: PipelineSummary | null;
  steps: PipelineStep[];
  duration_ms: number;
}

interface EngineTestResult {
  results: Array<{ test: string; passed: boolean; detail: string }>;
  duration_ms: number;
}

// ─── Target Format Config ──────────────────────────────────────────────

const TARGET_FORMATS: Array<{ id: TargetFormat; label: string; icon: string; desc: string }> = [
  { id: "dashboard", label: "لوحة مؤشرات حية", icon: "dashboard", desc: "لوحة تفاعلية مع ربط بيانات وتصفية متقاطعة" },
  { id: "presentation", label: "عرض تقديمي", icon: "slideshow", desc: "شرائح قابلة للتحرير — كل صفحة = شريحة" },
  { id: "report", label: "تقرير", icon: "description", desc: "تقرير مهيكل متعدد الصفحات قابل للتحرير" },
  { id: "spreadsheet", label: "جدول بيانات إكسل", icon: "table_chart", desc: "جداول مع معادلات وتنسيق شرطي وإعادة حساب" },
];

// ─── Main Component ────────────────────────────────────────────────────

export default function StrictEngineTest() {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("dashboard");
  const [pageCount, setPageCount] = useState(1);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeEngineTest, setActiveEngineTest] = useState<string | null>(null);
  const [engineTestResult, setEngineTestResult] = useState<EngineTestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const runPipeline = trpc.strictEngine.runFullPipeline.useMutation();
  const testCdr = trpc.strictEngine.testCdr.useMutation();
  const testNormalize = trpc.strictEngine.testNormalize.useMutation();
  const testUnderstand = trpc.strictEngine.testUnderstand.useMutation();
  const testTable2Excel = trpc.strictEngine.testTable2Excel.useMutation();
  const testFarm = trpc.strictEngine.testFarm.useMutation();
  const testPixelDiff = trpc.strictEngine.testPixelDiff.useMutation();
  const testDiagnose = trpc.strictEngine.testDiagnose.useMutation();
  const testTranslate = trpc.strictEngine.testTranslate.useMutation();
  const testArabize = trpc.strictEngine.testArabize.useMutation();
  const testEmpty = trpc.strictEngine.testEmpty.useMutation();
  const testReconstruct = trpc.strictEngine.testReconstruct.useMutation();
  const testEvidence = trpc.strictEngine.testEvidence.useMutation();
  const testGolden = trpc.strictEngine.testGolden.useMutation();

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPipelineResult(null);
    setEngineTestResult(null);

    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }

    // Auto-detect page count for PDF
    if (f.name.toLowerCase().endsWith(".pdf")) {
      setPageCount(1); // Default, user can change
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setPipelineResult(null);
      setEngineTestResult(null);
      if (f.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreview(ev.target?.result as string);
        reader.readAsDataURL(f);
      } else {
        setFilePreview(null);
      }
    }
  }, []);

  const handleRunPipeline = useCallback(async () => {
    if (!file) return;
    setIsRunning(true);
    setPipelineResult(null);
    setEngineTestResult(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] || result);
        };
        reader.readAsDataURL(file);
      });

      const fileType = file.type.startsWith("image/") ? "image" as const : "pdf" as const;
      const result = await runPipeline.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        fileType,
        targetFormat,
        pageCount,
      });

      setPipelineResult(result);
    } catch (err: any) {
      setPipelineResult({
        success: false,
        summary: null,
        steps: [{ step: "خطأ", status: "failure", detail: err.message, duration_ms: 0 }],
        duration_ms: 0,
      });
    }

    setIsRunning(false);
  }, [file, targetFormat, pageCount, runPipeline]);

  const handleEngineTest = useCallback(async (engineId: string) => {
    setActiveEngineTest(engineId);
    setEngineTestResult(null);
    setIsRunning(true);

    try {
      const mutations: Record<string, any> = {
        cdr: testCdr, normalize: testNormalize, understand: testUnderstand,
        table2excel: testTable2Excel, farm: testFarm, pixeldiff: testPixelDiff,
        diagnose: testDiagnose, translate: testTranslate, arabize: testArabize,
        empty: testEmpty, reconstruct: testReconstruct, evidence: testEvidence,
        golden: testGolden,
      };
      const mutation = mutations[engineId];
      if (mutation) {
        const result = await mutation.mutateAsync(engineId === "translate" ? { text: "تقرير الأداء المالي" } : undefined);
        setEngineTestResult(result);
      }
    } catch (err: any) {
      setEngineTestResult({ results: [{ test: "خطأ", passed: false, detail: err.message }], duration_ms: 0 });
    }

    setIsRunning(false);
  }, [testCdr, testNormalize, testUnderstand, testTable2Excel, testFarm, testPixelDiff, testDiagnose, testTranslate, testArabize, testEmpty, testReconstruct, testEvidence, testGolden]);

  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', 'Noto Sans Arabic', Tahoma, sans-serif", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", minHeight: "100vh", color: "#e2e8f0" }}>
      {/* Header */}
      <header style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#818cf8", margin: 0 }}>
            محرك المطابقة البصرية الحرفية 1:1
          </h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
            STRICT Replication Engine — PixelDiff = 0 | رفع → مطابقة → تحويل
          </p>
        </div>
        {pipelineResult && (
          <div style={{ display: "flex", gap: 8 }}>
            <Badge label={pipelineResult.success ? "نجح" : "فشل"} color={pipelineResult.success ? "#22c55e" : "#ef4444"} />
            <Badge label={`${pipelineResult.duration_ms}ms`} color="#6366f1" />
            {pipelineResult.summary && <Badge label={`PixelDiff=${pipelineResult.summary.pixel_diff}`} color={pipelineResult.summary.pixel_diff === 0 ? "#22c55e" : "#ef4444"} />}
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        {/* ─── Upload Section ─── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>
            1. رفع الملف المصدر
          </h2>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: "2px dashed rgba(99,102,241,0.4)", borderRadius: 12, padding: 40,
              textAlign: "center", cursor: "pointer", transition: "all 0.2s",
              background: file ? "rgba(99,102,241,0.05)" : "transparent",
            }}
          >
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} style={{ display: "none" }} />
            {file ? (
              <div>
                {filePreview && <img src={filePreview} alt="preview" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8, marginBottom: 12 }} />}
                <p style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{file.name}</p>
                <p style={{ fontSize: 12, color: "#64748b" }}>{(file.size / 1024 / 1024).toFixed(2)} MB — {file.type || "PDF"}</p>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: 48, display: "block", marginBottom: 8, opacity: 0.5 }}>cloud_upload</span>
                <p style={{ fontSize: 14, color: "#94a3b8" }}>اسحب ملف صورة أو PDF هنا — أو اضغط للاختيار</p>
                <p style={{ fontSize: 11, color: "#475569" }}>يدعم: PNG, JPG, WebP, TIFF, PDF</p>
              </div>
            )}
          </div>

          {file?.name.toLowerCase().endsWith(".pdf") && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 13, color: "#94a3b8" }}>عدد الصفحات:</label>
              <input type="number" min={1} max={200} value={pageCount} onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(15,23,42,0.6)", color: "#e2e8f0", fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: "#475569" }}>كل صفحة ستصبح شريحة/قسم قابل للتحرير</span>
            </div>
          )}
        </div>

        {/* ─── Target Format Section ─── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>
            2. اختر صيغة الهدف
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {TARGET_FORMATS.map((fmt) => (
              <button key={fmt.id} onClick={() => setTargetFormat(fmt.id)}
                style={{
                  padding: 16, borderRadius: 10, border: targetFormat === fmt.id ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.2)",
                  background: targetFormat === fmt.id ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.4)",
                  cursor: "pointer", textAlign: "right", transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 24, color: targetFormat === fmt.id ? "#818cf8" : "#64748b" }}>{fmt.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: targetFormat === fmt.id ? "#a5b4fc" : "#94a3b8" }}>{fmt.label}</span>
                </div>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{fmt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ─── Run Button ─── */}
        <button
          disabled={!file || isRunning}
          onClick={handleRunPipeline}
          style={{
            width: "100%", padding: "14px 24px", borderRadius: 10, border: "none",
            background: !file || isRunning ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontSize: 16, fontWeight: 700, cursor: !file || isRunning ? "not-allowed" : "pointer",
            marginBottom: 24, transition: "all 0.2s",
          }}
        >
          {isRunning ? "جاري المعالجة..." : "3. ابدأ المطابقة الحرفية 1:1"}
        </button>

        {/* ─── Pipeline Results ─── */}
        {pipelineResult && (
          <div style={{ ...card, marginBottom: 24, borderColor: pipelineResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: pipelineResult.success ? "#22c55e" : "#ef4444", marginBottom: 16 }}>
              {pipelineResult.success ? "المطابقة الحرفية ناجحة — PixelDiff = 0" : "المطابقة تحتاج مراجعة"}
            </h2>

            {/* Summary Cards */}
            {pipelineResult.summary && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                <SummaryCard title="المصدر" value={pipelineResult.summary.source} sub={pipelineResult.summary.source_type} />
                <SummaryCard title="الهدف" value={pipelineResult.summary.target_label} sub={`${pipelineResult.summary.page_count} صفحة`} />
                <SummaryCard title="PixelDiff" value={String(pipelineResult.summary.pixel_diff)} sub={pipelineResult.summary.pixel_match ? "مطابقة 100%" : "يوجد فرق"} color={pipelineResult.summary.pixel_diff === 0 ? "#22c55e" : "#ef4444"} />
                <SummaryCard title="العناصر" value={String(pipelineResult.summary.total_elements)} sub={Object.entries(pipelineResult.summary.element_counts).map(([k, v]) => `${k}: ${v}`).join(" | ")} />
                <SummaryCard title="الدقة" value={`${(pipelineResult.summary.fidelity_score * 100).toFixed(0)}%`} sub="fidelity score" color="#818cf8" />
                <SummaryCard title="المكونات" value={String(pipelineResult.summary.components.length)} sub={`${pipelineResult.summary.interactions.length} تفاعل`} />
              </div>
            )}

            {/* Components Detail */}
            {pipelineResult.summary && pipelineResult.summary.components.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>المكونات المُعاد بناؤها:</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {pipelineResult.summary.components.map((c, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                      {c.type} — {c.editable ? "قابل للتحرير" : ""} {c.data_bound ? "| مرتبط" : ""} {c.interactive ? "| تفاعلي" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Functional Parity */}
            {pipelineResult.summary && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>التكافؤ الوظيفي:</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(pipelineResult.summary.functional_parity).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: v ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${v ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: v ? "#22c55e" : "#ef4444" }}>
                      {v ? "+" : "-"} {k}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fingerprints */}
            {pipelineResult.summary && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>البصمات الحتمية:</h3>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", background: "rgba(15,23,42,0.6)", padding: 10, borderRadius: 6, lineHeight: 1.8 }}>
                  <div>engine: {pipelineResult.summary.fingerprints.engine_fingerprint}</div>
                  <div>pixel: {pipelineResult.summary.fingerprints.pixel_hash}</div>
                  <div>config: {pipelineResult.summary.fingerprints.render_config_hash}</div>
                  <div>evidence: {pipelineResult.summary.evidence_hash}</div>
                </div>
              </div>
            )}

            {/* Pipeline Steps */}
            <h3 style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>خطوات المعالجة:</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pipelineResult.steps.map((step, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderRadius: 6,
                  background: step.status === "success" ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                  border: `1px solid ${step.status === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 14 }}>{step.status === "success" ? "+" : "x"}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: step.status === "success" ? "#4ade80" : "#f87171" }}>{step.step}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{step.detail}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#475569" }}>{step.duration_ms}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Individual Engine Tests ─── */}
        <div style={{ ...card }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#a5b4fc", marginBottom: 16 }}>
            اختبار المحركات الفردية (حقيقي)
          </h2>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            كل زر يستدعي المحرك الفعلي على الخادم ويعيد نتائج حقيقية
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {[
              { id: "cdr", label: "CDR Schema" },
              { id: "normalize", label: "تطبيع الصور" },
              { id: "understand", label: "فهم الصور" },
              { id: "table2excel", label: "جدول → إكسل" },
              { id: "farm", label: "المزرعة الحتمية" },
              { id: "pixeldiff", label: "PixelDiff" },
              { id: "diagnose", label: "تشخيص وإصلاح" },
              { id: "translate", label: "ترجمة" },
              { id: "arabize", label: "تعريب" },
              { id: "empty", label: "تفريغ" },
              { id: "reconstruct", label: "إعادة بناء" },
              { id: "evidence", label: "حزمة إثبات" },
              { id: "golden", label: "مرجع ذهبي" },
            ].map((eng) => (
              <button key={eng.id}
                disabled={isRunning}
                onClick={() => handleEngineTest(eng.id)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: activeEngineTest === eng.id ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(99,102,241,0.15)",
                  color: activeEngineTest === eng.id ? "#fff" : "#a5b4fc",
                  fontSize: 12, fontWeight: 600, cursor: isRunning ? "not-allowed" : "pointer",
                }}
              >
                {eng.label}
              </button>
            ))}
          </div>

          {/* Engine Test Results */}
          {engineTestResult && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ fontSize: 13, color: "#94a3b8" }}>نتائج الاختبار الفعلي:</h3>
                <span style={{ fontSize: 11, color: "#475569" }}>{engineTestResult.duration_ms}ms</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {engineTestResult.results.map((r, idx) => (
                  <div key={idx} style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    padding: "8px 12px", borderRadius: 6,
                    background: r.passed ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                    border: `1px solid ${r.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                  }}>
                    <span style={{ fontSize: 12, marginTop: 2, color: r.passed ? "#4ade80" : "#f87171" }}>
                      {r.passed ? "+" : "x"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: r.passed ? "#4ade80" : "#f87171" }}>{r.test}</div>
                      <div style={{ fontSize: 11, color: "#64748b", wordBreak: "break-all" }}>{r.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

function SummaryCard({ title, value, sub, color }: { title: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 12, border: "1px solid rgba(99,102,241,0.1)" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || "#e2e8f0", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "rgba(30,41,59,0.6)",
  borderRadius: 12,
  padding: 20,
  border: "1px solid rgba(99,102,241,0.15)",
};
