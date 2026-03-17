/* ═══════════════════════════════════════════════════════════════
   استوديو العروض التقديمية — Rasid Presentation Studio
   Catalog | Studio | Templates | AI | Export | Collab | Analytics | Integrations | Settings | Tools
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef } from "react";
import { trpc } from "../lib/trpc";

// ─── Types ────────────────────────────────────────────────────

type TabId = "studio" | "catalog" | "templates" | "ai" | "export" | "collab" | "analytics" | "integrations" | "settings" | "tools";

interface SlideBlock {
  block_id: string;
  kind: "body" | "chart" | "table" | "infographic" | "image" | "kpi" | "quote";
  content: string;
  editable: boolean;
}

interface Slide {
  slide_ref: string;
  title: string;
  layout: string;
  blocks: SlideBlock[];
  speaker_notes: string;
  content_density: "light" | "balanced" | "dense";
}

interface Deck {
  deck_id: string;
  title: string;
  slides: Slide[];
  template_id: string;
  language: string;
  status: "draft" | "published" | "archived";
  created_at: string;
}

type SourceType = "prompt" | "pdf" | "url" | "email" | "notes" | "csv" | "images" | "json";
type ToneType = "direct" | "confident" | "formal" | "creative" | "friendly";
type DensityType = "light" | "balanced" | "dense";
type MotionLevel = "none" | "subtle" | "moderate" | "high";
type RtlPolicy = "auto" | "rtl" | "ltr";
type TemplateLock = "unlocked" | "soft_lock" | "strict_lock";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "studio", label: "استوديو العروض", icon: "🎬" },
  { id: "catalog", label: "الكتالوج", icon: "🎨" },
  { id: "templates", label: "القوالب", icon: "📐" },
  { id: "ai", label: "الذكاء الاصطناعي", icon: "🤖" },
  { id: "export", label: "التصدير والنشر", icon: "📤" },
  { id: "collab", label: "التعاون", icon: "👥" },
  { id: "analytics", label: "التحليلات", icon: "📊" },
  { id: "integrations", label: "التكاملات", icon: "🔗" },
  { id: "settings", label: "التحكم والتفضيلات", icon: "⚙️" },
  { id: "tools", label: "الأدوات", icon: "🛠️" },
];

const CATALOG_KINDS = [
  { value: "layout", label: "تخطيطات" },
  { value: "infographic", label: "إنفوجرافيك" },
  { value: "table_style", label: "أنماط جداول" },
  { value: "chart_skin", label: "أشكال رسوم بيانية" },
  { value: "icon_pack", label: "حزم أيقونات" },
  { value: "motion_preset", label: "حركات" },
  { value: "header_footer", label: "رأس/تذييل" },
  { value: "background", label: "خلفيات" },
];

const TRANSFORM_KINDS = [
  { value: "replace_style", label: "استبدال النمط" },
  { value: "swap_infographic", label: "تبديل إنفوجرافيك" },
  { value: "change_chart_type", label: "تغيير نوع الرسم البياني" },
  { value: "change_table_style", label: "تغيير نمط الجدول" },
  { value: "apply_motion", label: "تطبيق حركة" },
  { value: "swap_icon_pack", label: "تبديل حزمة أيقونات" },
  { value: "change_background", label: "تغيير الخلفية" },
  { value: "swap_header_footer", label: "تبديل رأس/تذييل" },
  { value: "change_layout", label: "تغيير التخطيط" },
];

const PREMIUM_TEMPLATES = [
  { id: "vinyl", name: "Vinyl", nameAr: "فاينل", category: "corporate", description: "أنيق ورسمي مع لمسة دافئة", primary: "#8C2F39", secondary: "#0C1D3D", accent: "#C98C2D", neutral: "#F8F2EC", font: "Tajawal" },
  { id: "whiteboard", name: "Whiteboard", nameAr: "وايتبورد", category: "education", description: "نظيف وتعليمي بألوان هادئة", primary: "#1E40AF", secondary: "#1E293B", accent: "#059669", neutral: "#F1F5F9", font: "Inter" },
  { id: "grove", name: "Grove", nameAr: "غروف", category: "nature", description: "طبيعي ومريح بألوان خضراء", primary: "#166534", secondary: "#1C1917", accent: "#B45309", neutral: "#ECFDF5", font: "Noto Kufi Arabic" },
  { id: "fresco", name: "Fresco", nameAr: "فريسكو", category: "creative", description: "إبداعي وجريء بألوان نابضة", primary: "#9333EA", secondary: "#0F172A", accent: "#E11D48", neutral: "#FAF5FF", font: "Cairo" },
  { id: "easel", name: "Easel", nameAr: "إيزل", category: "startup", description: "عصري ومبتكر للشركات الناشئة", primary: "#0891B2", secondary: "#18181B", accent: "#F59E0B", neutral: "#ECFEFF", font: "Rubik" },
  { id: "diorama", name: "Diorama", nameAr: "ديوراما", category: "business", description: "قوي واحترافي للأعمال", primary: "#DC2626", secondary: "#1E293B", accent: "#2563EB", neutral: "#FEF2F2", font: "IBM Plex Sans Arabic" },
  { id: "chromatic", name: "Chromatic", nameAr: "كروماتيك", category: "tech", description: "تقني ومتطور بتدرجات لونية", primary: "#7C3AED", secondary: "#111827", accent: "#10B981", neutral: "#F5F3FF", font: "Almarai" },
];

const SOURCE_TYPES: Array<{ id: SourceType; label: string; icon: string }> = [
  { id: "prompt", label: "من نص", icon: "✏️" },
  { id: "pdf", label: "من ملف PDF", icon: "📄" },
  { id: "url", label: "من رابط URL", icon: "🌐" },
  { id: "email", label: "من بريد إلكتروني", icon: "📧" },
  { id: "notes", label: "من ملاحظات", icon: "📝" },
  { id: "csv", label: "من بيانات CSV", icon: "📊" },
  { id: "images", label: "من صور", icon: "🖼️" },
  { id: "json", label: "من JSON", icon: "{ }" },
];

const BRAND_PACKS = [
  { id: "rasid-official", name: "رصيد الرسمي", description: "الهوية البصرية الرسمية لمنصة رصيد", colors: ["#F97316", "#1E293B", "#059669", "#F8FAFC"] },
  { id: "corporate-blue", name: "المؤسسي الأزرق", description: "حزمة مؤسسية رسمية بدرجات الأزرق", colors: ["#1E40AF", "#3B82F6", "#60A5FA", "#EFF6FF"] },
  { id: "desert-warm", name: "دفء الصحراء", description: "ألوان دافئة مستوحاة من الصحراء العربية", colors: ["#B45309", "#D97706", "#FBBF24", "#FFFBEB"] },
];

const INTEGRATIONS_LIST = [
  { id: "gmail", name: "Gmail", nameAr: "جيميل", description: "استيراد محتوى من البريد الإلكتروني", icon: "📧", connected: false },
  { id: "notion", name: "Notion", nameAr: "نوشن", description: "مزامنة المحتوى مع صفحات نوشن", icon: "📓", connected: true },
  { id: "slack", name: "Slack", nameAr: "سلاك", description: "مشاركة العروض في قنوات سلاك", icon: "💬", connected: false },
  { id: "google-slides", name: "Google Slides", nameAr: "عروض جوجل", description: "تصدير واستيراد من عروض جوجل", icon: "📊", connected: false },
  { id: "google-drive", name: "Google Drive", nameAr: "جوجل درايف", description: "حفظ ومزامنة تلقائية", icon: "☁️", connected: true },
  { id: "onedrive", name: "OneDrive", nameAr: "ون درايف", description: "حفظ في ون درايف", icon: "💾", connected: false },
  { id: "zapier", name: "Zapier", nameAr: "زابير", description: "أتمتة سير العمل مع زابير", icon: "⚡", connected: false },
  { id: "make", name: "Make.com", nameAr: "ميك", description: "سيناريوهات أتمتة متقدمة", icon: "🔄", connected: false },
  { id: "chrome-ext", name: "Chrome Extension", nameAr: "إضافة كروم", description: "إنشاء عروض من أي صفحة ويب", icon: "🌐", connected: false },
];

// ─── Helpers ──────────────────────────────────────────────────

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="bg-slate-900 text-green-300 p-4 rounded-xl text-xs overflow-auto max-h-96 mt-3 leading-relaxed" dir="ltr">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function SectionCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm p-5 mb-4">
      <h3 className="text-base font-bold mb-3 flex items-center gap-2">
        {title}
        {badge && <span className="text-[10px] bg-orange-600 text-white px-2 py-0.5 rounded-full font-normal">{badge}</span>}
      </h3>
      {children}
    </div>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {ok ? "نجح ✓" : "فشل ✗"}
    </span>
  );
}

function LoadingSpinner({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
      <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      {text || "جاري التحميل..."}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <h4 className="text-lg font-semibold text-slate-700 mb-1">{title}</h4>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}


// ─── Main Component ───────────────────────────────────────────

export default function PresentationAddendumTest() {
  const [activeTab, setActiveTab] = useState<TabId>("studio");

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-3">
              <span className="bg-gradient-to-l from-orange-600 to-amber-500 text-transparent bg-clip-text">استوديو العروض التقديمية</span>
              <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">BETA</span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">منصة رصيد — إنشاء عروض احترافية بالذكاء الاصطناعي</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">v2.0 — Addendum Engine</div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-[73px] z-40">
        <div className="max-w-[1600px] mx-auto px-6 flex gap-1 overflow-x-auto py-2 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-gradient-to-l from-orange-600 to-amber-500 text-white shadow-md shadow-orange-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {activeTab === "studio" && <StudioTab />}
        {activeTab === "catalog" && <CatalogTab />}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "ai" && <AITab />}
        {activeTab === "export" && <ExportTab />}
        {activeTab === "collab" && <CollabTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "integrations" && <IntegrationsTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "tools" && <ToolsTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 py-4 text-center text-xs text-slate-400">
        منصة رصيد — استوديو العروض التقديمية &copy; 2026 | محرك Addendum v2.0
      </footer>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 1: STUDIO — استوديو العروض
// ═══════════════════════════════════════════════════════════════

function StudioTab() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);

  // --- Create Mode State ---
  const [sourceType, setSourceType] = useState<SourceType>("prompt");
  const [deckTitle, setDeckTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("vinyl");
  const [showSettings, setShowSettings] = useState(false);
  const [language, setLanguage] = useState("ar");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<ToneType>("confident");
  const [density, setDensity] = useState<DensityType>("balanced");
  const [slideCount, setSlideCount] = useState(8);
  const [motionLevel, setMotionLevel] = useState<MotionLevel>("subtle");
  const [rtlPolicy, setRtlPolicy] = useState<RtlPolicy>("auto");
  const [selectedBrandPack, setSelectedBrandPack] = useState("rasid-official");
  const [templateLock, setTemplateLock] = useState<TemplateLock>("unlocked");
  const [replaceBlockKind, setReplaceBlockKind] = useState("body");

  // --- tRPC mutations ---
  const deckCreateMutation = trpc.presentationAddendum.deckCreate.useMutation({
    onSuccess: (data: any) => {
      const newDeck: Deck = {
        deck_id: data.deck_id || "deck-" + Date.now(),
        title: deckTitle || "عرض جديد",
        slides: data.slides || generatePlaceholderSlides(),
        template_id: selectedTemplate,
        language,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      setDeck(newDeck);
      setSelectedSlideIdx(0);
    },
    onError: (err: any) => {
      alert("خطأ في إنشاء العرض: " + (err?.message || "غير معروف"));
    },
  });

  const deckMutateMutation = trpc.presentationAddendum.deckMutate.useMutation({
    onError: (err: any) => alert("خطأ في تعديل العرض: " + (err?.message || "غير معروف")),
  });

  const deckPublishMutation = trpc.presentationAddendum.deckPublish.useMutation({
    onSuccess: () => {
      if (deck) setDeck({ ...deck, status: "published" });
    },
    onError: (err: any) => alert("خطأ في النشر: " + (err?.message || "غير معروف")),
  });

  const deckParityMutation = trpc.presentationAddendum.deckParity.useMutation({
    onError: (err: any) => alert("خطأ في التكافؤ: " + (err?.message || "غير معروف")),
  });

  const deckTemplateLockMutation = trpc.presentationAddendum.deckTemplateLock.useMutation({
    onError: (err: any) => alert("خطأ في قفل القالب: " + (err?.message || "غير معروف")),
  });

  const deckExportInfoQuery = trpc.presentationAddendum.deckExportInfo.useQuery(
    { deck_id: deck?.deck_id || "" },
    { enabled: !!deck?.deck_id }
  );

  const deckListQuery = trpc.presentationAddendum.deckList.useQuery(undefined, {
    enabled: !deck,
  });

  const generatePlaceholderSlides = useCallback((): Slide[] => {
    return Array.from({ length: slideCount }, (_, i) => ({
      slide_ref: `slide-${i + 1}`,
      title: i === 0 ? (deckTitle || "شريحة العنوان") : `شريحة ${i + 1}`,
      layout: i === 0 ? "title" : i === slideCount - 1 ? "closing" : "two-column",
      blocks: [
        { block_id: `block-${i}-1`, kind: "body", content: "محتوى تجريبي للشريحة", editable: true },
        ...(i > 0 && i < slideCount - 1 ? [{ block_id: `block-${i}-2`, kind: "chart" as const, content: "رسم بياني", editable: true }] : []),
      ],
      speaker_notes: "",
      content_density: density,
    }));
  }, [slideCount, deckTitle, density]);

  const handleCreate = useCallback(() => {
    try {
      deckCreateMutation.mutate({
        title: deckTitle || "عرض جديد",
        prompt: promptText,
        source_type: sourceType,
        template_id: selectedTemplate,
        language,
        audience: audience || undefined,
        tone,
        density,
        slide_count: slideCount,
        motion_level: motionLevel,
        rtl_policy: rtlPolicy,
        brand_pack_id: selectedBrandPack,
      });
    } catch {
      // Fallback: create locally if route not available
      const newDeck: Deck = {
        deck_id: "deck-local-" + Date.now(),
        title: deckTitle || "عرض جديد",
        slides: generatePlaceholderSlides(),
        template_id: selectedTemplate,
        language,
        status: "draft",
        created_at: new Date().toISOString(),
      };
      setDeck(newDeck);
      setSelectedSlideIdx(0);
    }
  }, [deckCreateMutation, deckTitle, promptText, sourceType, selectedTemplate, language, audience, tone, density, slideCount, motionLevel, rtlPolicy, selectedBrandPack, generatePlaceholderSlides]);

  const handleAddSlide = useCallback(() => {
    if (!deck) return;
    const newIdx = deck.slides.length;
    const newSlide: Slide = {
      slide_ref: `slide-${newIdx + 1}`,
      title: `شريحة جديدة ${newIdx + 1}`,
      layout: "two-column",
      blocks: [{ block_id: `block-new-${newIdx}`, kind: "body", content: "", editable: true }],
      speaker_notes: "",
      content_density: "balanced",
    };
    setDeck({ ...deck, slides: [...deck.slides, newSlide] });
    setSelectedSlideIdx(newIdx);
  }, [deck]);

  const handleDeleteSlide = useCallback(() => {
    if (!deck || deck.slides.length <= 1) return;
    const updated = deck.slides.filter((_, i) => i !== selectedSlideIdx);
    setDeck({ ...deck, slides: updated });
    setSelectedSlideIdx(Math.max(0, selectedSlideIdx - 1));
  }, [deck, selectedSlideIdx]);

  const handleSlideNoteChange = useCallback((notes: string) => {
    if (!deck) return;
    const updatedSlides = [...deck.slides];
    updatedSlides[selectedSlideIdx] = { ...updatedSlides[selectedSlideIdx], speaker_notes: notes };
    setDeck({ ...deck, slides: updatedSlides });
  }, [deck, selectedSlideIdx]);

  const currentTemplate = PREMIUM_TEMPLATES.find((t) => t.id === (deck?.template_id || selectedTemplate));

  // ─── Create Mode ─────────────────────────────────────────
  if (!deck) {
    return (
      <div className="space-y-6">
        {/* Hero Section */}
        <div className="bg-gradient-to-l from-orange-600 via-amber-500 to-orange-500 rounded-3xl p-8 text-white shadow-xl shadow-orange-200/40">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold mb-3">إنشاء عرض تقديمي جديد</h2>
            <p className="text-orange-100 text-lg">حوّل أفكارك إلى عروض تقديمية احترافية في ثوانٍ باستخدام الذكاء الاصطناعي</p>
          </div>
        </div>

        {/* Recent Decks */}
        {deckListQuery.data && (
          <SectionCard title="العروض الأخيرة" badge={`${(deckListQuery.data as any)?.decks?.length || 0} عرض`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {((deckListQuery.data as any)?.decks || []).slice(0, 6).map((d: any) => (
                <div key={d.deck_id} className="border border-slate-200 rounded-xl p-4 cursor-pointer hover:border-orange-400 hover:shadow-md transition-all">
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{d.slide_count} شريحة</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Source Type Selector */}
        <SectionCard title="مصدر المحتوى" badge="8 مصادر">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SOURCE_TYPES.map((src) => (
              <button
                key={src.id}
                onClick={() => setSourceType(src.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  sourceType === src.id
                    ? "border-orange-500 bg-orange-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="text-2xl">{src.icon}</span>
                <span className="text-sm font-medium">{src.label}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Title & Prompt */}
        <SectionCard title="عنوان ومحتوى العرض">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">عنوان العرض</label>
              <input
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="مثال: خطة العمل الاستراتيجية 2026"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1.5">المحتوى أو الأمر النصي</label>
              <textarea
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="اكتب المحتوى أو وصف العرض الذي تريد إنشاءه... يمكنك لصق نصوص كاملة أو كتابة أوامر مثل: أنشئ عرض عن الذكاء الاصطناعي في التعليم"
                rows={6}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all"
              />
            </div>
          </div>
        </SectionCard>

        {/* Template Selector */}
        <SectionCard title="اختر القالب" badge="Premium">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {PREMIUM_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelectedTemplate(tpl.id)}
                className={`text-right rounded-2xl border-2 overflow-hidden transition-all ${
                  selectedTemplate === tpl.id
                    ? "border-orange-500 shadow-lg shadow-orange-100"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                {/* Color swatch header */}
                <div className="h-20 relative" style={{ background: `linear-gradient(135deg, ${tpl.primary}, ${tpl.secondary})` }}>
                  <div className="absolute bottom-2 right-2 flex gap-1.5">
                    {[tpl.primary, tpl.secondary, tpl.accent, tpl.neutral].map((c, i) => (
                      <div key={i} className="w-5 h-5 rounded-full border-2 border-white/50 shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  {selectedTemplate === tpl.id && (
                    <div className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">محدد</div>
                  )}
                </div>
                <div className="p-3 bg-white">
                  <div className="font-bold text-sm">{tpl.nameAr}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5" dir="ltr">{tpl.name} — {tpl.font}</div>
                  <div className="text-xs text-slate-500 mt-1">{tpl.description}</div>
                  <span className="inline-block mt-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tpl.category}</span>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Brand Pack */}
        <SectionCard title="حزمة الهوية البصرية">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BRAND_PACKS.map((bp) => (
              <button
                key={bp.id}
                onClick={() => setSelectedBrandPack(bp.id)}
                className={`text-right p-4 rounded-xl border-2 transition-all ${
                  selectedBrandPack === bp.id ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex gap-1.5 mb-2">
                  {bp.colors.map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full border border-white shadow" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <div className="font-medium text-sm">{bp.name}</div>
                <div className="text-xs text-slate-500 mt-1">{bp.description}</div>
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Settings Panel */}
        <SectionCard title="إعدادات متقدمة">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-orange-600 hover:text-orange-700 mb-3 flex items-center gap-1"
          >
            {showSettings ? "▲ إخفاء الإعدادات" : "▼ عرض الإعدادات المتقدمة"}
          </button>
          {showSettings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
              {/* Language */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">اللغة</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </div>
              {/* Audience */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">الجمهور المستهدف</label>
                <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="مثال: مدراء تنفيذيين" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              {/* Tone */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">الأسلوب</label>
                <select value={tone} onChange={(e) => setTone(e.target.value as ToneType)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="direct">مباشر</option>
                  <option value="confident">واثق</option>
                  <option value="formal">رسمي</option>
                  <option value="creative">إبداعي</option>
                  <option value="friendly">ودّي</option>
                </select>
              </div>
              {/* Density */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">كثافة المحتوى</label>
                <div className="flex gap-2">
                  {(["light", "balanced", "dense"] as DensityType[]).map((d) => (
                    <button key={d} onClick={() => setDensity(d)} className={`flex-1 py-2 rounded-lg text-xs font-medium ${density === d ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {d === "light" ? "خفيف" : d === "balanced" ? "متوازن" : "كثيف"}
                    </button>
                  ))}
                </div>
              </div>
              {/* Slide Count */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">عدد الشرائح المستهدف</label>
                <input type="number" value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))} min={3} max={50} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              {/* Motion */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">مستوى الحركة</label>
                <select value={motionLevel} onChange={(e) => setMotionLevel(e.target.value as MotionLevel)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="none">بدون حركة</option>
                  <option value="subtle">خفيفة</option>
                  <option value="moderate">متوسطة</option>
                  <option value="high">عالية</option>
                </select>
              </div>
              {/* RTL */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">سياسة الاتجاه</label>
                <select value={rtlPolicy} onChange={(e) => setRtlPolicy(e.target.value as RtlPolicy)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="auto">تلقائي</option>
                  <option value="rtl">من اليمين لليسار</option>
                  <option value="ltr">من اليسار لليمين</option>
                </select>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Create Button */}
        <div className="flex justify-center pt-2 pb-8">
          <button
            onClick={handleCreate}
            disabled={deckCreateMutation.isPending}
            className="bg-gradient-to-l from-orange-600 to-amber-500 text-white px-12 py-4 rounded-2xl text-lg font-bold shadow-xl shadow-orange-200/50 hover:shadow-2xl hover:shadow-orange-300/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deckCreateMutation.isPending ? "جاري الإنشاء..." : "إنشاء العرض"}
          </button>
        </div>
      </div>
    );
  }

  // ─── Edit Mode ───────────────────────────────────────────
  const currentSlide = deck.slides[selectedSlideIdx];

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setDeck(null)} className="text-sm text-slate-500 hover:text-orange-600 transition-colors">
            ← عودة
          </button>
          <h2 className="text-lg font-bold text-slate-900">{deck.title}</h2>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{deck.slides.length} شريحة</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
            deck.status === "published" ? "bg-emerald-100 text-emerald-700" :
            deck.status === "archived" ? "bg-slate-200 text-slate-600" :
            "bg-amber-100 text-amber-700"
          }`}>
            {deck.status === "published" ? "منشور" : deck.status === "archived" ? "مؤرشف" : "مسودة"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>القالب: {currentTemplate?.nameAr}</span>
          <span>|</span>
          <span>{deck.language === "ar" ? "عربي" : "إنجليزي"}</span>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* LEFT: Slide Navigator */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-3 sticky top-[160px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-700">الشرائح</h3>
              <div className="flex gap-1">
                <button onClick={handleAddSlide} className="text-xs bg-orange-600 text-white px-2.5 py-1 rounded-lg hover:bg-orange-700">+ إضافة</button>
                <button onClick={handleDeleteSlide} className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-200">حذف</button>
              </div>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {deck.slides.map((slide, idx) => (
                <button
                  key={slide.slide_ref}
                  onClick={() => setSelectedSlideIdx(idx)}
                  className={`w-full text-right p-3 rounded-xl border transition-all ${
                    idx === selectedSlideIdx
                      ? "border-orange-500 bg-orange-50 shadow-sm"
                      : "border-slate-100 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-mono w-5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{slide.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 flex gap-1.5">
                        <span>{slide.layout}</span>
                        <span>·</span>
                        <span>{slide.blocks.length} عنصر</span>
                      </div>
                    </div>
                    <span className="text-slate-300 text-xs">⋮⋮</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: Slide Preview */}
        <div className="col-span-12 lg:col-span-5">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700">معاينة الشريحة {selectedSlideIdx + 1}</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{currentSlide.layout}</span>
            </div>

            {/* Slide Card */}
            <div
              className="rounded-2xl border border-slate-200 overflow-hidden shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${currentTemplate?.neutral || "#F8F2EC"}, white)`,
                minHeight: 320,
              }}
            >
              {/* Slide Title Bar */}
              <div className="px-6 py-4" style={{ borderBottom: `3px solid ${currentTemplate?.primary || "#8C2F39"}` }}>
                <h4 className="text-xl font-bold" style={{ color: currentTemplate?.secondary || "#0C1D3D", fontFamily: currentTemplate?.font }}>
                  {currentSlide.title}
                </h4>
              </div>
              {/* Blocks */}
              <div className="p-6 space-y-4">
                {currentSlide.blocks.map((block) => (
                  <div key={block.block_id} className="group relative">
                    <div className="flex items-start gap-2">
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 mt-1"
                        style={{
                          backgroundColor: currentTemplate?.accent || "#C98C2D",
                          color: "white",
                        }}
                      >
                        {block.kind}
                      </span>
                      <div className="flex-1">
                        {block.kind === "body" && <p className="text-sm text-slate-700 leading-relaxed">{block.content || "نص فارغ..."}</p>}
                        {block.kind === "chart" && (
                          <div className="bg-slate-50 rounded-xl p-4 h-32 flex items-center justify-center border border-dashed border-slate-200">
                            <div className="text-center text-slate-400">
                              <span className="text-2xl">📊</span>
                              <p className="text-xs mt-1">رسم بياني</p>
                            </div>
                          </div>
                        )}
                        {block.kind === "table" && (
                          <div className="bg-slate-50 rounded-xl p-4 h-24 flex items-center justify-center border border-dashed border-slate-200">
                            <div className="text-center text-slate-400">
                              <span className="text-2xl">📋</span>
                              <p className="text-xs mt-1">جدول بيانات</p>
                            </div>
                          </div>
                        )}
                        {block.kind === "infographic" && (
                          <div className="bg-slate-50 rounded-xl p-4 h-32 flex items-center justify-center border border-dashed border-slate-200">
                            <div className="text-center text-slate-400">
                              <span className="text-2xl">📈</span>
                              <p className="text-xs mt-1">إنفوجرافيك</p>
                            </div>
                          </div>
                        )}
                        {block.kind === "image" && (
                          <div className="bg-slate-50 rounded-xl p-4 h-32 flex items-center justify-center border border-dashed border-slate-200">
                            <div className="text-center text-slate-400">
                              <span className="text-2xl">🖼️</span>
                              <p className="text-xs mt-1">صورة</p>
                            </div>
                          </div>
                        )}
                        {block.kind === "kpi" && (
                          <div className="bg-gradient-to-l from-orange-50 to-amber-50 rounded-xl p-4 text-center border border-orange-200/50">
                            <div className="text-2xl font-bold" style={{ color: currentTemplate?.primary }}>—</div>
                            <div className="text-xs text-slate-500 mt-1">مؤشر أداء</div>
                          </div>
                        )}
                        {block.kind === "quote" && (
                          <div className="border-r-4 pr-4 py-2" style={{ borderColor: currentTemplate?.accent }}>
                            <p className="text-sm italic text-slate-600">{block.content || "اقتباس..."}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Slide Footer */}
              <div className="px-6 py-2 text-[10px] text-slate-400 flex justify-between" style={{ borderTop: `1px solid ${currentTemplate?.primary}20` }}>
                <span>{deck.title}</span>
                <span>{selectedSlideIdx + 1} / {deck.slides.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Properties Panel */}
        <div className="col-span-12 lg:col-span-4">
          <div className="space-y-4">
            {/* Slide Properties */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">خصائص الشريحة</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">التخطيط</label>
                  <select
                    value={currentSlide.layout}
                    onChange={(e) => {
                      const updated = [...deck.slides];
                      updated[selectedSlideIdx] = { ...currentSlide, layout: e.target.value };
                      setDeck({ ...deck, slides: updated });
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="title">شريحة عنوان</option>
                    <option value="two-column">عمودان</option>
                    <option value="content">محتوى</option>
                    <option value="image-left">صورة يسار</option>
                    <option value="image-right">صورة يمين</option>
                    <option value="comparison">مقارنة</option>
                    <option value="timeline">خط زمني</option>
                    <option value="closing">شريحة ختامية</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">كثافة المحتوى</label>
                  <div className="flex gap-2">
                    {(["light", "balanced", "dense"] as DensityType[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          const updated = [...deck.slides];
                          updated[selectedSlideIdx] = { ...currentSlide, content_density: d };
                          setDeck({ ...deck, slides: updated });
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs ${currentSlide.content_density === d ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}
                      >
                        {d === "light" ? "خفيف" : d === "balanced" ? "متوازن" : "كثيف"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Block List */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">عناصر الشريحة ({currentSlide.blocks.length})</h3>
              <div className="space-y-2">
                {currentSlide.blocks.map((block, bIdx) => (
                  <div key={block.block_id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{block.kind}</span>
                    <span className="text-xs text-slate-600 flex-1 truncate">{block.content || "فارغ"}</span>
                    <span className={`text-[9px] ${block.editable ? "text-emerald-600" : "text-slate-400"}`}>
                      {block.editable ? "قابل للتعديل" : "مقفل"}
                    </span>
                  </div>
                ))}
              </div>
              {/* Replace Block Kind */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="text-xs text-slate-500 block mb-1">تغيير نوع العنصر الأول</label>
                <div className="flex gap-2">
                  <select value={replaceBlockKind} onChange={(e) => setReplaceBlockKind(e.target.value)} className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                    <option value="body">نص</option>
                    <option value="chart">رسم بياني</option>
                    <option value="table">جدول</option>
                    <option value="infographic">إنفوجرافيك</option>
                    <option value="image">صورة</option>
                    <option value="kpi">مؤشر أداء</option>
                    <option value="quote">اقتباس</option>
                  </select>
                  <button
                    onClick={() => {
                      if (!currentSlide.blocks.length) return;
                      const updated = [...deck.slides];
                      const updatedBlocks = [...currentSlide.blocks];
                      updatedBlocks[0] = { ...updatedBlocks[0], kind: replaceBlockKind as SlideBlock["kind"] };
                      updated[selectedSlideIdx] = { ...currentSlide, blocks: updatedBlocks };
                      setDeck({ ...deck, slides: updated });
                    }}
                    className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-700"
                  >
                    تطبيق
                  </button>
                </div>
              </div>
            </div>

            {/* Speaker Notes */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">ملاحظات المتحدث</h3>
              <textarea
                value={currentSlide.speaker_notes}
                onChange={(e) => handleSlideNoteChange(e.target.value)}
                placeholder="أضف ملاحظات للمتحدث هنا..."
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            {/* Regenerate Slide */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">إجراءات</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    try {
                      deckMutateMutation.mutate({ deck_id: deck.deck_id, action: "regenerate_slide", slide_ref: currentSlide.slide_ref });
                    } catch { /* route not yet connected */ }
                  }}
                  className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
                >
                  إعادة توليد الشريحة
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5">
            <span>📄</span> تصدير PPTX
          </button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 flex items-center gap-1.5">
            <span>📑</span> تصدير PDF
          </button>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 flex items-center gap-1.5">
            <span>🌐</span> تصدير HTML
          </button>
          <button
            onClick={() => {
              try {
                deckPublishMutation.mutate({ deck_id: deck.deck_id, target_ref: "public" });
              } catch { /* route not yet connected */ }
            }}
            disabled={deckPublishMutation.isPending}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {deckPublishMutation.isPending ? "جاري النشر..." : "نشر العرض"}
          </button>
          <button
            onClick={() => {
              try {
                deckParityMutation.mutate({ deck_id: deck.deck_id });
              } catch { /* route not yet connected */ }
            }}
            disabled={deckParityMutation.isPending}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            فحص التكافؤ
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">قفل القالب:</label>
          <select
            value={templateLock}
            onChange={(e) => {
              const val = e.target.value as TemplateLock;
              setTemplateLock(val);
              try {
                deckTemplateLockMutation.mutate({ deck_id: deck.deck_id, lock_level: val });
              } catch { /* route not yet connected */ }
            }}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white"
          >
            <option value="unlocked">مفتوح</option>
            <option value="soft_lock">قفل مرن</option>
            <option value="strict_lock">قفل صارم</option>
          </select>
        </div>
      </div>

      {/* Export Info */}
      {deckExportInfoQuery.data && (
        <SectionCard title="معلومات التصدير">
          <JsonBlock data={deckExportInfoQuery.data} />
        </SectionCard>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 2: CATALOG — الكتالوج
// ═══════════════════════════════════════════════════════════════

function CatalogTab() {
  const [kind, setKind] = useState("layout");
  const [query, setQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [variantDirection, setVariantDirection] = useState<"more_like_this" | "different_direction" | "simpler" | "more_complex">("more_like_this");

  const statsQuery = trpc.presentationAddendum.catalogStats.useQuery();
  const searchQuery = trpc.presentationAddendum.catalogSearch.useQuery(
    { kind, query: query || undefined, limit: 20 },
    { enabled: true }
  );
  const familiesQuery = trpc.presentationAddendum.catalogFamilies.useQuery({ kind });
  const variantsQuery = trpc.presentationAddendum.catalogVariants.useQuery(
    { asset_id: selectedAssetId, kind, count: 6, direction: variantDirection },
    { enabled: !!selectedAssetId }
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <SectionCard title="إحصائيات الكتالوج" badge="LIVE">
        {statsQuery.isLoading && <LoadingSpinner text="جاري تحميل الإحصائيات..." />}
        {statsQuery.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(statsQuery.data).map(([k, v]) => {
              const stat = v as { base_count: number; families: number };
              return (
                <div key={k} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 text-center border border-slate-100">
                  <div className="text-2xl font-bold text-orange-600">{stat.base_count?.toLocaleString("ar-SA") ?? 0}</div>
                  <div className="text-xs text-slate-600 mt-1 font-medium">{k}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{stat.families} عائلة</div>
                </div>
              );
            })}
          </div>
        )}
        {statsQuery.error && <p className="text-red-500 text-sm">{statsQuery.error.message}</p>}
      </SectionCard>

      {/* Search */}
      <SectionCard title="بحث في الكتالوج">
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white shadow-sm"
          >
            {CATALOG_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالكلمات..."
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm flex-1 min-w-[200px] shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none"
          />
        </div>

        {searchQuery.isLoading && <LoadingSpinner text="جاري البحث..." />}
        {searchQuery.data && (
          <>
            <p className="text-sm text-slate-500 mb-3">عدد النتائج: {searchQuery.data.total}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchQuery.data.assets.map((asset: any) => (
                <div
                  key={asset.asset_id}
                  onClick={() => setSelectedAssetId(asset.asset_id)}
                  className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${
                    selectedAssetId === asset.asset_id ? "border-orange-500 bg-orange-50 shadow-sm" : "border-slate-200 bg-white"
                  }`}
                >
                  {asset.svg_template && (
                    <div
                      className="h-24 rounded-lg overflow-hidden mb-2 bg-slate-50 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: asset.svg_template }}
                    />
                  )}
                  {asset.css_template && !asset.svg_template && (
                    <div
                      className="h-24 rounded-lg overflow-hidden mb-2"
                      style={(() => {
                        try {
                          const styles: Record<string, string> = {};
                          asset.css_template.split(";").forEach((s: string) => {
                            const [k, v] = s.split(":");
                            if (k && v) styles[k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())] = v.trim();
                          });
                          return styles;
                        } catch { return {}; }
                      })()}
                    />
                  )}
                  <div className="font-medium text-sm">{asset.name_ar || asset.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{asset.family} · {asset.tags?.join("، ")}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* Families */}
      <SectionCard title="عائلات الأصول">
        {familiesQuery.isLoading && <LoadingSpinner />}
        {familiesQuery.data && (
          <div className="flex flex-wrap gap-2">
            {familiesQuery.data.map((f: string) => (
              <span key={f} className="bg-gradient-to-l from-slate-100 to-slate-50 text-slate-700 px-3 py-1.5 rounded-full text-sm border border-slate-200">{f}</span>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Variants */}
      {selectedAssetId && (
        <SectionCard title="توليد المتغيرات" badge="PARAMETRIC">
          <div className="flex gap-3 mb-4 flex-wrap">
            <select
              value={variantDirection}
              onChange={(e) => setVariantDirection(e.target.value as any)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white shadow-sm"
            >
              <option value="more_like_this">مشابه أكثر</option>
              <option value="different_direction">اتجاه مختلف</option>
              <option value="simpler">أبسط</option>
              <option value="more_complex">أعقد</option>
            </select>
            <div className="text-sm text-slate-500 self-center">الأصل: {selectedAssetId}</div>
          </div>
          {variantsQuery.isLoading && <LoadingSpinner text="جاري التوليد..." />}
          {variantsQuery.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {variantsQuery.data.variants.map((v: any) => (
                <div key={v.variant_id} className="border border-slate-200 rounded-xl p-3 bg-white hover:shadow-md transition-all">
                  {v.preview_svg && (
                    <div className="h-20 rounded-lg overflow-hidden mb-2 bg-slate-50 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: v.preview_svg }} />
                  )}
                  {v.preview_css && !v.preview_svg && (
                    <div className="h-20 rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-orange-100 to-purple-100" />
                  )}
                  <div className="text-xs text-slate-600">{v.variant_id.slice(0, 20)}...</div>
                  <JsonBlock data={v.params} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 3: TEMPLATES — القوالب
// ═══════════════════════════════════════════════════════════════

function TemplatesTab() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "detail">("grid");

  const templateListQuery = trpc.presentationAddendum.templateList.useQuery(undefined, { enabled: false });
  const brandPackListQuery = trpc.presentationAddendum.brandPackList.useQuery(undefined, { enabled: false });

  const selected = PREMIUM_TEMPLATES.find((t) => t.id === selectedTemplate);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">قوالب العروض التقديمية</h2>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          <button onClick={() => setViewMode("grid")} className={`px-3 py-1.5 rounded-md text-xs ${viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            شبكة
          </button>
          <button onClick={() => setViewMode("detail")} className={`px-3 py-1.5 rounded-md text-xs ${viewMode === "detail" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>
            تفاصيل
          </button>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {PREMIUM_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            onClick={() => setSelectedTemplate(selectedTemplate === tpl.id ? null : tpl.id)}
            className={`rounded-2xl border-2 overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplate === tpl.id ? "border-orange-500 shadow-xl shadow-orange-100" : "border-slate-200"
            }`}
          >
            {/* Visual Header */}
            <div className="h-36 relative" style={{ background: `linear-gradient(135deg, ${tpl.primary}CC, ${tpl.secondary})` }}>
              {/* Mock slide layout */}
              <div className="absolute inset-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-3">
                <div className="w-1/2 h-2 rounded-full mb-2" style={{ backgroundColor: `${tpl.neutral}80` }} />
                <div className="w-3/4 h-1.5 rounded-full mb-1.5" style={{ backgroundColor: `${tpl.neutral}40` }} />
                <div className="w-2/3 h-1.5 rounded-full mb-3" style={{ backgroundColor: `${tpl.neutral}40` }} />
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: `${tpl.accent}60` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: `${tpl.primary}40` }} />
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: `${tpl.accent}40` }} />
                </div>
              </div>
              {/* Color Palette */}
              <div className="absolute bottom-2 right-2 flex gap-1">
                {[tpl.primary, tpl.secondary, tpl.accent, tpl.neutral].map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border-2 border-white/60 shadow" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {/* Info */}
            <div className="p-4 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base">{tpl.nameAr}</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tpl.category}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                <span dir="ltr">{tpl.name}</span>
                <span>·</span>
                <span>{tpl.font}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Template Detail View */}
      {selected && (
        <SectionCard title={`تفاصيل قالب ${selected.nameAr}`} badge={selected.category}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview */}
            <div>
              <h4 className="text-sm font-medium text-slate-600 mb-2">معاينة التصميم</h4>
              <div className="rounded-2xl overflow-hidden border border-slate-200" style={{ background: `linear-gradient(135deg, ${selected.neutral}, white)` }}>
                <div className="p-6" style={{ borderBottom: `3px solid ${selected.primary}` }}>
                  <h3 className="text-xl font-bold" style={{ color: selected.secondary, fontFamily: selected.font }}>عنوان العرض التقديمي</h3>
                  <p className="text-sm mt-2" style={{ color: `${selected.secondary}99` }}>وصف مختصر للمحتوى والأفكار الرئيسية</p>
                </div>
                <div className="p-6 flex gap-3">
                  <div className="flex-1 h-16 rounded-lg" style={{ backgroundColor: `${selected.primary}15` }} />
                  <div className="flex-1 h-16 rounded-lg" style={{ backgroundColor: `${selected.accent}15` }} />
                </div>
              </div>
            </div>
            {/* Properties */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-2">لوحة الألوان</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "الأساسي", color: selected.primary },
                    { label: "الثانوي", color: selected.secondary },
                    { label: "التمييز", color: selected.accent },
                    { label: "المحايد", color: selected.neutral },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                      <div className="w-8 h-8 rounded-lg border border-slate-200 shadow-inner" style={{ backgroundColor: c.color }} />
                      <div>
                        <div className="text-xs font-medium">{c.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono" dir="ltr">{c.color}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-2">الخط</h4>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-lg font-bold" style={{ fontFamily: selected.font }}>{selected.font}</div>
                  <div className="text-sm mt-1" style={{ fontFamily: selected.font }}>نموذج نصي باستخدام الخط المحدد</div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-600 mb-2">أنماط التخطيط المتاحة</h4>
                <div className="flex flex-wrap gap-1.5">
                  {["عنوان", "عمودان", "محتوى", "صورة", "مقارنة", "خط زمني", "ختامية"].map((l) => (
                    <span key={l} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-full">{l}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Brand Packs */}
      <SectionCard title="حزم الهوية البصرية" badge={`${BRAND_PACKS.length} حزمة`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BRAND_PACKS.map((bp) => (
            <div key={bp.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md transition-all">
              <div className="flex gap-1.5 mb-3">
                {bp.colors.map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-lg border border-white shadow" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="font-medium text-sm">{bp.name}</div>
              <div className="text-xs text-slate-500 mt-1">{bp.description}</div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 4: AI — الذكاء الاصطناعي
// ═══════════════════════════════════════════════════════════════

function AITab() {
  const [translateLang, setTranslateLang] = useState("en");
  const [translateDeckId, setTranslateDeckId] = useState("deck-test-001");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageGenerated, setImageGenerated] = useState(false);
  const [rewriteText, setRewriteText] = useState("");
  const [rewriteResult, setRewriteResult] = useState("");
  const [rewriteMode, setRewriteMode] = useState<"rephrase" | "summarize" | "expand">("rephrase");
  const [tonePreview, setTonePreview] = useState<ToneType>("confident");
  const [speakerNotesGenerated, setSpeakerNotesGenerated] = useState(false);

  const translateMutation = trpc.presentationAddendum.deckTranslate.useMutation({
    onError: (err: any) => alert("خطأ في الترجمة: " + (err?.message || "غير معروف")),
  });

  const speakerNotesQuery = trpc.presentationAddendum.deckSpeakerNotes.useQuery(
    { deck_id: translateDeckId },
    { enabled: speakerNotesGenerated }
  );

  return (
    <div className="space-y-4">
      {/* Translation */}
      <SectionCard title="ترجمة العرض" badge="AI">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 block mb-1.5">معرّف العرض</label>
            <input type="text" value={translateDeckId} onChange={(e) => setTranslateDeckId(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">اللغة المستهدفة</label>
            <select value={translateLang} onChange={(e) => setTranslateLang(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="en">English</option>
              <option value="ar">العربية</option>
              <option value="fr">Fran&ccedil;ais</option>
              <option value="es">Espa&ntilde;ol</option>
              <option value="de">Deutsch</option>
              <option value="tr">T&uuml;rk&ccedil;e</option>
              <option value="ur">اردو</option>
            </select>
          </div>
          <div className="self-end">
            <button
              onClick={() => {
                try {
                  translateMutation.mutate({ deck_id: translateDeckId, target_language: translateLang });
                } catch { /* route not yet connected */ }
              }}
              disabled={translateMutation.isPending}
              className="bg-gradient-to-l from-orange-600 to-amber-500 text-white px-6 py-2.5 rounded-xl text-sm hover:shadow-md disabled:opacity-50"
            >
              {translateMutation.isPending ? "جاري الترجمة..." : "ترجمة العرض"}
            </button>
          </div>
        </div>
        {translateMutation.data && (
          <div className="mt-3">
            <StatusBadge ok={true} />
            <JsonBlock data={translateMutation.data} />
          </div>
        )}
      </SectionCard>

      {/* Speaker Notes Generator */}
      <SectionCard title="توليد ملاحظات المتحدث" badge="AI">
        <p className="text-sm text-slate-500 mb-3">توليد ملاحظات تلقائية لجميع شرائح العرض لمساعدة المقدّم</p>
        <button
          onClick={() => setSpeakerNotesGenerated(true)}
          className="bg-gradient-to-l from-purple-600 to-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm hover:shadow-md"
        >
          توليد ملاحظات المتحدث
        </button>
        {speakerNotesQuery.isLoading && <LoadingSpinner text="جاري توليد الملاحظات..." />}
        {speakerNotesQuery.data && (
          <div className="mt-3">
            <StatusBadge ok={true} />
            <JsonBlock data={speakerNotesQuery.data} />
          </div>
        )}
        {speakerNotesQuery.error && <p className="text-red-500 text-sm mt-3">{speakerNotesQuery.error.message}</p>}
      </SectionCard>

      {/* Image Generation */}
      <SectionCard title="توليد الصور" badge="AI">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">وصف الصورة</label>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder="صف الصورة التي تريد إنشاءها... مثال: رسم توضيحي لمدينة ذكية مستقبلية بأسلوب متساوي الأبعاد"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
            />
          </div>
          <button
            onClick={() => setImageGenerated(true)}
            disabled={!imagePrompt}
            className="bg-gradient-to-l from-emerald-600 to-teal-500 text-white px-6 py-2.5 rounded-xl text-sm hover:shadow-md disabled:opacity-50"
          >
            توليد صورة
          </button>
          {imageGenerated && (
            <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl p-8 text-center border border-dashed border-slate-300">
              <div className="text-4xl mb-3">🖼️</div>
              <p className="text-sm text-slate-600 font-medium">تم إرسال طلب توليد الصورة</p>
              <p className="text-xs text-slate-400 mt-1">الوصف: {imagePrompt}</p>
              <div className="mt-4 w-48 h-48 mx-auto rounded-xl bg-gradient-to-br from-orange-200 via-purple-200 to-blue-200 flex items-center justify-center">
                <span className="text-5xl">🎨</span>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Content Rewriting */}
      <SectionCard title="إعادة صياغة المحتوى" badge="AI">
        <div className="space-y-3">
          <textarea
            value={rewriteText}
            onChange={(e) => setRewriteText(e.target.value)}
            placeholder="الصق النص الذي تريد إعادة صياغته هنا..."
            rows={4}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {([
              { id: "rephrase" as const, label: "إعادة صياغة", icon: "🔄" },
              { id: "summarize" as const, label: "تلخيص", icon: "📝" },
              { id: "expand" as const, label: "توسيع", icon: "📖" },
            ]).map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setRewriteMode(mode.id);
                  if (rewriteText) {
                    setRewriteResult(`[${mode.label}] — ${rewriteText.slice(0, 100)}... (نتيجة تجريبية)`);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 ${
                  rewriteMode === mode.id ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{mode.icon}</span> {mode.label}
              </button>
            ))}
          </div>
          {rewriteResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-xs text-emerald-600 mb-1">النتيجة:</div>
              <p className="text-sm text-slate-700">{rewriteResult}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Tone Adjustment */}
      <SectionCard title="ضبط الأسلوب" badge="AI">
        <p className="text-sm text-slate-500 mb-3">اختر الأسلوب المطلوب لعرض المحتوى</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([
            { id: "direct" as ToneType, label: "مباشر", icon: "🎯", desc: "واضح ومركّز" },
            { id: "confident" as ToneType, label: "واثق", icon: "💪", desc: "قوي ومقنع" },
            { id: "formal" as ToneType, label: "رسمي", icon: "👔", desc: "احترافي ومنظّم" },
            { id: "creative" as ToneType, label: "إبداعي", icon: "🎨", desc: "مبتكر ومميز" },
            { id: "friendly" as ToneType, label: "ودّي", icon: "😊", desc: "قريب ومحبب" },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTonePreview(t.id)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                tonePreview === t.id ? "border-orange-500 bg-orange-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 5: EXPORT — التصدير والنشر
// ═══════════════════════════════════════════════════════════════

function ExportTab() {
  const [publishRef, setPublishRef] = useState("public");
  const [publishPassword, setPublishPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const publishMutation = trpc.presentationAddendum.deckPublish.useMutation({
    onSuccess: (data: any) => {
      setShareLink(data?.url || `https://rasid.app/p/${publishRef}`);
    },
    onError: (err: any) => alert("خطأ في النشر: " + (err?.message || "غير معروف")),
  });

  const EXPORT_FORMATS = [
    { id: "pptx", name: "PowerPoint", ext: ".pptx", icon: "📊", color: "from-orange-500 to-red-500", description: "ملف عرض تقديمي متوافق مع Microsoft PowerPoint" },
    { id: "pdf", name: "PDF", ext: ".pdf", icon: "📄", color: "from-red-500 to-red-700", description: "مستند PDF عالي الجودة للطباعة والمشاركة" },
    { id: "html", name: "HTML", ext: ".html", icon: "🌐", color: "from-blue-500 to-indigo-600", description: "صفحة ويب تفاعلية يمكن استضافتها" },
    { id: "gslides", name: "Google Slides", ext: "", icon: "📑", color: "from-amber-400 to-yellow-500", description: "تصدير مباشر إلى عروض جوجل التقديمية" },
    { id: "jpeg", name: "JPEG", ext: ".jpg", icon: "🖼️", color: "from-emerald-500 to-green-600", description: "صور عالية الدقة لكل شريحة" },
    { id: "video", name: "Video", ext: ".mp4", icon: "🎬", color: "from-purple-500 to-violet-600", description: "فيديو متحرك مع انتقالات وحركات" },
  ];

  return (
    <div className="space-y-4">
      {/* Export Formats */}
      <SectionCard title="تصدير العرض" badge={`${EXPORT_FORMATS.length} صيغ`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPORT_FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setExportingFormat(fmt.id)}
              className={`text-right p-5 rounded-2xl border-2 transition-all hover:shadow-lg ${
                exportingFormat === fmt.id ? "border-orange-500 shadow-md" : "border-slate-200"
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${fmt.color} flex items-center justify-center text-2xl text-white mb-3 shadow-md`}>
                {fmt.icon}
              </div>
              <h4 className="font-bold text-sm">{fmt.name}</h4>
              {fmt.ext && <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{fmt.ext}</span>}
              <p className="text-xs text-slate-500 mt-1.5">{fmt.description}</p>
            </button>
          ))}
        </div>
        {exportingFormat && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-orange-700">تصدير بصيغة {EXPORT_FORMATS.find((f) => f.id === exportingFormat)?.name}...</span>
            <button className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700">بدء التصدير</button>
          </div>
        )}
      </SectionCard>

      {/* Publish */}
      <SectionCard title="نشر العرض" badge="LIVE">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">مرجع النشر</label>
            <input type="text" value={publishRef} onChange={(e) => setPublishRef(e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5 flex items-center gap-2">
              كلمة مرور
              <button onClick={() => setUsePassword(!usePassword)} className={`w-8 h-4 rounded-full relative transition-colors ${usePassword ? "bg-orange-500" : "bg-slate-300"}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow ${usePassword ? "right-0.5" : "left-0.5"}`} />
              </button>
            </label>
            {usePassword && (
              <input type="password" value={publishPassword} onChange={(e) => setPublishPassword(e.target.value)} placeholder="كلمة المرور..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            )}
          </div>
        </div>
        <button
          onClick={() => {
            try {
              publishMutation.mutate({ deck_id: "deck-test-001", target_ref: publishRef, password: usePassword ? publishPassword : undefined });
            } catch { /* fallback */ setShareLink(`https://rasid.app/p/${publishRef}`); }
          }}
          disabled={publishMutation.isPending}
          className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {publishMutation.isPending ? "جاري النشر..." : "نشر العرض"}
        </button>
        {shareLink && (
          <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="text-xs text-emerald-600 mb-1">رابط المشاركة:</div>
            <div className="font-mono text-sm text-emerald-800 break-all" dir="ltr">{shareLink}</div>
          </div>
        )}
      </SectionCard>

      {/* Cloud Save */}
      <SectionCard title="الحفظ السحابي">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: "gdrive", name: "Google Drive", icon: "☁️", color: "bg-blue-50 border-blue-200 text-blue-700" },
            { id: "onedrive", name: "OneDrive", icon: "💾", color: "bg-sky-50 border-sky-200 text-sky-700" },
          ].map((svc) => (
            <div key={svc.id} className={`p-4 rounded-xl border ${svc.color} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{svc.icon}</span>
                <div>
                  <div className="font-medium text-sm">{svc.name}</div>
                  <div className="text-xs opacity-70">حفظ تلقائي ومزامنة</div>
                </div>
              </div>
              <button className="bg-white px-3 py-1.5 rounded-lg text-xs shadow-sm hover:shadow-md transition-all">ربط</button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Share Link Generator */}
      <SectionCard title="مولّد رابط المشاركة">
        <p className="text-sm text-slate-500 mb-3">أنشئ رابطاً فريداً لمشاركة عرضك مع الآخرين</p>
        <button
          onClick={() => setShareLink(`https://rasid.app/p/${Date.now().toString(36)}`)}
          className="bg-gradient-to-l from-indigo-600 to-purple-500 text-white px-6 py-2.5 rounded-xl text-sm hover:shadow-md"
        >
          إنشاء رابط مشاركة
        </button>
        {shareLink && (
          <div className="mt-3 flex items-center gap-2 bg-slate-50 rounded-xl p-3">
            <input type="text" readOnly value={shareLink} className="flex-1 bg-transparent text-sm font-mono outline-none" dir="ltr" />
            <button
              onClick={() => navigator.clipboard?.writeText(shareLink)}
              className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-700"
            >
              نسخ
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 6: COLLAB — التعاون
// ═══════════════════════════════════════════════════════════════

function CollabTab() {
  const [comments, setComments] = useState<Array<{ id: string; author: string; text: string; slide: number; timestamp: string }>>([
    { id: "c1", author: "أحمد", text: "يرجى تعديل الألوان في الشريحة الثالثة لتتوافق مع الهوية البصرية", slide: 3, timestamp: "2026-03-17T10:30:00Z" },
    { id: "c2", author: "سارة", text: "أضيفوا رسم بياني لإحصائيات الربع الأول", slide: 5, timestamp: "2026-03-17T11:15:00Z" },
    { id: "c3", author: "محمد", text: "ممتاز! الشريحة الأولى جذابة جداً", slide: 1, timestamp: "2026-03-17T12:00:00Z" },
  ]);
  const [newComment, setNewComment] = useState("");
  const [newCommentSlide, setNewCommentSlide] = useState(1);
  const [permLevel, setPermLevel] = useState<"view" | "comment" | "edit">("comment");
  const [passwordProtected, setPasswordProtected] = useState(false);

  const commentMutation = trpc.presentationAddendum.deckCommentAdd.useMutation({
    onError: (err: any) => alert("خطأ في إضافة التعليق: " + (err?.message || "غير معروف")),
  });

  const addComment = useCallback(() => {
    if (!newComment.trim()) return;
    const comment = {
      id: `c-${Date.now()}`,
      author: "أنت",
      text: newComment,
      slide: newCommentSlide,
      timestamp: new Date().toISOString(),
    };
    setComments((prev) => [...prev, comment]);
    try {
      commentMutation.mutate({ deck_id: "deck-test-001", slide_ref: `slide-${newCommentSlide}`, text: newComment, author: "current-user" });
    } catch { /* route not yet connected */ }
    setNewComment("");
  }, [newComment, newCommentSlide, commentMutation]);

  const TEAM_MEMBERS = [
    { name: "أحمد الغامدي", role: "مالك", avatar: "🧑‍💼", status: "متصل" },
    { name: "سارة العتيبي", role: "محرر", avatar: "👩‍💻", status: "متصل" },
    { name: "محمد القحطاني", role: "معلّق", avatar: "👨‍🎨", status: "غير متصل" },
    { name: "نورة الدوسري", role: "مشاهد", avatar: "👩‍🔬", status: "غير متصل" },
  ];

  const ACTIVITY_LOG = [
    { action: "تعديل الشريحة 3", user: "أحمد", time: "منذ 5 دقائق", type: "edit" },
    { action: "إضافة تعليق", user: "سارة", time: "منذ 15 دقيقة", type: "comment" },
    { action: "تغيير القالب", user: "أحمد", time: "منذ ساعة", type: "template" },
    { action: "نشر العرض", user: "محمد", time: "منذ ساعتين", type: "publish" },
    { action: "إنشاء العرض", user: "أحمد", time: "أمس", type: "create" },
  ];

  return (
    <div className="space-y-4">
      {/* Comments */}
      <SectionCard title="التعليقات" badge={`${comments.length} تعليق`}>
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-slate-50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {c.author[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{c.author}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">شريحة {c.slide}</span>
                  <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="text-sm text-slate-600">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Add Comment */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="أضف تعليقاً..."
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <select value={newCommentSlide} onChange={(e) => setNewCommentSlide(Number(e.target.value))} className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white">
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>شريحة {i + 1}</option>
                ))}
              </select>
              <button onClick={addComment} className="bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-orange-700">إرسال</button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Activity Log */}
      <SectionCard title="سجل النشاط" badge="مباشر">
        <div className="space-y-2">
          {ACTIVITY_LOG.map((log, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
              <div className={`w-2 h-2 rounded-full ${
                log.type === "edit" ? "bg-blue-500" :
                log.type === "comment" ? "bg-amber-500" :
                log.type === "template" ? "bg-purple-500" :
                log.type === "publish" ? "bg-emerald-500" :
                "bg-slate-400"
              }`} />
              <div className="flex-1">
                <span className="text-sm">{log.action}</span>
                <span className="text-xs text-slate-400 mr-2">— {log.user}</span>
              </div>
              <span className="text-[10px] text-slate-400">{log.time}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Team Members */}
      <SectionCard title="أعضاء الفريق" badge={`${TEAM_MEMBERS.length} أعضاء`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TEAM_MEMBERS.map((member) => (
            <div key={member.name} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <span className="text-2xl">{member.avatar}</span>
              <div className="flex-1">
                <div className="text-sm font-medium">{member.name}</div>
                <div className="text-xs text-slate-400">{member.role}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                member.status === "متصل" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
              }`}>
                {member.status}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Sharing Settings */}
      <SectionCard title="إعدادات المشاركة">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">مستوى الصلاحية</label>
            <select value={permLevel} onChange={(e) => setPermLevel(e.target.value as any)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="view">مشاهدة فقط</option>
              <option value="comment">مشاهدة + تعليق</option>
              <option value="edit">تعديل كامل</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5 flex items-center gap-2">
              حماية بكلمة مرور
              <button onClick={() => setPasswordProtected(!passwordProtected)} className={`w-8 h-4 rounded-full relative transition-colors ${passwordProtected ? "bg-orange-500" : "bg-slate-300"}`}>
                <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow ${passwordProtected ? "right-0.5" : "left-0.5"}`} />
              </button>
            </label>
            {passwordProtected && (
              <input type="password" placeholder="كلمة المرور..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" />
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 7: ANALYTICS — التحليلات
// ═══════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [analyticsDeckId] = useState("deck-test-001");

  const analyticsQuery = trpc.presentationAddendum.deckAnalytics.useQuery(
    { deck_id: analyticsDeckId },
    { enabled: false }
  );

  const MOCK_METRICS = [
    { label: "إجمالي المشاهدات", value: "2,847", change: "+12%", trend: "up", icon: "👁️" },
    { label: "الزوار الفريدين", value: "1,203", change: "+8%", trend: "up", icon: "👤" },
    { label: "متوسط الوقت", value: "4:32", change: "-5%", trend: "down", icon: "⏱️" },
    { label: "معدل الإكمال", value: "68%", change: "+3%", trend: "up", icon: "✅" },
    { label: "المشاركات", value: "156", change: "+22%", trend: "up", icon: "🔗" },
    { label: "التحميلات", value: "89", change: "+15%", trend: "up", icon: "📥" },
  ];

  const SLIDE_ANALYTICS = [
    { slide: 1, title: "شريحة العنوان", views: 2847, avgTime: "0:15", dropoff: "2%" },
    { slide: 2, title: "المقدمة", views: 2789, avgTime: "0:42", dropoff: "2%" },
    { slide: 3, title: "المشكلة", views: 2654, avgTime: "1:08", dropoff: "5%" },
    { slide: 4, title: "الحل", views: 2501, avgTime: "1:25", dropoff: "6%" },
    { slide: 5, title: "البيانات والإحصائيات", views: 2298, avgTime: "1:52", dropoff: "8%" },
    { slide: 6, title: "خطة العمل", views: 2100, avgTime: "0:58", dropoff: "9%" },
    { slide: 7, title: "التكلفة والعائد", views: 1890, avgTime: "1:15", dropoff: "10%" },
    { slide: 8, title: "الخاتمة", views: 1753, avgTime: "0:30", dropoff: "7%" },
  ];

  const QUIZ_RESULTS = [
    { question: "ما هي الميزة الرئيسية للمنتج؟", correct: 78, total: 120 },
    { question: "كم يبلغ معدل النمو المتوقع؟", correct: 65, total: 120 },
    { question: "ما هو الجمهور المستهدف؟", correct: 92, total: 120 },
  ];

  return (
    <div className="space-y-4">
      {/* Overview Metrics */}
      <SectionCard title="نظرة عامة" badge="آخر 30 يوم">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MOCK_METRICS.map((m) => (
            <div key={m.label} className="bg-gradient-to-br from-white to-slate-50 rounded-xl p-4 border border-slate-100 text-center">
              <div className="text-xl mb-1">{m.icon}</div>
              <div className="text-xl font-bold text-slate-900">{m.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
              <div className={`text-[10px] mt-1 font-medium ${
                m.trend === "up" ? "text-emerald-600" : "text-red-600"
              }`}>
                {m.change}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Engagement Over Time (simulated chart) */}
      <SectionCard title="التفاعل عبر الزمن">
        <div className="h-48 flex items-end gap-1 px-2">
          {Array.from({ length: 30 }, (_, i) => {
            const h = 20 + Math.random() * 80;
            return (
              <div key={i} className="flex-1 group relative">
                <div
                  className="bg-gradient-to-t from-orange-500 to-amber-400 rounded-t transition-all hover:from-orange-600 hover:to-amber-500"
                  style={{ height: `${h}%` }}
                />
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  يوم {i + 1}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-2 px-2">
          <span>1 مارس</span>
          <span>15 مارس</span>
          <span>30 مارس</span>
        </div>
      </SectionCard>

      {/* Slide-by-Slide Analytics */}
      <SectionCard title="تحليلات الشرائح" badge={`${SLIDE_ANALYTICS.length} شريحة`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">#</th>
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">العنوان</th>
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">المشاهدات</th>
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">متوسط الوقت</th>
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">نسبة المغادرة</th>
                <th className="text-right py-2 px-3 text-xs text-slate-500 font-medium">التفاعل</th>
              </tr>
            </thead>
            <tbody>
              {SLIDE_ANALYTICS.map((s) => (
                <tr key={s.slide} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono text-xs text-slate-400">{s.slide}</td>
                  <td className="py-2.5 px-3 font-medium">{s.title}</td>
                  <td className="py-2.5 px-3">{s.views.toLocaleString("ar-SA")}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{s.avgTime}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs ${parseInt(s.dropoff) > 7 ? "text-red-600" : "text-emerald-600"}`}>{s.dropoff}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-gradient-to-l from-orange-500 to-amber-400 h-2 rounded-full" style={{ width: `${(s.views / 2847) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Quiz/Poll Results */}
      <SectionCard title="نتائج الاستبيانات" badge="تفاعلي">
        <div className="space-y-3">
          {QUIZ_RESULTS.map((q, i) => {
            const pct = Math.round((q.correct / q.total) * 100);
            return (
              <div key={i} className="p-3 rounded-xl bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{q.question}</span>
                  <span className={`text-xs font-bold ${pct >= 70 ? "text-emerald-600" : "text-amber-600"}`}>{pct}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${pct >= 70 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 mt-1">{q.correct} صحيح من {q.total} إجابة</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Server Analytics (if available) */}
      {analyticsQuery.data && (
        <SectionCard title="بيانات من الخادم">
          <JsonBlock data={analyticsQuery.data} />
        </SectionCard>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 8: INTEGRATIONS — التكاملات
// ═══════════════════════════════════════════════════════════════

function IntegrationsTab() {
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set(["notion", "google-drive"]));
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);

  const capabilitiesQuery = trpc.presentationAddendum.capabilities.useQuery(undefined, { enabled: false });

  const toggleConnection = useCallback((id: string) => {
    setConnectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const SCHEDULED_TASKS = [
    { name: "مزامنة مع Google Drive", frequency: "كل ساعة", status: "نشط", lastRun: "منذ 45 دقيقة" },
    { name: "نسخ احتياطي تلقائي", frequency: "يومياً", status: "نشط", lastRun: "منذ 12 ساعة" },
    { name: "إرسال تقرير أسبوعي", frequency: "أسبوعياً", status: "متوقف", lastRun: "منذ 5 أيام" },
  ];

  const WEBHOOK_EVENT_OPTIONS = [
    { value: "deck.created", label: "إنشاء عرض جديد" },
    { value: "deck.published", label: "نشر عرض" },
    { value: "deck.updated", label: "تحديث عرض" },
    { value: "comment.added", label: "إضافة تعليق" },
    { value: "export.completed", label: "اكتمال التصدير" },
  ];

  return (
    <div className="space-y-4">
      {/* Integration Cards */}
      <SectionCard title="التكاملات المتاحة" badge={`${INTEGRATIONS_LIST.length} تكامل`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS_LIST.map((intg) => {
            const isConnected = connectedIds.has(intg.id);
            return (
              <div key={intg.id} className={`p-4 rounded-2xl border-2 transition-all ${
                isConnected ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{intg.icon}</span>
                  {isConnected && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">متصل</span>}
                </div>
                <h4 className="font-bold text-sm">{intg.nameAr}</h4>
                <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{intg.name}</p>
                <p className="text-xs text-slate-500 mt-2">{intg.description}</p>
                <button
                  onClick={() => toggleConnection(intg.id)}
                  className={`mt-3 w-full py-2 rounded-xl text-xs font-medium transition-all ${
                    isConnected
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      : "bg-gradient-to-l from-orange-600 to-amber-500 text-white hover:shadow-md"
                  }`}
                >
                  {isConnected ? "قطع الاتصال" : "ربط"}
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Scheduled Tasks */}
      <SectionCard title="المهام المجدولة" badge={`${SCHEDULED_TASKS.length} مهمة`}>
        <div className="space-y-2">
          {SCHEDULED_TASKS.map((task, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${task.status === "نشط" ? "bg-emerald-500" : "bg-slate-300"}`} />
                <div>
                  <div className="text-sm font-medium">{task.name}</div>
                  <div className="text-[10px] text-slate-400">{task.frequency} · آخر تشغيل: {task.lastRun}</div>
                </div>
              </div>
              <button className={`text-xs px-3 py-1 rounded-lg ${
                task.status === "نشط" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
              }`}>
                {task.status === "نشط" ? "إيقاف" : "تفعيل"}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Webhook Configuration */}
      <SectionCard title="إعداد Webhook" badge="API">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">رابط Webhook</label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">الأحداث المفعّلة</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENT_OPTIONS.map((evt) => (
                <button
                  key={evt.value}
                  onClick={() => {
                    setWebhookEvents((prev) =>
                      prev.includes(evt.value) ? prev.filter((e) => e !== evt.value) : [...prev, evt.value]
                    );
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    webhookEvents.includes(evt.value)
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {evt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            disabled={!webhookUrl || webhookEvents.length === 0}
            className="bg-gradient-to-l from-orange-600 to-amber-500 text-white px-6 py-2.5 rounded-xl text-sm hover:shadow-md disabled:opacity-50"
          >
            حفظ إعداد Webhook
          </button>
        </div>
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 9: SETTINGS — التحكم والتفضيلات
// ═══════════════════════════════════════════════════════════════

function SettingsTab() {
  const [prompt, setPrompt] = useState("أنشئ عرض تقديمي عن الذكاء الاصطناعي في التعليم");
  const [language, setLanguage] = useState("ar");
  const [searchQuery, setSearchQuery] = useState("");
  const [level, setLevel] = useState<"deck" | "slide" | "element">("deck");

  // --- Existing tRPC routes ---
  const manifestQuery = trpc.presentationAddendum.controlManifestBuild.useQuery(
    { prompt, language },
    { enabled: !!prompt }
  );
  const visibleQuery = trpc.presentationAddendum.controlManifestVisible.useQuery(
    { level, prompt, language },
    { enabled: !!prompt }
  );
  const controlSearchQuery = trpc.presentationAddendum.controlManifestSearch.useQuery(
    { query: searchQuery, prompt, language },
    { enabled: !!searchQuery }
  );
  const intentQuery = trpc.presentationAddendum.intentInfer.useQuery(
    { prompt, language },
    { enabled: !!prompt }
  );
  const smartDefaultsQuery = trpc.presentationAddendum.smartDefaults.useQuery(
    { prompt, language },
    { enabled: !!prompt }
  );
  const prefsQuery = trpc.presentationAddendum.preferencesGet.useQuery({ userId: "test-user" });
  const prefsSaveMutation = trpc.presentationAddendum.preferencesSave.useMutation({
    onError: (err: any) => alert("خطأ في حفظ التفضيلات: " + (err?.message || "غير معروف")),
  });

  // --- Transform ---
  const [transformKind, setTransformKind] = useState("replace_style");
  const [newValue, setNewValue] = useState("modern-clean");
  const [deckId] = useState("deck-test-001");
  const [slideRef] = useState("slide-1");
  const [elementRef] = useState("element-title-1");

  const transformMutation = trpc.presentationAddendum.elementTransform.useMutation();

  const runTransform = useCallback(() => {
    transformMutation.mutate({
      deck_id: deckId,
      slide_ref: slideRef,
      element_ref: elementRef,
      transform_kind: transformKind,
      new_value: newValue,
    });
  }, [transformMutation, deckId, slideRef, elementRef, transformKind, newValue]);

  // --- Data Picker ---
  const [filePath, setFilePath] = useState("/tmp/sample.xlsx");
  const [sheetName, setSheetName] = useState("");
  const [columns, setColumns] = useState("");
  const [browseEnabled, setBrowseEnabled] = useState(false);

  const browseQuery = trpc.presentationAddendum.dataPickerBrowse.useQuery(
    { file_path: filePath, sheet_name: sheetName || undefined },
    { enabled: browseEnabled, retry: false }
  );

  const bindingMutation = trpc.presentationAddendum.dataBindingApply.useMutation();

  // --- Dashboard ---
  const dashMutation = trpc.presentationAddendum.dashboardSlideGenerate.useMutation();

  // --- Literal ---
  const [inputText, setInputText] = useState("بسم الله الرحمن الرحيم — خطة العمل الاستراتيجية 2026");
  const [outputText, setOutputText] = useState("بسم الله الرحمن الرحيم — خطة العمل الاستراتيجية 2026");

  const hashQuery = trpc.presentationAddendum.literalHash.useQuery(
    { text: inputText },
    { enabled: !!inputText }
  );
  const verifyQuery = trpc.presentationAddendum.literalVerify.useQuery(
    { input_text: inputText, output_text: outputText },
    { enabled: !!inputText && !!outputText }
  );

  return (
    <div className="space-y-4">
      {/* Prompt Input */}
      <SectionCard title="الأمر النصي والسياق">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm flex-1 min-w-[200px]"
            placeholder="اكتب أمرك هنا..."
          />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
      </SectionCard>

      {/* Intent Inference */}
      <SectionCard title="استنتاج النية" badge="DETERMINISTIC">
        {intentQuery.isLoading && <LoadingSpinner text="جاري التحليل..." />}
        {intentQuery.data && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { key: "purpose", label: "الغرض" },
                { key: "audience", label: "الجمهور" },
                { key: "tone", label: "الأسلوب" },
                { key: "domain", label: "المجال" },
              ].map((f) => (
                <div key={f.key} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3 border border-slate-100">
                  <div className="text-xs text-slate-400">{f.label}</div>
                  <div className="font-medium text-sm mt-1">{(intentQuery.data as any)[f.key]}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {intentQuery.data.keywords.map((kw: string, i: number) => (
                <span key={i} className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">{kw}</span>
              ))}
            </div>
            <JsonBlock data={intentQuery.data} />
          </div>
        )}
      </SectionCard>

      {/* Smart Defaults */}
      <SectionCard title="الإعدادات الذكية التلقائية" badge="AUTO">
        {smartDefaultsQuery.isLoading && <LoadingSpinner text="جاري الحساب..." />}
        {smartDefaultsQuery.data && <JsonBlock data={smartDefaultsQuery.data} />}
      </SectionCard>

      {/* Control Manifest */}
      <SectionCard title="مانيفست التحكم" badge={`${manifestQuery.data ? Object.keys(manifestQuery.data).length : 0} إعداد`}>
        {manifestQuery.isLoading && <LoadingSpinner text="جاري البناء..." />}
        {manifestQuery.data && <JsonBlock data={manifestQuery.data} />}
      </SectionCard>

      {/* Visible Controls */}
      <SectionCard title="التحكمات المرئية (Progressive Disclosure)">
        <div className="flex gap-2 mb-3">
          {(["deck", "slide", "element"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${level === l ? "bg-gradient-to-l from-orange-600 to-amber-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {l === "deck" ? "العرض" : l === "slide" ? "الشريحة" : "العنصر"}
            </button>
          ))}
        </div>
        {visibleQuery.data && <JsonBlock data={visibleQuery.data} />}
      </SectionCard>

      {/* Control Search */}
      <SectionCard title="بحث في التحكمات">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث عن إعداد..."
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-full mb-3"
        />
        {controlSearchQuery.data && <JsonBlock data={controlSearchQuery.data} />}
      </SectionCard>

      {/* Preferences */}
      <SectionCard title="تفضيلات المستخدم">
        {prefsQuery.data && <JsonBlock data={prefsQuery.data} />}
        <button
          onClick={() => {
            try {
              prefsSaveMutation.mutate({ userId: "test-user", preferences: { theme: "dark", language: "ar" } });
            } catch { /* route not yet connected */ }
          }}
          disabled={prefsSaveMutation.isPending}
          className="mt-3 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-700 disabled:opacity-50"
        >
          حفظ التفضيلات
        </button>
      </SectionCard>

      {/* Transform */}
      <SectionCard title="تحويل العناصر" badge="9 أنواع">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">نوع التحويل</label>
            <select value={transformKind} onChange={(e) => setTransformKind(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full bg-white">
              {TRANSFORM_KINDS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">القيمة الجديدة</label>
            <input type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full" />
          </div>
        </div>
        <button onClick={runTransform} disabled={transformMutation.isPending} className="bg-orange-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-orange-700 disabled:opacity-50">
          {transformMutation.isPending ? "جاري التحويل..." : "تنفيذ التحويل"}
        </button>
        {transformMutation.data && (
          <div className="mt-4">
            <StatusBadge ok={transformMutation.data.applied} />
            <JsonBlock data={transformMutation.data} />
          </div>
        )}
        {transformMutation.error && <p className="text-red-500 text-sm mt-3">{transformMutation.error.message}</p>}
      </SectionCard>

      {/* Data Picker */}
      <SectionCard title="منتقي البيانات" badge="XLSX">
        <div className="flex gap-3 mb-4">
          <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm flex-1" dir="ltr" />
          <button onClick={() => setBrowseEnabled(true)} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-orange-700">استعراض</button>
        </div>
        {browseQuery.isLoading && <LoadingSpinner text="جاري القراءة..." />}
        {browseQuery.data && <JsonBlock data={browseQuery.data} />}
        {browseQuery.error && <p className="text-red-500 text-sm">{browseQuery.error.message}</p>}
      </SectionCard>

      {/* Dashboard */}
      <SectionCard title="لوحة المعلومات" badge="KPI">
        <button
          onClick={() => {
            dashMutation.mutate({
              deck_id: "deck-test-001",
              title: "لوحة مؤشرات الأداء — الربع الأول 2026",
              kpi_metrics: [
                { label: "الإيرادات", value: "12.5M", trend: "up", target: 15000000 },
                { label: "العملاء الجدد", value: 3420, trend: "up", target: 4000 },
              ],
              mini_charts: [
                { chart_type: "line", label: "الإيرادات الشهرية", data_points: [8.2, 9.1, 10.3, 11.0, 11.8, 12.5] },
              ],
              filter_controls: [
                { filter_id: "period", label: "الفترة", type: "dropdown", options: ["Q1", "Q2", "Q3", "Q4"] },
              ],
            });
          }}
          disabled={dashMutation.isPending}
          className="bg-orange-600 text-white px-6 py-2 rounded-xl text-sm hover:bg-orange-700 disabled:opacity-50"
        >
          {dashMutation.isPending ? "جاري التوليد..." : "توليد لوحة معلومات"}
        </button>
        {dashMutation.data && (
          <div className="mt-3">
            <StatusBadge ok={true} />
            <JsonBlock data={dashMutation.data} />
          </div>
        )}
      </SectionCard>

      {/* Literal Verification */}
      <SectionCard title="التحقق الحرفي" badge="SHA-256">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">النص الأصلي</label>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} rows={3} className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full resize-none" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">النص الناتج</label>
            <textarea value={outputText} onChange={(e) => setOutputText(e.target.value)} rows={3} className="border border-slate-200 rounded-xl px-3 py-2 text-sm w-full resize-none" />
          </div>
        </div>
        {hashQuery.data && (
          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <div className="text-xs text-slate-400 mb-1">SHA-256 Hash</div>
            <div className="font-mono text-xs text-slate-700 break-all" dir="ltr">{hashQuery.data.hash}</div>
          </div>
        )}
        {verifyQuery.data && (
          <div className={`rounded-xl p-4 ${verifyQuery.data.passed ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            <StatusBadge ok={verifyQuery.data.passed} />
            <span className="text-sm font-medium mr-2">{verifyQuery.data.passed ? "مطابق — الأمانة الحرفية محققة" : "غير مطابق"}</span>
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => setOutputText(inputText.slice(0, -1) + "!")} className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-red-600">تغيير آخر حرف</button>
          <button onClick={() => setOutputText(inputText)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm hover:bg-emerald-700">إعادة المطابقة</button>
        </div>
      </SectionCard>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// TAB 10: TOOLS — الأدوات
// ═══════════════════════════════════════════════════════════════

function ToolsTab() {
  const toolsQuery = trpc.presentationAddendum.toolSchemas.useQuery();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <SectionCard title="سجل الأدوات المسجلة" badge={`${toolsQuery.data?.length || 0} أداة`}>
        {toolsQuery.isLoading && <LoadingSpinner text="جاري تحميل الأدوات..." />}
        {toolsQuery.data && (
          <div className="space-y-2">
            {toolsQuery.data.map((tool: any) => (
              <div key={tool.name} className="border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-right hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${tool.deterministic ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-medium text-sm">{tool.name}</span>
                    <span className="text-xs text-slate-400">{tool.description?.slice(0, 60)}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tool.permissions?.map((p: string, i: number) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                    <span className="text-slate-400 text-sm">{expandedTool === tool.name ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedTool === tool.name && (
                  <div className="border-t border-slate-100 p-4 bg-gradient-to-br from-slate-50 to-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">مدخلات (Input Schema)</div>
                        <JsonBlock data={tool.input_schema} />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">مخرجات (Output Schema)</div>
                        <JsonBlock data={tool.output_schema} />
                      </div>
                    </div>
                    {tool.evidence_hooks && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-slate-500 mb-1">Evidence Hooks</div>
                        <JsonBlock data={tool.evidence_hooks} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
