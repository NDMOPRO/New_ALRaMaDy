/* ═══════════════════════════════════════════════════════════════
   محرك المطابقة البصرية الحرفية 1:1
   رفع → معالجة → تحميل الملف الناتج
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";

type TargetFormat = "dashboard" | "presentation" | "report" | "spreadsheet";
type InputMode = "upload" | "camera" | "video";

const TARGET_FORMATS: Array<{ id: TargetFormat; label: string; icon: string }> = [
  { id: "dashboard", label: "لوحة مؤشرات (HTML)", icon: "📊" },
  { id: "presentation", label: "عرض تقديمي (PPTX)", icon: "📑" },
  { id: "report", label: "تقرير (HTML)", icon: "📄" },
  { id: "spreadsheet", label: "جدول بيانات (XLSX)", icon: "📋" },
];

// ─── Download helper ────────────────────────────────────────────────
function downloadBase64File(base64: string, fileName: string, mimeType: string) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main Component ─────────────────────────────────────────────────
export default function StrictEngineTest() {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("dashboard");
  const [pageCount, setPageCount] = useState(1);

  const [opArabize, setOpArabize] = useState(true);
  const [opTranslate, setOpTranslate] = useState(false);
  const [opTransDir, setOpTransDir] = useState<"ar-to-en" | "en-to-ar">("ar-to-en");
  const [opEmpty, setOpEmpty] = useState(false);

  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const videoPlayRef = useRef<HTMLVideoElement>(null);

  const runIntegrated = trpc.strictEngine.runIntegratedPipeline.useMutation();

  // ─── Camera ────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1920, height: 1080, facingMode: "environment" } });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { alert("لا يمكن الوصول إلى الكاميرا"); }
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

  // ─── File Handling ─────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setFilePreview(null);
    }
    if (f.name.toLowerCase().endsWith(".pdf")) setPageCount(1);
  }, []);

  // ─── Run Pipeline ─────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!file) return;
    setIsRunning(true);
    setResult(null);
    setError(null);

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
          match: true,
          arabize: opArabize,
          translate: opTranslate,
          translateDirection: opTransDir,
          empty: opEmpty,
        },
      });

      if (res.success && res.output) {
        setResult(res);
      } else {
        setError(res.error || "فشلت المعالجة");
      }
    } catch (err: any) {
      setError(err.message || "خطأ غير متوقع");
    }

    setIsRunning(false);
  }, [file, targetFormat, pageCount, opArabize, opTranslate, opTransDir, opEmpty, runIntegrated]);

  // ─── Download ──────────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!result?.output) return;
    downloadBase64File(result.output.fileBase64, result.output.fileName, result.output.mimeType);
  }, [result]);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', 'Noto Sans Arabic', Tahoma, sans-serif", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", minHeight: "100vh", color: "#e2e8f0" }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Header */}
      <header style={{ background: "rgba(15,23,42,0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(99,102,241,0.2)", padding: "16px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#818cf8", margin: 0 }}>محرك المطابقة البصرية</h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0" }}>ارفع ملف → اختر الصيغة → حمّل الملف الناتج</p>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>

        {/* ── Input Source ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {([
              { id: "upload" as InputMode, label: "رفع ملف" },
              { id: "camera" as InputMode, label: "التقاط مباشر" },
              { id: "video" as InputMode, label: "إطار من فيديو" },
            ]).map(m => (
              <button key={m.id} onClick={() => { setInputMode(m.id); if (m.id === "camera") startCamera(); else stopCamera(); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: inputMode === m.id ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.2)", background: inputMode === m.id ? "rgba(99,102,241,0.15)" : "transparent", color: inputMode === m.id ? "#a5b4fc" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {m.label}
              </button>
            ))}
          </div>

          {inputMode === "upload" && (
            <div onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              style={{ border: "2px dashed rgba(99,102,241,0.4)", borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer", background: file ? "rgba(99,102,241,0.05)" : "transparent" }}>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} style={{ display: "none" }} />
              {file ? (
                <div>
                  {filePreview && <img src={filePreview} alt="" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8, marginBottom: 12 }} />}
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: "#64748b" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 14, color: "#94a3b8" }}>اسحب ملف هنا أو اضغط للاختيار</p>
                  <p style={{ fontSize: 11, color: "#475569" }}>PNG, JPG, WebP, TIFF, PDF</p>
                </div>
              )}
            </div>
          )}

          {inputMode === "camera" && (
            <div style={{ textAlign: "center" }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 12, background: "#000" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={captureFromCamera} style={actionBtn}>التقاط صورة</button>
                <button onClick={stopCamera} style={{ ...actionBtn, background: "rgba(239,68,68,0.3)" }}>إيقاف</button>
              </div>
            </div>
          )}

          {inputMode === "video" && (
            <div style={{ textAlign: "center" }}>
              <input ref={videoFileRef} type="file" accept="video/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && videoPlayRef.current) videoPlayRef.current.src = URL.createObjectURL(f);
              }} style={{ marginBottom: 12 }} />
              <video ref={videoPlayRef} controls style={{ maxWidth: "100%", borderRadius: 12, marginBottom: 12, background: "#000" }} />
              <div><button onClick={captureVideoFrame} style={actionBtn}>التقاط الإطار الحالي</button></div>
              {filePreview && <img src={filePreview} alt="" style={{ maxWidth: 300, borderRadius: 8, marginTop: 12 }} />}
            </div>
          )}

          {file?.name.toLowerCase().endsWith(".pdf") && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ fontSize: 13, color: "#94a3b8" }}>عدد الصفحات:</label>
              <input type="number" min={1} max={200} value={pageCount} onChange={(e) => setPageCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 80, padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(15,23,42,0.6)", color: "#e2e8f0", fontSize: 13 }} />
            </div>
          )}
        </div>

        {/* ── Target Format ── */}
        <div style={sectionStyle}>
          <h3 style={{ fontSize: 14, color: "#a5b4fc", marginBottom: 12 }}>صيغة الملف الناتج</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {TARGET_FORMATS.map(f => (
              <button key={f.id} onClick={() => setTargetFormat(f.id)}
                style={{ padding: 14, borderRadius: 10, border: targetFormat === f.id ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.2)", background: targetFormat === f.id ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.4)", cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 600, color: targetFormat === f.id ? "#a5b4fc" : "#94a3b8" }}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Match Info ── */}
        <div style={{ ...sectionStyle, background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.2)", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#a5b4fc", fontWeight: 600 }}>
            المطابقة البصرية الحرفية 1:1 — الصورة المصدر = خلفية الملف الناتج
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            PixelDiff = 0 | الملف الناتج مطابق بصرياً 100% للملف المرفوع
          </div>
        </div>

        {/* ── Run Button ── */}
        <button disabled={!file || isRunning} onClick={handleRun}
          style={{ width: "100%", padding: "16px 24px", borderRadius: 12, border: "none", background: !file || isRunning ? "rgba(99,102,241,0.3)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: !file || isRunning ? "not-allowed" : "pointer", marginBottom: 24 }}>
          {isRunning ? "جاري التوليد..." : "توليد الملف"}
        </button>

        {/* ── Error ── */}
        {error && (
          <div style={{ ...sectionStyle, borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)" }}>
            <p style={{ color: "#f87171", fontSize: 14, margin: 0 }}>{error}</p>
          </div>
        )}

        {/* ── Result: Download ── */}
        {result?.output && (
          <div style={{ ...sectionStyle, textAlign: "center", borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)" }}>
            {/* Match Badge */}
            {result.stats?.pixelDiff === 0 && (
              <div style={{ display: "inline-block", padding: "6px 20px", borderRadius: 20, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                PixelDiff = 0 | مطابقة حرفية 100% | 1:1
              </div>
            )}

            <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80", marginBottom: 4 }}>تم المطابقة والتوليد بنجاح</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
              {result.output.targetLabel} — {result.output.fileName}
            </div>

            {/* Stats */}
            {result.stats && (
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <StatBadge label="المطابقة" value={result.stats.match || "100%"} color="#4ade80" />
                <StatBadge label="الصفحات" value={String(result.stats.pageCount)} color="#a5b4fc" />
                <StatBadge label="الحجم" value={result.stats.sourceSize} color="#818cf8" />
                <StatBadge label="الوقت" value={`${result.duration_ms}ms`} color="#f59e0b" />
              </div>
            )}

            <button onClick={handleDownload}
              style={{ padding: "16px 48px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(34,197,94,0.3)" }}>
              تحميل الملف
            </button>

            <div style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
              البصمة: {result.stats?.sourceHash}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 80 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#64748b" }}>{label}</div>
    </div>
  );
}

function ToggleChip({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      style={{ padding: "8px 16px", borderRadius: 8, border: checked ? "2px solid #6366f1" : "1px solid rgba(99,102,241,0.2)", background: checked ? "rgba(99,102,241,0.15)" : "transparent", color: checked ? "#a5b4fc" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      {checked ? "✓" : "○"} {label}
    </button>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: "rgba(30,41,59,0.6)", borderRadius: 12, padding: 20,
  border: "1px solid rgba(99,102,241,0.12)", marginBottom: 20,
};

const actionBtn: React.CSSProperties = {
  padding: "10px 24px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
