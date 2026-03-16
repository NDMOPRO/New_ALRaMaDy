/* ═══════════════════════════════════════════════════════════════
   واجهة اختبار محرك العروض — ADDENDUM
   كتالوج ∞ | تحكم | تحويلات | بيانات | لوحات | تحقق حرفي | أدوات
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback } from "react";
import { trpc } from "../lib/trpc";

// ─── Types ────────────────────────────────────────────────────

type TabId = "catalog" | "controls" | "transforms" | "data" | "dashboard" | "literal" | "tools";

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "catalog", label: "الكتالوج والخيارات", icon: "🎨" },
  { id: "controls", label: "التحكم والتفضيلات", icon: "⚙️" },
  { id: "transforms", label: "التحويلات", icon: "🔄" },
  { id: "data", label: "منتقي البيانات", icon: "📊" },
  { id: "dashboard", label: "لوحات المعلومات", icon: "📈" },
  { id: "literal", label: "التحقق الحرفي", icon: "🔐" },
  { id: "tools", label: "الأدوات المسجلة", icon: "🛠️" },
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
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 mb-4">
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

// ─── Main Component ───────────────────────────────────────────

export default function PresentationAddendumTest() {
  const [activeTab, setActiveTab] = useState<TabId>("catalog");

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-slate-50 to-slate-100" dir="rtl">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-slate-900">واجهة اختبار محرك العروض — ADDENDUM</h1>
          <p className="text-sm text-slate-500 mt-1">تحكم ∞ + خيارات ∞ — اختبار جميع الوظائف الجديدة</p>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "catalog" && <CatalogTab />}
        {activeTab === "controls" && <ControlsTab />}
        {activeTab === "transforms" && <TransformsTab />}
        {activeTab === "data" && <DataTab />}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "literal" && <LiteralTab />}
        {activeTab === "tools" && <ToolsTab />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: CATALOG
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
    { asset_id: selectedAssetId, count: 6, direction: variantDirection },
    { enabled: !!selectedAssetId }
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <SectionCard title="إحصائيات الكتالوج" badge="LIVE">
        {statsQuery.isLoading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}
        {statsQuery.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(statsQuery.data).map(([k, v]) => (
              <div key={k} className="bg-slate-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">{typeof v === "number" ? v.toLocaleString("ar-SA") : String(v)}</div>
                <div className="text-xs text-slate-500 mt-1">{k}</div>
              </div>
            ))}
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
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
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
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
        </div>

        {searchQuery.isLoading && <p className="text-slate-400 text-sm">جاري البحث...</p>}
        {searchQuery.data && (
          <>
            <p className="text-sm text-slate-500 mb-3">عدد النتائج: {searchQuery.data.total}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchQuery.data.assets.map((asset: any) => (
                <div
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${
                    selectedAssetId === asset.id ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"
                  }`}
                >
                  {/* SVG/CSS preview */}
                  {asset.preview_svg && (
                    <div
                      className="h-24 rounded-lg overflow-hidden mb-2 bg-slate-50 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: asset.preview_svg }}
                    />
                  )}
                  {asset.preview_css && !asset.preview_svg && (
                    <div
                      className="h-24 rounded-lg overflow-hidden mb-2"
                      style={(() => {
                        try {
                          const styles: Record<string, string> = {};
                          asset.preview_css.split(";").forEach((s: string) => {
                            const [k, v] = s.split(":");
                            if (k && v) styles[k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())] = v.trim();
                          });
                          return styles;
                        } catch { return {}; }
                      })()}
                    />
                  )}
                  <div className="font-medium text-sm">{asset.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{asset.family} · {asset.tags?.join("، ")}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* Families */}
      <SectionCard title="عائلات الأصول">
        {familiesQuery.data && (
          <div className="flex flex-wrap gap-2">
            {familiesQuery.data.map((f: string) => (
              <span key={f} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">{f}</span>
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
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="more_like_this">مشابه أكثر</option>
              <option value="different_direction">اتجاه مختلف</option>
              <option value="simpler">أبسط</option>
              <option value="more_complex">أعقد</option>
            </select>
            <div className="text-sm text-slate-500 self-center">الأصل: {selectedAssetId}</div>
          </div>
          {variantsQuery.isLoading && <p className="text-slate-400 text-sm">جاري التوليد...</p>}
          {variantsQuery.data && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {variantsQuery.data.variants.map((v: any) => (
                <div key={v.variant_id} className="border border-slate-200 rounded-xl p-3 bg-white">
                  {v.preview_svg && (
                    <div
                      className="h-20 rounded-lg overflow-hidden mb-2 bg-slate-50 flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: v.preview_svg }}
                    />
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
// TAB 2: CONTROLS & PREFERENCES
// ═══════════════════════════════════════════════════════════════

function ControlsTab() {
  const [prompt, setPrompt] = useState("أنشئ عرض تقديمي عن الذكاء الاصطناعي في التعليم");
  const [language, setLanguage] = useState("ar");
  const [searchQuery, setSearchQuery] = useState("");
  const [level, setLevel] = useState<"deck" | "slide" | "element">("deck");

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

  return (
    <div className="space-y-4">
      {/* Prompt Input */}
      <SectionCard title="الأمر النصي">
        <div className="flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
            placeholder="اكتب أمرك هنا..."
          />
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
      </SectionCard>

      {/* Intent Inference */}
      <SectionCard title="استنتاج النية" badge="DETERMINISTIC">
        {intentQuery.isLoading && <p className="text-slate-400 text-sm">جاري التحليل...</p>}
        {intentQuery.data && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">الغرض</div>
                <div className="font-medium text-sm mt-1">{intentQuery.data.purpose}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">الجمهور</div>
                <div className="font-medium text-sm mt-1">{intentQuery.data.audience}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">الأسلوب</div>
                <div className="font-medium text-sm mt-1">{intentQuery.data.tone}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="text-xs text-slate-400">المجال</div>
                <div className="font-medium text-sm mt-1">{intentQuery.data.domain}</div>
              </div>
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
        {smartDefaultsQuery.isLoading && <p className="text-slate-400 text-sm">جاري الحساب...</p>}
        {smartDefaultsQuery.data && <JsonBlock data={smartDefaultsQuery.data} />}
      </SectionCard>

      {/* Control Manifest */}
      <SectionCard title="مانيفست التحكم" badge={`${manifestQuery.data ? Object.keys(manifestQuery.data).length : 0} إعداد`}>
        {manifestQuery.isLoading && <p className="text-slate-400 text-sm">جاري البناء...</p>}
        {manifestQuery.data && <JsonBlock data={manifestQuery.data} />}
      </SectionCard>

      {/* Visible Controls */}
      <SectionCard title="التحكمات المرئية (Progressive Disclosure)">
        <div className="flex gap-2 mb-3">
          {(["deck", "slide", "element"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-3 py-1.5 rounded-lg text-sm ${level === l ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}
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
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full mb-3"
        />
        {controlSearchQuery.data && <JsonBlock data={controlSearchQuery.data} />}
      </SectionCard>

      {/* Preferences */}
      <SectionCard title="تفضيلات المستخدم">
        {prefsQuery.data && <JsonBlock data={prefsQuery.data} />}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: TRANSFORMS
// ═══════════════════════════════════════════════════════════════

function TransformsTab() {
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

  return (
    <div className="space-y-4">
      <SectionCard title="تحويل العناصر" badge="9 أنواع">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">نوع التحويل</label>
            <select
              value={transformKind}
              onChange={(e) => setTransformKind(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full bg-white"
            >
              {TRANSFORM_KINDS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">القيمة الجديدة</label>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Deck:</span> {deckId}</div>
          <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Slide:</span> {slideRef}</div>
          <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">Element:</span> {elementRef}</div>
        </div>

        <button
          onClick={runTransform}
          disabled={transformMutation.isPending}
          className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-orange-700 transition-colors disabled:opacity-50"
        >
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: DATA PICKER
// ═══════════════════════════════════════════════════════════════

function DataTab() {
  const [filePath, setFilePath] = useState("/tmp/sample.xlsx");
  const [sheetName, setSheetName] = useState("");
  const [columns, setColumns] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [browseEnabled, setBrowseEnabled] = useState(false);
  const [selectEnabled, setSelectEnabled] = useState(false);

  const browseQuery = trpc.presentationAddendum.dataPickerBrowse.useQuery(
    { file_path: filePath, sheet_name: sheetName || undefined },
    { enabled: browseEnabled, retry: false }
  );

  const selectQuery = trpc.presentationAddendum.dataPickerSelect.useQuery(
    {
      file_path: filePath,
      sheet_name: sheetName,
      columns: columns ? columns.split(",").map((c) => c.trim()) : [],
      sort_by: sortBy || undefined,
      group_by: groupBy || undefined,
    },
    { enabled: selectEnabled && !!sheetName, retry: false }
  );

  const bindingMutation = trpc.presentationAddendum.dataBindingApply.useMutation();

  return (
    <div className="space-y-4">
      {/* Browse */}
      <SectionCard title="استعراض ملف Excel" badge="XLSX">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm flex-1"
            placeholder="مسار الملف..."
            dir="ltr"
          />
          <button
            onClick={() => setBrowseEnabled(true)}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700"
          >
            استعراض
          </button>
        </div>
        {browseQuery.isLoading && <p className="text-slate-400 text-sm">جاري القراءة...</p>}
        {browseQuery.data && <JsonBlock data={browseQuery.data} />}
        {browseQuery.error && <p className="text-red-500 text-sm">{browseQuery.error.message}</p>}
      </SectionCard>

      {/* Select Data */}
      <SectionCard title="اختيار البيانات">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">اسم الورقة</label>
            <input
              type="text"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">الأعمدة (مفصولة بفاصلة)</label>
            <input
              type="text"
              value={columns}
              onChange={(e) => setColumns(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">ترتيب حسب</label>
            <input
              type="text"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">تجميع حسب</label>
            <input
              type="text"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full"
              dir="ltr"
            />
          </div>
        </div>
        <button
          onClick={() => setSelectEnabled(true)}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700"
        >
          جلب البيانات
        </button>
        {selectQuery.isLoading && <p className="text-slate-400 text-sm mt-3">جاري الجلب...</p>}
        {selectQuery.data && <JsonBlock data={selectQuery.data} />}
        {selectQuery.error && <p className="text-red-500 text-sm mt-3">{selectQuery.error.message}</p>}
      </SectionCard>

      {/* Data Binding */}
      <SectionCard title="ربط البيانات بعنصر">
        <button
          onClick={() => {
            bindingMutation.mutate({
              deck_id: "deck-test-001",
              slide_ref: "slide-1",
              element_ref: "table-1",
              target_type: "table",
              data_source: { file_path: filePath, sheet_name: sheetName || "Sheet1", columns: columns ? columns.split(",").map((c) => c.trim()) : ["A", "B"] },
            });
          }}
          disabled={bindingMutation.isPending}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
        >
          {bindingMutation.isPending ? "جاري الربط..." : "ربط البيانات بجدول"}
        </button>
        {bindingMutation.data && (
          <div className="mt-3">
            <StatusBadge ok={bindingMutation.data.bound} />
            <JsonBlock data={bindingMutation.data} />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: DASHBOARD
// ═══════════════════════════════════════════════════════════════

function DashboardTab() {
  const dashMutation = trpc.presentationAddendum.dashboardSlideGenerate.useMutation();

  const generateDashboard = useCallback(() => {
    dashMutation.mutate({
      deck_id: "deck-test-001",
      title: "لوحة مؤشرات الأداء — الربع الأول 2026",
      kpi_metrics: [
        { label: "الإيرادات", value: "12.5M", trend: "up", target: 15000000 },
        { label: "العملاء الجدد", value: 3420, trend: "up", target: 4000 },
        { label: "معدل الرضا", value: "94%", trend: "flat" },
        { label: "وقت الاستجابة", value: "1.2s", trend: "down" },
      ],
      mini_charts: [
        { chart_type: "line", label: "الإيرادات الشهرية", data_points: [8.2, 9.1, 10.3, 11.0, 11.8, 12.5] },
        { chart_type: "bar", label: "العملاء حسب المنطقة", data_points: [450, 380, 620, 290, 510] },
        { chart_type: "pie", label: "توزيع المنتجات", data_points: [35, 25, 20, 15, 5] },
      ],
      filter_controls: [
        { filter_id: "period", label: "الفترة الزمنية", type: "dropdown", options: ["الربع الأول", "الربع الثاني", "الربع الثالث", "الربع الرابع"] },
        { filter_id: "region", label: "المنطقة", type: "dropdown", options: ["الرياض", "جدة", "الدمام", "مكة"] },
        { filter_id: "active_only", label: "النشطين فقط", type: "toggle" },
      ],
    });
  }, [dashMutation]);

  return (
    <div className="space-y-4">
      <SectionCard title="توليد شريحة لوحة المعلومات" badge="KPI + Charts + Filters">
        <p className="text-sm text-slate-500 mb-4">
          اضغط الزر لتوليد شريحة لوحة معلومات كاملة مع بطاقات KPI، رسوم بيانية مصغرة، وعناصر تصفية
        </p>
        <button
          onClick={generateDashboard}
          disabled={dashMutation.isPending}
          className="bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
        >
          {dashMutation.isPending ? "جاري التوليد..." : "توليد لوحة المعلومات"}
        </button>

        {dashMutation.data && (
          <div className="mt-4">
            <StatusBadge ok={true} />

            {/* KPI Cards Preview */}
            <h4 className="text-sm font-medium mt-4 mb-2">بطاقات KPI</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {dashMutation.data.elements
                .filter((el: any) => el.type === "kpi_card")
                .map((el: any, i: number) => (
                  <div key={i} className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4 text-center">
                    <div className="text-xs text-slate-400">{el.content.label}</div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{el.content.value}</div>
                    {el.content.trend && (
                      <div className={`text-xs mt-1 ${el.content.trend === "up" ? "text-emerald-600" : el.content.trend === "down" ? "text-red-600" : "text-slate-400"}`}>
                        {el.content.trend === "up" ? "↑" : el.content.trend === "down" ? "↓" : "→"}
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Mini Charts */}
            <h4 className="text-sm font-medium mt-4 mb-2">رسوم بيانية مصغرة</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dashMutation.data.elements
                .filter((el: any) => el.type === "mini_chart")
                .map((el: any, i: number) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                    <div className="text-xs text-slate-500 mb-2">{el.content.label} ({el.content.chart_type})</div>
                    {/* Simple bar visualization */}
                    <div className="flex items-end gap-1 h-16">
                      {el.content.data_points?.map((d: number, j: number) => (
                        <div
                          key={j}
                          className="bg-orange-400 rounded-t flex-1 min-w-[4px]"
                          style={{ height: `${(d / Math.max(...el.content.data_points)) * 100}%` }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            {/* Filter Controls */}
            <h4 className="text-sm font-medium mt-4 mb-2">عناصر التصفية</h4>
            <div className="flex flex-wrap gap-3">
              {dashMutation.data.elements
                .filter((el: any) => el.type === "filter_control")
                .map((el: any, i: number) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-500">{el.content.label}</span>
                    {el.content.type === "dropdown" && (
                      <select className="block mt-1 text-sm border border-slate-200 rounded px-2 py-1 bg-white">
                        {el.content.options?.map((opt: string, j: number) => (
                          <option key={j}>{opt}</option>
                        ))}
                      </select>
                    )}
                    {el.content.type === "toggle" && (
                      <div className="mt-1 w-10 h-5 bg-orange-400 rounded-full relative cursor-pointer">
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 right-0.5 shadow" />
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Slide States */}
            <h4 className="text-sm font-medium mt-4 mb-2">حالات الشريحة ({dashMutation.data.slide_states?.length || 0})</h4>
            <JsonBlock data={dashMutation.data.slide_states} />

            {/* Full Response */}
            <details className="mt-3">
              <summary className="text-xs text-slate-400 cursor-pointer">الاستجابة الكاملة</summary>
              <JsonBlock data={dashMutation.data} />
            </details>
          </div>
        )}
        {dashMutation.error && <p className="text-red-500 text-sm mt-3">{dashMutation.error.message}</p>}
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 6: LITERAL VERIFICATION
// ═══════════════════════════════════════════════════════════════

function LiteralTab() {
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
      <SectionCard title="التحقق من الأمانة الحرفية" badge="SHA-256">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">النص الأصلي (المدخل)</label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">النص الناتج</label>
            <textarea
              value={outputText}
              onChange={(e) => setOutputText(e.target.value)}
              rows={4}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-full resize-none"
            />
          </div>
        </div>

        {/* Hash */}
        {hashQuery.data && (
          <div className="bg-slate-50 rounded-xl p-3 mb-3">
            <div className="text-xs text-slate-400 mb-1">SHA-256 Hash للنص المدخل</div>
            <div className="font-mono text-xs text-slate-700 break-all" dir="ltr">{hashQuery.data.hash}</div>
          </div>
        )}

        {/* Verification Result */}
        {verifyQuery.data && (
          <div className={`rounded-xl p-4 ${verifyQuery.data.passed ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
            <div className="flex items-center gap-3 mb-3">
              <StatusBadge ok={verifyQuery.data.passed} />
              <span className="text-sm font-medium">{verifyQuery.data.passed ? "النص مطابق تماماً — الأمانة الحرفية محققة" : "النص غير مطابق — يوجد اختلاف"}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">hash المدخل</div>
                <div className="font-mono text-[10px] text-slate-600 break-all" dir="ltr">{verifyQuery.data.hash_in}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">hash الناتج</div>
                <div className="font-mono text-[10px] text-slate-600 break-all" dir="ltr">{verifyQuery.data.hash_out}</div>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Quick test: mismatch */}
      <SectionCard title="اختبار سريع — كشف التغيير">
        <p className="text-sm text-slate-500 mb-3">جرّب تغيير حرف واحد في النص الناتج لترى كيف يكتشف النظام الفرق</p>
        <button
          onClick={() => setOutputText(inputText.slice(0, -1) + "!")}
          className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 ml-2"
        >
          تغيير آخر حرف
        </button>
        <button
          onClick={() => setOutputText(inputText)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
        >
          إعادة المطابقة
        </button>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 7: TOOLS
// ═══════════════════════════════════════════════════════════════

function ToolsTab() {
  const toolsQuery = trpc.presentationAddendum.toolSchemas.useQuery();
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <SectionCard title="سجل الأدوات المسجلة" badge={`${toolsQuery.data?.length || 0} أداة`}>
        {toolsQuery.isLoading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}
        {toolsQuery.data && (
          <div className="space-y-2">
            {toolsQuery.data.map((tool: any) => (
              <div key={tool.name} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
                  className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${tool.deterministic ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-medium text-sm">{tool.name}</span>
                    <span className="text-xs text-slate-400">{tool.description?.slice(0, 60)}...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tool.permissions?.map((p: string, i: number) => (
                      <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p}</span>
                    ))}
                    <span className="text-slate-400">{expandedTool === tool.name ? "▲" : "▼"}</span>
                  </div>
                </button>
                {expandedTool === tool.name && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
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
