/* ═══════════════════════════════════════════════════════════════
   صفحة اختبار شاملة لكل التنفيذات — Platform Implementation Test
   تختبر كل الـ tRPC APIs والمحركات المنفذة فعلياً
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

/* ─── Types ─── */
interface TestResult {
  name: string;
  status: "pending" | "running" | "pass" | "fail" | "skip";
  duration?: number;
  response?: unknown;
  error?: string;
}

interface TestSection {
  id: string;
  title: string;
  icon: string;
  tests: TestResult[];
}

/* ─── Styles ─── */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh", background: "#0a0a0f", color: "#e4e4e7",
  fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl",
};
const headerStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  padding: "32px 24px", borderBottom: "1px solid #1e293b",
};
const gridStyle: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
  gap: 16, padding: 24, maxWidth: 1600, margin: "0 auto",
};
const cardStyle: React.CSSProperties = {
  background: "#111118", borderRadius: 12, border: "1px solid #1e293b",
  overflow: "hidden",
};
const cardHeaderStyle: React.CSSProperties = {
  padding: "14px 18px", borderBottom: "1px solid #1e293b",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "#0d0d14",
};
const testRowStyle: React.CSSProperties = {
  padding: "8px 18px", display: "flex", alignItems: "center",
  justifyContent: "space-between", borderBottom: "1px solid #0f0f18",
  fontSize: 13,
};
const btnStyle: React.CSSProperties = {
  padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
  fontSize: 12, fontWeight: 600, color: "#fff",
};
const statusColors = {
  pending: "#6b7280", running: "#f59e0b", pass: "#10b981", fail: "#ef4444", skip: "#8b5cf6",
};
const statusLabels = {
  pending: "بانتظار", running: "جاري...", pass: "ناجح", fail: "فشل", skip: "تخطي",
};

/* ─── Component ─── */
export default function ImplementationTest() {
  const utils = trpc.useUtils();

  /* ── tRPC hooks (queries — disabled by default) ── */
  const aiStatus = trpc.ai.status.useQuery(undefined, { enabled: false, retry: false });
  const filesList = trpc.files.list.useQuery(undefined, { enabled: false, retry: false });
  const reportsList = trpc.reports.list.useQuery(undefined, { enabled: false, retry: false });
  const presList = trpc.presentations.list.useQuery(undefined, { enabled: false, retry: false });
  const dashList = trpc.dashboards.list.useQuery(undefined, { enabled: false, retry: false });
  const spreadList = trpc.spreadsheets.list.useQuery(undefined, { enabled: false, retry: false });
  const extractList = trpc.extractions.list.useQuery(undefined, { enabled: false, retry: false });
  const transList = trpc.translations.list.useQuery(undefined, { enabled: false, retry: false });
  const libraryItems = trpc.library.items.useQuery(undefined, { enabled: false, retry: false });
  const adminUsers = trpc.admin.users.useQuery(undefined, { enabled: false, retry: false });
  const adminStats = trpc.admin.stats.useQuery(undefined, { enabled: false, retry: false });
  const healthCheck = trpc.platform.health.check.useQuery(undefined, { enabled: false, retry: false });
  const slideStats = trpc.slideLibrary.getStats.useQuery(undefined, { enabled: false, retry: false });
  const slideCats = trpc.slideLibrary.getCategories.useQuery(undefined, { enabled: false, retry: false });
  const authMe = trpc.auth.me.useQuery(undefined, { enabled: false, retry: false });
  const transcriptionJobs = trpc.transcription.listJobs.useQuery(undefined, { enabled: false, retry: false });
  const presTemplates = trpc.presentations.templates.useQuery(undefined, { enabled: false, retry: false });
  const dashTemplates = trpc.dashboards.templates.useQuery(undefined, { enabled: false, retry: false });
  const govState = trpc.platform.governance.state.useQuery(undefined, { enabled: false, retry: false });
  const govRoles = trpc.platform.governance.roles.useQuery(undefined, { enabled: false, retry: false });
  const govPolicies = trpc.platform.governance.policies.useQuery(undefined, { enabled: false, retry: false });
  const govAudit = trpc.platform.governance.audit.useQuery(undefined, { enabled: false, retry: false });
  const govKpis = trpc.platform.governance.kpis.useQuery(undefined, { enabled: false, retry: false });
  const govCompliance = trpc.platform.governance.compliance.useQuery(undefined, { enabled: false, retry: false });
  const govPermissions = trpc.platform.governance.permissions.useQuery(undefined, { enabled: false, retry: false });
  const govSecurity = trpc.platform.governance.security.useQuery(undefined, { enabled: false, retry: false });
  const platDataList = trpc.platform.data.list.useQuery(undefined, { enabled: false, retry: false });
  const platTransJobs = trpc.platform.transcription.listJobs.useQuery(undefined, { enabled: false, retry: false });
  const agentStatus = trpc.aiAgent.status.useQuery(undefined, { enabled: false, retry: false });
  const agentHealth = trpc.aiAgent.engineHealth.useQuery(undefined, { enabled: false, retry: false });

  /* ── tRPC mutations ── */
  const aiChat = trpc.ai.chat.useMutation();
  const aiGenSlides = trpc.ai.generateSlides.useMutation();
  const aiGenReport = trpc.ai.generateReport.useMutation();
  const aiTextOp = trpc.ai.textOperation.useMutation();
  const aiAnalyzeExcel = trpc.ai.analyzeExcelData.useMutation();
  const aiGenDashWidgets = trpc.ai.generateDashboardWidgets.useMutation();
  const aiGenReportSections = trpc.ai.generateReportSections.useMutation();
  const loginMut = trpc.auth.login.useMutation();
  const registerMut = trpc.auth.register.useMutation();
  const createFile = trpc.files.create.useMutation();
  const createReport = trpc.reports.create.useMutation();
  const createPres = trpc.presentations.create.useMutation();
  const createDash = trpc.dashboards.create.useMutation();
  const createSpread = trpc.spreadsheets.create.useMutation();
  const createExtraction = trpc.extractions.create.useMutation();
  const createTranslation = trpc.translations.create.useMutation();
  const agentChat = trpc.aiAgent.chat.useMutation();
  const agentTranslate = trpc.aiAgent.translate.useMutation();
  const agentSummarize = trpc.aiAgent.summarize.useMutation();
  const govScanPrompt = trpc.platform.governance.scanPrompt.useMutation();
  const locLiveTranslation = trpc.platform.localization.liveTranslation.useMutation();

  /* ── Test sections ── */
  const initialSections: TestSection[] = [
    {
      id: "auth", title: "المصادقة — Auth", icon: "🔐",
      tests: [
        { name: "auth.me — الجلسة الحالية", status: "pending" },
        { name: "auth.login — تسجيل دخول", status: "pending" },
        { name: "auth.register — تسجيل جديد", status: "pending" },
      ],
    },
    {
      id: "ai", title: "محرك الذكاء الاصطناعي — AI", icon: "🤖",
      tests: [
        { name: "ai.status — حالة المحرك", status: "pending" },
        { name: "ai.chat — محادثة ذكية", status: "pending" },
        { name: "ai.generateSlides — توليد شرائح", status: "pending" },
        { name: "ai.generateReport — توليد تقرير", status: "pending" },
        { name: "ai.textOperation — ترجمة نص", status: "pending" },
        { name: "ai.analyzeExcelData — تحليل بيانات", status: "pending" },
        { name: "ai.generateDashboardWidgets — ودجات لوحة", status: "pending" },
        { name: "ai.generateReportSections — أقسام تقرير", status: "pending" },
      ],
    },
    {
      id: "aiAgent", title: "الوكيل الذكي — AI Agent", icon: "🧠",
      tests: [
        { name: "aiAgent.status — حالة الوكيل", status: "pending" },
        { name: "aiAgent.engineHealth — صحة المحركات", status: "pending" },
        { name: "aiAgent.chat — محادثة الوكيل", status: "pending" },
        { name: "aiAgent.translate — ترجمة", status: "pending" },
        { name: "aiAgent.summarize — تلخيص", status: "pending" },
      ],
    },
    {
      id: "files", title: "الملفات — Files", icon: "📁",
      tests: [
        { name: "files.list — قائمة الملفات", status: "pending" },
        { name: "files.create — إنشاء ملف", status: "pending" },
      ],
    },
    {
      id: "reports", title: "التقارير — Reports", icon: "📊",
      tests: [
        { name: "reports.list — قائمة التقارير", status: "pending" },
        { name: "reports.create — إنشاء تقرير", status: "pending" },
      ],
    },
    {
      id: "presentations", title: "العروض — Presentations", icon: "📽️",
      tests: [
        { name: "presentations.list — القائمة", status: "pending" },
        { name: "presentations.create — إنشاء عرض", status: "pending" },
        { name: "presentations.templates — القوالب", status: "pending" },
      ],
    },
    {
      id: "dashboards", title: "لوحات المعلومات — Dashboards", icon: "📈",
      tests: [
        { name: "dashboards.list — القائمة", status: "pending" },
        { name: "dashboards.create — إنشاء لوحة", status: "pending" },
        { name: "dashboards.templates — القوالب", status: "pending" },
      ],
    },
    {
      id: "spreadsheets", title: "جداول البيانات — Spreadsheets", icon: "📋",
      tests: [
        { name: "spreadsheets.list — القائمة", status: "pending" },
        { name: "spreadsheets.create — إنشاء جدول", status: "pending" },
      ],
    },
    {
      id: "extractions", title: "الاستخراج — Extractions", icon: "🔍",
      tests: [
        { name: "extractions.list — القائمة", status: "pending" },
        { name: "extractions.create — استخراج جديد", status: "pending" },
      ],
    },
    {
      id: "translations", title: "الترجمة — Translations", icon: "🌐",
      tests: [
        { name: "translations.list — القائمة", status: "pending" },
        { name: "translations.create — ترجمة جديدة", status: "pending" },
      ],
    },
    {
      id: "transcription", title: "التفريغ الصوتي — Transcription", icon: "🎙️",
      tests: [
        { name: "transcription.listJobs — المهام", status: "pending" },
      ],
    },
    {
      id: "library", title: "المكتبة — Library", icon: "📚",
      tests: [
        { name: "library.items — العناصر", status: "pending" },
        { name: "slideLibrary.getStats — إحصائيات", status: "pending" },
        { name: "slideLibrary.getCategories — التصنيفات", status: "pending" },
      ],
    },
    {
      id: "admin", title: "الإدارة — Admin", icon: "⚙️",
      tests: [
        { name: "admin.users — المستخدمين", status: "pending" },
        { name: "admin.stats — الإحصائيات", status: "pending" },
      ],
    },
    {
      id: "platform", title: "المنصة — Platform Engine", icon: "🏗️",
      tests: [
        { name: "platform.health.check — فحص الصحة", status: "pending" },
        { name: "platform.data.list — قائمة البيانات", status: "pending" },
        { name: "platform.transcription.listJobs — مهام التفريغ", status: "pending" },
      ],
    },
    {
      id: "governance", title: "الحوكمة — Governance", icon: "🛡️",
      tests: [
        { name: "governance.state — الحالة", status: "pending" },
        { name: "governance.roles — الأدوار", status: "pending" },
        { name: "governance.policies — السياسات", status: "pending" },
        { name: "governance.audit — المراجعة", status: "pending" },
        { name: "governance.kpis — مؤشرات الأداء", status: "pending" },
        { name: "governance.compliance — الامتثال", status: "pending" },
        { name: "governance.permissions — الصلاحيات", status: "pending" },
        { name: "governance.security — الأمان", status: "pending" },
        { name: "governance.scanPrompt — فحص البرومبت", status: "pending" },
      ],
    },
    {
      id: "localization", title: "التعريب — Localization", icon: "🗣️",
      tests: [
        { name: "localization.liveTranslation — ترجمة حية", status: "pending" },
      ],
    },
  ];

  const [sections, setSections] = useState<TestSection[]>(initialSections);
  const [expandedDetail, setExpandedDetail] = useState<string | null>(null);
  const [globalRunning, setGlobalRunning] = useState(false);

  /* ── Update a test in a section ── */
  const updateTest = useCallback((sectionId: string, testName: string, update: Partial<TestResult>) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId
        ? { ...s, tests: s.tests.map(t => t.name === testName ? { ...t, ...update } : t) }
        : s
    ));
  }, []);

  /* ── Run a single async test ── */
  const runTest = useCallback(async (
    sectionId: string, testName: string, fn: () => Promise<unknown>
  ) => {
    updateTest(sectionId, testName, { status: "running" });
    const start = Date.now();
    try {
      const response = await fn();
      updateTest(sectionId, testName, {
        status: "pass", duration: Date.now() - start, response,
      });
    } catch (err: any) {
      updateTest(sectionId, testName, {
        status: "fail", duration: Date.now() - start,
        error: err?.message || String(err),
      });
    }
  }, [updateTest]);

  /* ── Run a section ── */
  const runSection = useCallback(async (sectionId: string) => {
    const runners: Record<string, Record<string, () => Promise<unknown>>> = {
      auth: {
        "auth.me — الجلسة الحالية": () => utils.auth.me.fetch(),
        "auth.login — تسجيل دخول": () => loginMut.mutateAsync({ userId: "test_user", password: "test123" }),
        "auth.register — تسجيل جديد": () => registerMut.mutateAsync({
          userId: `test_${Date.now()}`, password: "Pass123!", displayName: "مستخدم تجريبي",
        }),
      },
      ai: {
        "ai.status — حالة المحرك": () => utils.ai.status.fetch(),
        "ai.chat — محادثة ذكية": () => aiChat.mutateAsync({
          messages: [{ role: "user", content: "ما هو الذكاء الاصطناعي؟" }],
        }),
        "ai.generateSlides — توليد شرائح": () => aiGenSlides.mutateAsync({
          prompt: "عرض عن الابتكار في 3 شرائح", slideCount: 3,
        }),
        "ai.generateReport — توليد تقرير": () => aiGenReport.mutateAsync({
          prompt: "تقرير عن أداء المبيعات الربع الأول",
        }),
        "ai.textOperation — ترجمة نص": () => aiTextOp.mutateAsync({
          text: "مرحباً بالعالم", operation: "translate", targetLanguage: "en",
        }),
        "ai.analyzeExcelData — تحليل بيانات": () => aiAnalyzeExcel.mutateAsync({
          prompt: "حلل البيانات",
          sheetData: { headers: ["الاسم", "المبلغ"], rows: [["أحمد", "5000"], ["سارة", "7500"]] },
        }),
        "ai.generateDashboardWidgets — ودجات لوحة": () => aiGenDashWidgets.mutateAsync({
          prompt: "لوحة معلومات للمبيعات",
        }),
        "ai.generateReportSections — أقسام تقرير": () => aiGenReportSections.mutateAsync({
          prompt: "تقرير أداء سنوي",
        }),
      },
      aiAgent: {
        "aiAgent.status — حالة الوكيل": () => utils.aiAgent.status.fetch(),
        "aiAgent.engineHealth — صحة المحركات": () => utils.aiAgent.engineHealth.fetch(),
        "aiAgent.chat — محادثة الوكيل": () => agentChat.mutateAsync({
          messages: [{ role: "user", content: "أنشئ تقرير عن الأداء" }],
        }),
        "aiAgent.translate — ترجمة": () => agentTranslate.mutateAsync({
          text: "مرحباً", targetLang: "en",
        }),
        "aiAgent.summarize — تلخيص": () => agentSummarize.mutateAsync({
          text: "الذكاء الاصطناعي هو فرع من علوم الحاسب يهتم بإنشاء أنظمة قادرة على أداء مهام تتطلب ذكاءً بشرياً مثل التعلم والاستدلال وحل المشكلات",
        }),
      },
      files: {
        "files.list — قائمة الملفات": () => utils.files.list.fetch(),
        "files.create — إنشاء ملف": () => createFile.mutateAsync({
          title: `ملف اختبار ${Date.now()}`, type: "document", category: "test",
        }),
      },
      reports: {
        "reports.list — قائمة التقارير": () => utils.reports.list.fetch(),
        "reports.create — إنشاء تقرير": () => createReport.mutateAsync({
          title: `تقرير اختبار ${Date.now()}`, description: "تقرير تجريبي للاختبار",
          reportType: "general",
        }),
      },
      presentations: {
        "presentations.list — القائمة": () => utils.presentations.list.fetch(),
        "presentations.create — إنشاء عرض": () => createPres.mutateAsync({
          title: `عرض اختبار ${Date.now()}`, description: "عرض تجريبي",
        }),
        "presentations.templates — القوالب": () => utils.presentations.templates.fetch(),
      },
      dashboards: {
        "dashboards.list — القائمة": () => utils.dashboards.list.fetch(),
        "dashboards.create — إنشاء لوحة": () => createDash.mutateAsync({
          title: `لوحة اختبار ${Date.now()}`, description: "لوحة تجريبية",
        }),
        "dashboards.templates — القوالب": () => utils.dashboards.templates.fetch(),
      },
      spreadsheets: {
        "spreadsheets.list — القائمة": () => utils.spreadsheets.list.fetch(),
        "spreadsheets.create — إنشاء جدول": () => createSpread.mutateAsync({
          title: `جدول اختبار ${Date.now()}`,
        }),
      },
      extractions: {
        "extractions.list — القائمة": () => utils.extractions.list.fetch(),
        "extractions.create — استخراج جديد": () => createExtraction.mutateAsync({
          sourceType: "text", extractedText: "نص تجريبي للاستخراج",
        }),
      },
      translations: {
        "translations.list — القائمة": () => utils.translations.list.fetch(),
        "translations.create — ترجمة جديدة": () => createTranslation.mutateAsync({
          sourceText: "مرحباً", translatedText: "Hello",
          sourceLang: "ar", targetLang: "en",
        }),
      },
      transcription: {
        "transcription.listJobs — المهام": () => utils.transcription.listJobs.fetch(),
      },
      library: {
        "library.items — العناصر": () => utils.library.items.fetch(),
        "slideLibrary.getStats — إحصائيات": () => utils.slideLibrary.getStats.fetch(),
        "slideLibrary.getCategories — التصنيفات": () => utils.slideLibrary.getCategories.fetch(),
      },
      admin: {
        "admin.users — المستخدمين": () => utils.admin.users.fetch(),
        "admin.stats — الإحصائيات": () => utils.admin.stats.fetch(),
      },
      platform: {
        "platform.health.check — فحص الصحة": () => utils.platform.health.check.fetch(),
        "platform.data.list — قائمة البيانات": () => utils.platform.data.list.fetch(),
        "platform.transcription.listJobs — مهام التفريغ": () => utils.platform.transcription.listJobs.fetch(),
      },
      governance: {
        "governance.state — الحالة": () => utils.platform.governance.state.fetch(),
        "governance.roles — الأدوار": () => utils.platform.governance.roles.fetch(),
        "governance.policies — السياسات": () => utils.platform.governance.policies.fetch(),
        "governance.audit — المراجعة": () => utils.platform.governance.audit.fetch(),
        "governance.kpis — مؤشرات الأداء": () => utils.platform.governance.kpis.fetch(),
        "governance.compliance — الامتثال": () => utils.platform.governance.compliance.fetch(),
        "governance.permissions — الصلاحيات": () => utils.platform.governance.permissions.fetch(),
        "governance.security — الأمان": () => utils.platform.governance.security.fetch(),
        "governance.scanPrompt — فحص البرومبت": () => govScanPrompt.mutateAsync({
          prompt: "اعرض لي بيانات الموظفين", context: "test",
        }),
      },
      localization: {
        "localization.liveTranslation — ترجمة حية": () => locLiveTranslation.mutateAsync({
          sourceLocale: "ar", targetLocale: "en",
          items: [{ key: "title", value: "لوحة المعلومات" }],
        }),
      },
    };

    const sectionRunners = runners[sectionId];
    if (!sectionRunners) return;

    for (const [testName, fn] of Object.entries(sectionRunners)) {
      await runTest(sectionId, testName, fn);
    }
  }, [utils, runTest, loginMut, registerMut, aiChat, aiGenSlides, aiGenReport, aiTextOp,
    aiAnalyzeExcel, aiGenDashWidgets, aiGenReportSections, agentChat, agentTranslate,
    agentSummarize, createFile, createReport, createPres, createDash, createSpread,
    createExtraction, createTranslation, govScanPrompt, locLiveTranslation]);

  /* ── Run ALL tests ── */
  const runAll = useCallback(async () => {
    setGlobalRunning(true);
    // Reset all
    setSections(initialSections);
    for (const section of initialSections) {
      await runSection(section.id);
    }
    setGlobalRunning(false);
  }, [runSection]);

  /* ── Stats ── */
  const allTests = sections.flatMap(s => s.tests);
  const passCount = allTests.filter(t => t.status === "pass").length;
  const failCount = allTests.filter(t => t.status === "fail").length;
  const totalCount = allTests.length;
  const runCount = passCount + failCount;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ maxWidth: 1600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#fff" }}>
                اختبار التنفيذات — Implementation Test
              </h1>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "8px 0 0" }}>
                اختبار شامل لـ {totalCount} نقطة عبر {sections.length} محرك — كل الـ tRPC APIs
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Stats badges */}
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "6px 14px", borderRadius: 20, background: "#10b98120", color: "#10b981", fontSize: 13, fontWeight: 700 }}>
                  ناجح {passCount}
                </span>
                <span style={{ padding: "6px 14px", borderRadius: 20, background: "#ef444420", color: "#ef4444", fontSize: 13, fontWeight: 700 }}>
                  فشل {failCount}
                </span>
                <span style={{ padding: "6px 14px", borderRadius: 20, background: "#6b728020", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
                  المجموع {totalCount}
                </span>
              </div>
              <button
                onClick={runAll}
                disabled={globalRunning}
                style={{
                  ...btnStyle, padding: "10px 28px", fontSize: 15, borderRadius: 10,
                  background: globalRunning ? "#374151" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                }}
              >
                {globalRunning ? "جاري التشغيل..." : "تشغيل جميع الاختبارات"}
              </button>
            </div>
          </div>
          {/* Progress bar */}
          {runCount > 0 && (
            <div style={{ marginTop: 16, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3, transition: "width 0.3s",
                width: `${(runCount / totalCount) * 100}%`,
                background: failCount > 0
                  ? `linear-gradient(90deg, #10b981 ${(passCount / runCount) * 100}%, #ef4444 ${(passCount / runCount) * 100}%)`
                  : "#10b981",
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Test Grid */}
      <div style={gridStyle}>
        {sections.map(section => {
          const sPass = section.tests.filter(t => t.status === "pass").length;
          const sFail = section.tests.filter(t => t.status === "fail").length;
          const sRunning = section.tests.some(t => t.status === "running");

          return (
            <div key={section.id} style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{section.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{section.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {section.tests.length} اختبار
                      {sPass > 0 && <span style={{ color: "#10b981", marginRight: 8 }}> — {sPass} ناجح</span>}
                      {sFail > 0 && <span style={{ color: "#ef4444", marginRight: 8 }}> — {sFail} فاشل</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => runSection(section.id)}
                  disabled={sRunning || globalRunning}
                  style={{
                    ...btnStyle,
                    background: sRunning ? "#374151" : "#3b82f6",
                  }}
                >
                  {sRunning ? "جاري..." : "تشغيل"}
                </button>
              </div>
              {/* Tests */}
              {section.tests.map(test => (
                <div
                  key={test.name}
                  style={{ ...testRowStyle, cursor: test.response || test.error ? "pointer" : "default" }}
                  onClick={() => {
                    if (test.response || test.error) {
                      setExpandedDetail(expandedDetail === test.name ? null : test.name);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: statusColors[test.status],
                      display: "inline-block",
                      animation: test.status === "running" ? "pulse 1s infinite" : "none",
                    }} />
                    <span style={{ color: test.status === "fail" ? "#fca5a5" : "#d1d5db" }}>
                      {test.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {test.duration != null && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>{test.duration}ms</span>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      color: statusColors[test.status],
                      background: statusColors[test.status] + "15",
                    }}>
                      {statusLabels[test.status]}
                    </span>
                  </div>
                </div>
              ))}
              {/* Expanded detail */}
              {section.tests.map(test =>
                expandedDetail === test.name && (test.response || test.error) ? (
                  <div key={test.name + "_detail"} style={{
                    padding: "10px 18px", background: "#0a0a12", fontSize: 11,
                    maxHeight: 200, overflow: "auto", borderTop: "1px solid #1e293b",
                  }}>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", direction: "ltr", textAlign: "left" }}>
                      {test.error
                        ? <span style={{ color: "#fca5a5" }}>{test.error}</span>
                        : <span style={{ color: "#86efac" }}>{JSON.stringify(test.response, null, 2)?.slice(0, 2000)}</span>
                      }
                    </pre>
                  </div>
                ) : null
              )}
            </div>
          );
        })}
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
