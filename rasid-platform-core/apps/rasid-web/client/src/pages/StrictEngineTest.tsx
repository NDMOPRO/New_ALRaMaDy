/* ═══════════════════════════════════════════════════════════════
   محرك المطابقة البصرية الحرفية 1:1
   رفع → مطابقة → تعريب → ترجمة → تفريغ — بضغطة زر واحدة
   PixelDiff = 0 | 100% | لا استثناءات
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";

// ─── Types ─────────────────────────────────────────────────────────────

type TargetFormat = "dashboard" | "presentation" | "report" | "spreadsheet";
type InputMode = "upload" | "camera" | "video";

interface PipelineStep {
  step: string;
  status: "success" | "failure";
  detail: string;
  duration_ms: number;
}

// ─── Target Formats ────────────────────────────────────────────────────

const TARGET_FORMATS: Array<{ id: TargetFormat; label: string; desc: string }> = [
  { id: "dashboard", label: "لوحة مؤشرات حية", desc: "تفاعلية مع ربط بيانات وتصفية" },
  { id: "presentation", label: "عرض تقديمي (PPTX)", desc: "شرائح قابلة للتحرير — ليست صور" },
  { id: "report", label: "تقرير (DOCX)", desc: "مهيكل متعدد الصفحات" },
  { id: "spreadsheet", label: "جدول بيانات (XLSX)", desc: "معادلات + تنسيق شرطي" },
];

// ─── Main Component ────────────────────────────────────────────────────

export default function StrictEngineTest() {
  // Input state
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("dashboard");
  const [pageCount, setPageCount] = useState(1);

  // Operations
  const [opMatch, setOpMatch] = useState(true);
  const [opArabize, setOpArabize] = useState(true);
  const [opTranslate, setOpTranslate] = useState(true);
  const [opTransDir, setOpTransDir] = useState<"ar-to-en" | "en-to-ar">("ar-to-en");
  const [opEmpty, setOpEmpty] = useState(true);

  // Results
  const [result, setResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  // Camera
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Engine tests
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // tRPC
  const runIntegrated = trpc.strictEngine.runIntegratedPipeline.useMutation();
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

  // ─── Camera ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080, facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      alert("لا يمكن الوصول إلى الكاميرا");
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop());
    setCameraStream(null);
  }, [cameraStream]);

  const captureFromCamera = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const f = new File([blob], `capture-${Date.now()}.png`, { type: "image/png" });
        setFile(f);
        setFilePreview(canvas.toDataURL());
        stopCamera();
        setInputMode("upload");
      }
    }, "image/png");
  }, [stopCamera]);

  // ─── Video Frame Capture ─────────────────────────────────────────
  const videoFileRef = useRef<HTMLInputElement>(null);
  const videoPlayRef = useRef<HTMLVideoElement>(null);

  const captureVideoFrame = useCallback(() => {
    if (!videoPlayRef.current || !canvasRef.current) return;
    const v = videoPlayRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 1920;
    c.height = v.videoHeight || 1080;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((blob) => {
      if (blob) {
        const f = new File([blob], `video-frame-${Date.now()}.png`, { type: "image/png" });
        setFile(f);
        setFilePreview(c.toDataURL());
      }
    }, "image/png");
  }, []);

  useEffect(() => { return () => { cameraStream?.getTracks().forEach(t => t.stop()); }; }, [cameraStream]);

  // ─── File Handling ───────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setTestResult(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
    if (f.name.toLowerCase().endsWith(".pdf")) setPageCount(1);
  }, []);

  // ─── Run Integrated Pipeline ─────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!file) return;
    setIsRunning(true);
    setResult(null);

    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
        reader.readAsDataURL(file);
      });

      const res = await runIntegrated.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        fileType: file.type.startsWith("image/") ? "image" : file.name.endsWith(".pdf") ? "pdf" : "video_frame",
        targetFormat,
        pageCount,
        operations: {
          match: opMatch,
          arabize: opArabize,
          translate: opTranslate,
          translateDirection: opTransDir,
          empty: opEmpty,
        },
      });
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, steps: [{ step: "خطأ", status: "failure", detail: err.message, duration_ms: 0 }], duration_ms: 0 });
    }

    setIsRunning(false);
  }, [file, targetFormat, pageCount, opMatch, opArabize, opTranslate, opTransDir, opEmpty, runIntegrated]);

  // ─── Engine Test ─────────────────────────────────────────────────
  const handleEngineTest = useCallback(async (id: string) => {
    setActiveTest(id);
    setTestResult(null);
    setIsRunning(true);
    try {
      const m: Record<string, any> = { cdr: testCdr, normalize: testNormalize, understand: testUnderstand, table2excel: testTable2Excel, farm: testFarm, pixeldiff: testPixelDiff, diagnose: testDiagnose, translate: testTranslate, arabize: testArabize, empty: testEmpty, reconstruct: testReconstruct, evidence: testEvidence, golden: testGolden };
      const res = await m[id]?.mutateAsync(id === "translate" ? { text: "تقرير الأداء المالي" } : undefined);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ results: [{ test: "خطأ", passed: false, detail: err.message }], duration_ms: 0 });
    }
    setIsRunning(false);
  }, [testCdr, testNormalize, testUnderstand, testTable2Excel, testFarm, testPixelDiff, testDiagnose, testTranslate, testArabize, testEmpty, testReconstruct, testEvidence, testGolden]);

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', 'Noto Sans Arabic', Tahoma, sans-serif", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", minHeight: "100vh", color: "#e2e8f0" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Header */}
      <header style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#818cf8", margin: 0 }}>محرك المطابقة البصرية الحرفية 1:1</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>رفع → مطابقة → تعريب → ترجمة → تفريغ — بضغطة واحدة</p>
        </div>
        {result && (
          <div style={{ display: "flex", gap: 8 }}>
            <Badge label={result.success ? "نجح" : "فشل"} color={result.success ? "#22c55e" : "#ef4444"} />
            <Badge label={`${result.duration_ms}ms`} color="#6366f1" />
            {result.summary && <Badge label={`PixelDiff=${result.summary.pixel_diff}`} color={result.summary.pixel_diff === 0 ? "#22c55e" : "#ef4444"} />}
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>

        {/* ── 1. Input Source ── */}
        <Section title="1. مصدر الإدخال">
          {/* Mode Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([
              { id: "upload" as InputMode, label: "رفع ملف", icon: "upload_file" },
              { id: "camera" as InputMode, label: "التقاط مباشر", icon: "photo_camera" },
              { id: "video" as InputMode, label: "إطار من فيديو", icon: "videocam" },
            ]).map(m => (
              <button key={m.id} onClick={() => { setInputMode(m.id); if (m.id === "camera") startCamera(); else stopCamera(); }}
                style={{ ...tabBtn, background: inputMode === m.id ? "rgba(99,102,241,0.2)" : "transparent", color: inputMode === m.id ? "#a5b4fc" : "#64748b", borderColor: inputMode === m.id ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.1)" }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>

          {/* Upload Mode */}
          {inputMode === "upload" && (
            <div onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              style={{ border: "2px dashed rgba(99,102,241,0.4)", borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer", background: file ? "rgba(99,102,241,0.05)" : "transparent" }}>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />
              {file ? (
                <div>
                  {filePreview && <img src={filePreview} alt="" style={{ maxWidth: 400, maxHeight: 250, borderRadius: 8, marginBottom: 12 }} />}
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: "#64748b" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 14, color: "#94a3b8" }}>اسحب ملف صورة أو PDF هنا — أو اضغط للاختيار</p>
                  <p style={{ fontSize: 11, color: "#475569" }}>PNG, JPG, WebP, TIFF, PDF (حتى 200 صفحة)</p>
                </div>
              )}
            </div>
          )}

          {/* Camera Mode */}
          {inputMode === "camera" && (
            <div style={{ textAlign: "center" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 12, background: "#000" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={captureFromCamera} style={primaryBtn}>التقاط صورة</button>
                <button onClick={stopCamera} style={{ ...primaryBtn, background: "rgba(239,68,68,0.3)" }}>إيقاف الكاميرا</button>
              </div>
            </div>
          )}

          {/* Video Mode */}
          {inputMode === "video" && (
            <div style={{ textAlign: "center" }}>
              <input ref={videoFileRef} type="file" accept="video/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && videoPlayRef.current) {
                  videoPlayRef.current.src = URL.createObjectURL(f);
                }
              }} style={{ marginBottom: 12 }} />
              <video ref={videoPlayRef} controls style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 12, background: "#000" }} />
              <div><button onClick={captureVideoFrame} style={primaryBtn}>التقاط الإطار الحالي</button></div>
              {filePreview && <img src={filePreview} alt="" style={{ maxWidth: 300, borderRadius: 8, marginTop: 12 }} />}
            </div>
          )}

          {/* Page count for PDF */}
          {file?.name.toLowerCase().endsWith(".pdf") && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 13, color: "#94a3b8" }}>عدد الصفحات:</label>
              <input type="number" min={1} max={200} value={pageCount} onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(15,23,42,0.6)", color: "#e2e8f0", fontSize: 13 }} />
              <span style={{ fontSize: 11, color: "#475569" }}>كل صفحة ← شريحة/قسم قابل للتحرير (ليست صورة)</span>
            </div>
          )}
        </Section>

        {/* ── 2. Target Format ── */}
        <Section title="2. صيغة الهدف">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {TARGET_FORMATS.map(f => (
              <button key={f.id} onClick={() => setTargetFormat(f.id)}
                style={{ padding: 14, borderRadius: 10, border: targetFormat === f.id ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.2)", background: targetFormat === f.id ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.4)", cursor: "pointer", textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: targetFormat === f.id ? "#a5b4fc" : "#94a3b8" }}>{f.label}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{f.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* ── 3. Operations ── */}
        <Section title="3. العمليات">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Toggle label="المطابقة الحرفية 1:1" checked={opMatch} onChange={setOpMatch} desc="PixelDiff = 0" />
            <Toggle label="التعريب الاحترافي" checked={opArabize} onChange={setOpArabize} desc="أرقام + تواريخ هجرية + عملات + خطوط + كشيدة + عكس تخطيط" />
            <Toggle label="الترجمة" checked={opTranslate} onChange={setOpTranslate} desc="مع ذاكرة ترجمة ومصطلحات" />
            <Toggle label="التفريغ" checked={opEmpty} onChange={setOpEmpty} desc="استخراج كل المحتوى لبيان هيكلي" />
          </div>

          {opTranslate && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button onClick={() => setOpTransDir("ar-to-en")} style={{ ...tabBtn, background: opTransDir === "ar-to-en" ? "rgba(99,102,241,0.2)" : "transparent", color: opTransDir === "ar-to-en" ? "#a5b4fc" : "#64748b" }}>عربي ← إنجليزي</button>
              <button onClick={() => setOpTransDir("en-to-ar")} style={{ ...tabBtn, background: opTransDir === "en-to-ar" ? "rgba(99,102,241,0.2)" : "transparent", color: opTransDir === "en-to-ar" ? "#a5b4fc" : "#64748b" }}>إنجليزي ← عربي</button>
            </div>
          )}
        </Section>

        {/* ── Run Button ── */}
        <button disabled={!file || isRunning} onClick={handleRun}
          style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: !file || isRunning ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: !file || isRunning ? "not-allowed" : "pointer", marginBottom: 24 }}>
          {isRunning ? "جاري المعالجة..." : "ابدأ المعالجة المتكاملة"}
        </button>

        {/* ── Results ── */}
        {result && (
          <>
            {/* Summary */}
            <Section title={result.success ? "النتيجة: نجاح — مطابقة حرفية 100%" : "النتيجة: يحتاج مراجعة"} color={result.success ? "#22c55e" : "#ef4444"}>
              {result.summary && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
                  <Card title="المصدر" value={result.summary.source} sub={result.summary.source_type} />
                  <Card title="الهدف" value={result.summary.target_label} sub={`${result.summary.page_count} صفحة قابلة للتحرير`} />
                  <Card title="PixelDiff" value={String(result.summary.pixel_diff)} sub={result.summary.pixel_match ? "مطابقة 100%" : "فرق"} color={result.summary.pixel_diff === 0 ? "#22c55e" : "#ef4444"} />
                  <Card title="الدقة" value={`${(result.summary.fidelity_score * 100).toFixed(0)}%`} sub="fidelity" color="#818cf8" />
                  <Card title="المكونات" value={String(result.summary.components.length)} sub={`${result.summary.interactions.length} تفاعل`} />
                  <Card title="الوقت" value={`${result.duration_ms}ms`} sub="إجمالي المعالجة" />
                </div>
              )}

              {/* Components */}
              {result.summary?.components?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>المكونات (قابلة للتحرير — ليست صور):</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.summary.components.map((c: any, i: number) => (
                      <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                        {c.type}{c.editable ? " [تحرير]" : ""}{c.data_bound ? " [بيانات]" : ""}{c.interactive ? " [تفاعل]" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Functional Parity */}
              {result.summary?.functional_parity && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>التكافؤ الوظيفي:</h4>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(result.summary.functional_parity).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: v ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${v ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, color: v ? "#4ade80" : "#f87171" }}>
                        {v ? "+" : "-"} {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Emptying Results */}
            {result.emptying && (
              <Section title="نتائج التفريغ">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
                  <Card title="إجمالي" value={String(result.emptying.total)} sub="عنصر" />
                  <Card title="نصوص" value={String(result.emptying.texts)} sub="" />
                  <Card title="جداول" value={String(result.emptying.tables)} sub="" />
                  <Card title="رسوم" value={String(result.emptying.charts)} sub="" />
                  <Card title="مؤشرات" value={String(result.emptying.kpis)} sub="KPI" />
                </div>
                {result.emptying.entries?.length > 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", background: "rgba(15,23,42,0.5)", borderRadius: 6, padding: 10, maxHeight: 200, overflowY: "auto" }}>
                    {result.emptying.entries.map((e: any, i: number) => (
                      <div key={i} style={{ marginBottom: 4 }}><span style={{ color: "#818cf8" }}>[{e.type}]</span> {e.content}</div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Translation Results */}
            {result.translation && (
              <Section title="نتائج الترجمة">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
                  <Card title="مترجم" value={`${result.translation.translated}/${result.translation.total}`} sub="عنصر" />
                  <Card title="الجودة" value={result.translation.quality.toFixed(2)} sub="" color="#818cf8" />
                  <Card title="التناسق" value={result.translation.termConsistency.toFixed(2)} sub="مصطلحات" />
                  <Card title="TM" value={String(result.translation.tmHits)} sub="تطابق" />
                </div>
                {result.translation.samples?.length > 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", background: "rgba(15,23,42,0.5)", borderRadius: 6, padding: 10, maxHeight: 200, overflowY: "auto" }}>
                    {result.translation.samples.map((s: any, i: number) => (
                      <div key={i} style={{ marginBottom: 6, borderBottom: "1px solid rgba(99,102,241,0.1)", paddingBottom: 4 }}>
                        <div><span style={{ color: "#f87171" }}>مصدر:</span> {s.source}</div>
                        <div><span style={{ color: "#4ade80" }}>هدف:</span> {s.target}</div>
                        <div><span style={{ color: "#818cf8" }}>جودة: {s.quality?.toFixed(2)}</span></div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Arabization Results */}
            {result.arabization && (
              <Section title="نتائج التعريب الاحترافي">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
                  <Card title="عناصر" value={String(result.arabization.elementsProcessed)} sub="معالجة" />
                  <Card title="عكس تخطيط" value={String(result.arabization.layoutsMirrored)} sub="" />
                  <Card title="أرقام" value={String(result.arabization.numbersConverted)} sub="محولة" />
                  <Card title="تواريخ هجرية" value={String(result.arabization.datesConverted)} sub="" />
                  <Card title="خطوط" value={String(result.arabization.fontsSubstituted)} sub="مستبدلة" />
                </div>
                {result.arabization.changes?.length > 0 && (
                  <div style={{ fontSize: 11, color: "#64748b", background: "rgba(15,23,42,0.5)", borderRadius: 6, padding: 10, maxHeight: 200, overflowY: "auto" }}>
                    {result.arabization.changes.map((c: any, i: number) => (
                      <div key={i} style={{ marginBottom: 4 }}>
                        <span style={{ color: "#818cf8" }}>[{c.type}]</span> <span style={{ color: "#f87171" }}>{c.before}</span> ← <span style={{ color: "#4ade80" }}>{c.after}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Pipeline Steps */}
            <Section title="خطوات المعالجة">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {result.steps?.map((s: PipelineStep, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: s.status === "success" ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)", border: `1px solid ${s.status === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}` }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.status === "success" ? "#4ade80" : "#f87171" }}>{s.status === "success" ? "+" : "x"} {s.step}</span>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{s.detail}</div>
                    </div>
                    <span style={{ fontSize: 10, color: "#475569" }}>{s.duration_ms}ms</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* Fingerprints */}
            {result.summary?.fingerprints && (
              <Section title="البصمات الحتمية">
                <div style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", background: "rgba(15,23,42,0.6)", padding: 10, borderRadius: 6, lineHeight: 1.8, wordBreak: "break-all" }}>
                  <div>engine: {result.summary.fingerprints.engine_fingerprint}</div>
                  <div>pixel: {result.summary.fingerprints.pixel_hash}</div>
                  <div>config: {result.summary.fingerprints.render_config_hash}</div>
                  {result.summary.evidence_hash && <div>evidence: {result.summary.evidence_hash}</div>}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ── Individual Engine Tests ── */}
        <Section title="اختبار المحركات الفردية">
          <p style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>كل زر يستدعي المحرك الحقيقي ويعيد نتائج فعلية من الخادم</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {[
              { id: "cdr", l: "CDR" }, { id: "normalize", l: "تطبيع" }, { id: "understand", l: "فهم" },
              { id: "table2excel", l: "جدول→إكسل" }, { id: "farm", l: "مزرعة" }, { id: "pixeldiff", l: "PixelDiff" },
              { id: "diagnose", l: "تشخيص" }, { id: "translate", l: "ترجمة" }, { id: "arabize", l: "تعريب" },
              { id: "empty", l: "تفريغ" }, { id: "reconstruct", l: "إعادة بناء" }, { id: "evidence", l: "إثبات" },
              { id: "golden", l: "ذهبي+CI" },
            ].map(e => (
              <button key={e.id} disabled={isRunning} onClick={() => handleEngineTest(e.id)}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 600, cursor: isRunning ? "not-allowed" : "pointer", background: activeTest === e.id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,0.12)", color: activeTest === e.id ? "#fff" : "#a5b4fc" }}>
                {e.l}
              </button>
            ))}
          </div>

          {testResult?.results && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{testResult.duration_ms}ms</div>
              {testResult.results.map((r: any, i: number) => (
                <div key={i} style={{ padding: "6px 10px", borderRadius: 6, background: r.passed ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)", border: `1px solid ${r.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: r.passed ? "#4ade80" : "#f87171" }}>{r.passed ? "+" : "x"} {r.test}</div>
                  <div style={{ fontSize: 10, color: "#64748b", wordBreak: "break-all" }}>{r.detail}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, background: `${color}22`, color, border: `1px solid ${color}44` }}>{label}</span>;
}

function Card({ title, value, sub, color }: { title: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "rgba(15,23,42,0.6)", borderRadius: 8, padding: 10, border: "1px solid rgba(99,102,241,0.08)" }}>
      <div style={{ fontSize: 10, color: "#64748b" }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || "#e2e8f0", lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 12, padding: 20, border: "1px solid rgba(99,102,241,0.12)", marginBottom: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: color || "#a5b4fc", marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange, desc }: { label: string; checked: boolean; onChange: (v: boolean) => void; desc: string }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 8, border: checked ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.15)", background: checked ? "rgba(99,102,241,0.1)" : "transparent", cursor: "pointer", textAlign: "right", minWidth: 200 }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? "#6366f1" : "#334155", position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, transition: "all 0.2s", ...(checked ? { right: 2 } : { right: 18 }) }} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: checked ? "#e2e8f0" : "#94a3b8" }}>{label}</div>
        <div style={{ fontSize: 10, color: "#64748b" }}>{desc}</div>
      </div>
    </button>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────

const primaryBtn: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const tabBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, padding: "8px 16px",
  borderRadius: 8, border: "1px solid", fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: "transparent",
};
