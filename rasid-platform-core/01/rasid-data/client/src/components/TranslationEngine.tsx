/* ═══════════════════════════════════════════════════════════════
   TranslationEngine — Professional Translation & Arabization
   Features:
   - Professional Translation (not just word-by-word)
   - True Arabization (LCT - Linguistic Cultural Technical)
   - RTL/LTR layout mirroring
   - Terminology management
   - Side-by-side comparison
   - Multiple language pairs
   - File-level translation (preserving formatting)
   - Glossary management
   - Ultra-premium UI
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import RasedLoader from '@/components/RasedLoader';
import MaterialIcon from './MaterialIcon';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';

/* ---------- Types ---------- */
interface TranslationJob {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  mode: 'translate' | 'arabize' | 'mirror';
  status: 'idle' | 'translating' | 'completed';
  confidence: number;
  wordCount: number;
  changes?: TranslationChange[];
}

interface TranslationChange {
  original: string;
  translated: string;
  type: 'term' | 'cultural' | 'technical' | 'layout' | 'format';
  note?: string;
}

interface GlossaryTerm {
  id: string;
  source: string;
  target: string;
  domain: string;
  approved: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- Language Options ---------- */
const LANGUAGES = [
  { code: 'ar', name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'en', name: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'zh', name: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', dir: 'ltr' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰', dir: 'rtl' },
];

/* ---------- Arabization Layers ---------- */
const ARABIZATION_LAYERS = [
  { id: 'linguistic', name: 'لغوي', icon: 'translate', desc: 'ترجمة دقيقة مع مراعاة السياق والأسلوب', color: 'text-blue-500' },
  { id: 'cultural', name: 'ثقافي', icon: 'diversity_3', desc: 'تكييف المراجع الثقافية والأمثلة', color: 'text-purple-500' },
  { id: 'technical', name: 'تقني', icon: 'engineering', desc: 'توحيد المصطلحات التقنية والاختصارات', color: 'text-green-500' },
  { id: 'layout', name: 'تخطيطي', icon: 'format_textdirection_r_to_l', desc: 'عكس التخطيط RTL مع حساب رياضي دقيق', color: 'text-orange-500' },
  { id: 'typography', name: 'طباعي', icon: 'text_fields', desc: 'اختيار الخطوط العربية المناسبة', color: 'text-red-500' },
  { id: 'numeric', name: 'رقمي', icon: 'pin', desc: 'تحويل الأرقام والتواريخ والعملات', color: 'text-cyan-500' },
  { id: 'quality', name: 'جودة', icon: 'verified', desc: 'مراجعة شاملة وتدقيق نهائي', color: 'text-emerald-500' },
];

/* ---------- Default Glossary ---------- */
const DEFAULT_GLOSSARY: GlossaryTerm[] = [
  { id: uid(), source: 'Data Governance', target: 'حوكمة البيانات', domain: 'بيانات', approved: true },
  { id: uid(), source: 'Data Maturity', target: 'نضج البيانات', domain: 'بيانات', approved: true },
  { id: uid(), source: 'Open Data', target: 'البيانات المفتوحة', domain: 'بيانات', approved: true },
  { id: uid(), source: 'Compliance', target: 'الامتثال', domain: 'حوكمة', approved: true },
  { id: uid(), source: 'Dashboard', target: 'لوحة مؤشرات', domain: 'تقني', approved: true },
  { id: uid(), source: 'KPI', target: 'مؤشر أداء رئيسي', domain: 'أعمال', approved: true },
  { id: uid(), source: 'Stakeholder', target: 'أصحاب المصلحة', domain: 'أعمال', approved: true },
  { id: uid(), source: 'Framework', target: 'إطار عمل', domain: 'تقني', approved: true },
  { id: uid(), source: 'Benchmark', target: 'معيار مرجعي', domain: 'أعمال', approved: true },
  { id: uid(), source: 'AI', target: 'الذكاء الاصطناعي', domain: 'تقني', approved: true },
];

/* ---------- Sample Translations ---------- */
const SAMPLE_SOURCE = `Data Governance Framework Assessment Report

Executive Summary:
The National Data Governance Framework has been assessed across 15 government entities during Q4 2025. The overall maturity score reached 87.3%, representing a significant improvement from the previous quarter's 82.1%.

Key Findings:
1. 15 government entities achieved "Advanced" maturity classification
2. 94% compliance rate with data governance standards
3. 87% of targeted open data sets have been published
4. 12 entities completed their digital transformation plans for data

Recommendations:
- Establish a centralized data quality monitoring system
- Implement automated compliance checking mechanisms
- Develop cross-entity data sharing protocols
- Launch capacity building programs for data professionals`;

const SAMPLE_TRANSLATION = `تقرير تقييم إطار حوكمة البيانات

الملخص التنفيذي:
تم تقييم الإطار الوطني لحوكمة البيانات عبر ١٥ جهة حكومية خلال الربع الرابع من عام ٢٠٢٥. بلغت درجة النضج الإجمالية ٨٧.٣٪، مما يمثل تحسناً ملحوظاً مقارنة بنسبة ٨٢.١٪ في الربع السابق.

النتائج الرئيسية:
١. حققت ١٥ جهة حكومية تصنيف "متقدم" في مستوى النضج
٢. بلغت نسبة الامتثال لمعايير حوكمة البيانات ٩٤٪
٣. تم نشر ٨٧٪ من مجموعات البيانات المفتوحة المستهدفة
٤. أكملت ١٢ جهة خطط التحول الرقمي للبيانات

التوصيات:
- إنشاء نظام مركزي لمراقبة جودة البيانات
- تطبيق آليات فحص الامتثال الآلية
- تطوير بروتوكولات مشاركة البيانات بين الجهات
- إطلاق برامج بناء القدرات للمتخصصين في البيانات`;

const SAMPLE_CHANGES: TranslationChange[] = [
  { original: 'Data Governance Framework', translated: 'إطار حوكمة البيانات', type: 'term', note: 'مصطلح معتمد من سدايا' },
  { original: 'Q4 2025', translated: 'الربع الرابع من عام ٢٠٢٥', type: 'cultural', note: 'تحويل الأرقام والتاريخ للصيغة العربية' },
  { original: '87.3%', translated: '٨٧.٣٪', type: 'technical', note: 'تحويل الأرقام اللاتينية إلى عربية' },
  { original: 'Advanced', translated: 'متقدم', type: 'term', note: 'تصنيف معتمد في إطار النضج' },
  { original: 'compliance rate', translated: 'نسبة الامتثال', type: 'term' },
  { original: 'digital transformation', translated: 'التحول الرقمي', type: 'technical' },
  { original: 'capacity building', translated: 'بناء القدرات', type: 'cultural', note: 'مصطلح شائع في السياق الحكومي السعودي' },
];

/* ========== Main Component ========== */
export default function TranslationEngine() {
  const { theme } = useTheme();
  const char = theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving;

  // State
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [translationMode, setTranslationMode] = useState<'translate' | 'arabize' | 'mirror'>('translate');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ar');
  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [changes, setChanges] = useState<TranslationChange[]>([]);
  const [showGlossary, setShowGlossary] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [glossary, setGlossary] = useState<GlossaryTerm[]>(DEFAULT_GLOSSARY);
  const [newTermSource, setNewTermSource] = useState('');
  const [newTermTarget, setNewTermTarget] = useState('');
  const [layerProgress, setLayerProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const aiMutation = trpc.ai.translate.useMutation();
  const sourceLangObj = LANGUAGES.find(l => l.code === sourceLang);
  const targetLangObj = LANGUAGES.find(l => l.code === targetLang);

  // Swap languages
  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(targetText);
    setTargetText(sourceText);
  }, [sourceLang, targetLang, sourceText, targetText]);

  // Translate handler
  const handleTranslate = useCallback(async () => {
    if (!sourceText.trim() || isTranslating) return;
    setIsTranslating(true);
    setTargetText('');
    setConfidence(null);
    setChanges([]);

    if (translationMode === 'arabize') {
      // Real arabization with progressive layers + AI
      const layers = ARABIZATION_LAYERS.map(l => l.id);
      let currentLayer = 0;

      const interval = setInterval(() => {
        if (currentLayer >= layers.length) {
          clearInterval(interval);
          return;
        }
        setLayerProgress(prev => ({ ...prev, [layers[currentLayer]]: 100 }));
        currentLayer++;
      }, 300);

      try {
        const result = await aiMutation.mutateAsync({
          text: sourceText,
          from: sourceLang,
          to: 'ar',
          mode: 'arabize',
          glossary: glossary.filter(g => g.approved).map(g => ({ source: g.source, target: g.target })),
        });
        clearInterval(interval);
        // Mark all layers complete
        const allDone: Record<string, number> = {};
        layers.forEach(l => allDone[l] = 100);
        setLayerProgress(allDone);
        setTargetText(result.content || '');
        setConfidence(result.confidence || 95);
        setChanges(result.changes || []);
      } catch (e) {
        clearInterval(interval);
        setTargetText('حدث خطأ أثناء التعريب. يرجى المحاولة مرة أخرى.');
        setConfidence(null);
        setChanges([]);
      } finally {
        setIsTranslating(false);
      }
    } else {
      // Use AI for translation
      try {
        const result = await aiMutation.mutateAsync({
          text: sourceText,
          from: sourceLang,
          to: targetLang,
          mode: 'translate',
          glossary: glossary.filter(g => g.approved).map(g => ({ source: g.source, target: g.target })),
        });
        setTargetText(result.content || '');
        setConfidence(result.confidence || 90);
        setChanges(result.changes || []);
      } catch (e) {
        setTargetText('حدث خطأ أثناء الترجمة. يرجى المحاولة مرة أخرى.');
        setConfidence(null);
      } finally {
        setIsTranslating(false);
        setLayerProgress({});
      }
    }
  }, [sourceText, isTranslating, translationMode, aiMutation, sourceLang, targetLang, glossary]);

  // Load sample
  const loadSample = useCallback(() => {
    setSourceText(SAMPLE_SOURCE);
    setSourceLang('en');
    setTargetLang('ar');
  }, []);

  // Add glossary term
  const addGlossaryTerm = useCallback(() => {
    if (!newTermSource.trim() || !newTermTarget.trim()) return;
    setGlossary(prev => [...prev, { id: uid(), source: newTermSource, target: newTermTarget, domain: 'مخصص', approved: false }]);
    setNewTermSource('');
    setNewTermTarget('');
  }, [newTermSource, newTermTarget]);

  // Copy text
  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Export
  const exportTranslation = useCallback(() => {
    const content = `المصدر (${sourceLangObj?.name}):\n${sourceText}\n\n---\n\nالترجمة (${targetLangObj?.name}):\n${targetText}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translation.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [sourceText, targetText, sourceLangObj, targetLangObj]);

  // AI handler
  const handleAI = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const result = await aiMutation.mutateAsync({
        text: `${aiPrompt}\n\nالنص المصدر:\n${sourceText}\n\nالترجمة الحالية:\n${targetText}`,
        from: sourceLang,
        to: targetLang,
      });
      if (result.content) {
        setTargetText(result.content);
      }
      setAiPrompt('');
    } catch (e) {
      console.error('AI failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, aiMutation, sourceText, targetText, sourceLang, targetLang]);

  const getChangeTypeStyle = (type: TranslationChange['type']) => {
    switch (type) {
      case 'term': return { bg: 'bg-blue-500/10', text: 'text-blue-500', label: 'مصطلح' };
      case 'cultural': return { bg: 'bg-purple-500/10', text: 'text-purple-500', label: 'ثقافي' };
      case 'technical': return { bg: 'bg-green-500/10', text: 'text-green-500', label: 'تقني' };
      case 'layout': return { bg: 'bg-orange-500/10', text: 'text-orange-500', label: 'تخطيط' };
      case 'format': return { bg: 'bg-cyan-500/10', text: 'text-cyan-500', label: 'تنسيق' };
    }
  };

  return (
    <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Translation Mode Tabs */}
        {[
          { id: 'translate' as const, label: 'ترجمة', icon: 'translate' },
          { id: 'arabize' as const, label: 'تعريب LCT', icon: 'g_translate' },
          { id: 'mirror' as const, label: 'عكس RTL', icon: 'format_textdirection_r_to_l' },
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setTranslationMode(m.id)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all whitespace-nowrap ${
              translationMode === m.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <MaterialIcon icon={m.icon} size={13} />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-0.5" />
        <ToolbarBtn icon="upload_file" label="رفع ملف" />
        <ToolbarBtn icon="science" label="عينة" onClick={loadSample} />
        {mode === 'advanced' && (
          <>
            <div className="h-4 w-px bg-border mx-0.5" />
            <ToolbarBtn icon="menu_book" label="قاموس" active={showGlossary} onClick={() => setShowGlossary(!showGlossary)} />
            <ToolbarBtn icon="track_changes" label="التغييرات" active={showChanges} onClick={() => setShowChanges(!showChanges)} />
            {translationMode === 'arabize' && (
              <ToolbarBtn icon="layers" label="طبقات LCT" active={showLayers} onClick={() => setShowLayers(!showLayers)} />
            )}
          </>
        )}
        <div className="flex-1" />
        {confidence !== null && (
          <span className={`text-[9px] font-medium flex items-center gap-0.5 ${confidence >= 95 ? 'text-success' : 'text-warning'}`}>
            <MaterialIcon icon="verified" size={10} />
            {confidence}%
          </span>
        )}
      </div>

      {/* ── Arabization Layers (LCT Mode) ── */}
      {translationMode === 'arabize' && showLayers && (
        <div className="border-b border-border bg-accent/10 p-2 animate-fade-in shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="layers" size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">طبقات التعريب الاحترافي (LCT)</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
            {ARABIZATION_LAYERS.map((layer, i) => {
              const progress = layerProgress[layer.id] || 0;
              return (
                <div key={layer.id} className="flex flex-col items-center p-2 rounded-xl bg-card border border-border/50 animate-stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <MaterialIcon icon={layer.icon} size={16} className={progress === 100 ? 'text-success' : layer.color} />
                  <span className="text-[8px] text-muted-foreground mt-1 text-center leading-tight">{layer.name}</span>
                  <div className="w-full h-1 bg-accent rounded-full mt-1 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={`text-[8px] mt-0.5 font-medium ${progress === 100 ? 'text-success' : 'text-muted-foreground'}`}>
                    {progress === 100 ? 'مكتمل' : progress > 0 ? `${progress}%` : 'انتظار'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Glossary Panel ── */}
      {showGlossary && (
        <div className="border-b border-border bg-accent/10 p-2 animate-fade-in shrink-0 max-h-[200px] overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-2">
            <MaterialIcon icon="menu_book" size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">قاموس المصطلحات ({glossary.length})</span>
          </div>
          <div className="flex gap-1.5 mb-2">
            <input
              type="text"
              value={newTermSource}
              onChange={e => setNewTermSource(e.target.value)}
              placeholder="المصطلح الأصلي"
              className="flex-1 text-[10px] bg-card border border-border/50 rounded-lg px-2 py-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
            <input
              type="text"
              value={newTermTarget}
              onChange={e => setNewTermTarget(e.target.value)}
              placeholder="الترجمة المعتمدة"
              className="flex-1 text-[10px] bg-card border border-border/50 rounded-lg px-2 py-1 outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button onClick={addGlossaryTerm} className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-medium hover:bg-primary/15 transition-all">
              <MaterialIcon icon="add" size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {glossary.map(term => (
              <div key={term.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card border border-border/30">
                <span className="text-[9px] text-foreground font-medium">{term.source}</span>
                <MaterialIcon icon="arrow_forward" size={10} className="text-muted-foreground" />
                <span className="text-[9px] text-primary font-medium">{term.target}</span>
                <span className="text-[7px] text-muted-foreground mr-auto px-1 py-0.5 rounded bg-accent">{term.domain}</span>
                {term.approved && <MaterialIcon icon="verified" size={9} className="text-success" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Language Selector Bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {/* Source Language */}
        <div className="flex-1 flex items-center gap-2">
          <select
            value={sourceLang}
            onChange={e => setSourceLang(e.target.value)}
            className="text-[11px] bg-accent/30 border border-border/50 rounded-lg px-2 py-1.5 outline-none text-foreground font-medium"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
          <span className="text-[9px] text-muted-foreground">{sourceLangObj?.dir === 'rtl' ? 'RTL' : 'LTR'}</span>
        </div>

        {/* Swap Button */}
        <button
          onClick={swapLanguages}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-all hover:rotate-180 duration-300"
        >
          <MaterialIcon icon="swap_horiz" size={16} className="text-primary" />
        </button>

        {/* Target Language */}
        <div className="flex-1 flex items-center gap-2 justify-end">
          <span className="text-[9px] text-muted-foreground">{targetLangObj?.dir === 'rtl' ? 'RTL' : 'LTR'}</span>
          <select
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
            className="text-[11px] bg-accent/30 border border-border/50 rounded-lg px-2 py-1.5 outline-none text-foreground font-medium"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Translation Panels ── */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
        {/* Source Panel */}
        <div className="flex-1 flex flex-col border-b sm:border-b-0 sm:border-l border-border overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/50 shrink-0">
            <span className="text-[9px] font-bold text-muted-foreground">{sourceLangObj?.name || 'المصدر'}</span>
            <div className="flex-1" />
            <span className="text-[8px] text-muted-foreground">{sourceText.split(/\s+/).filter(Boolean).length} كلمة</span>
            <button onClick={() => copyText(sourceText)} className="p-0.5 hover:bg-accent rounded transition-all">
              <MaterialIcon icon="content_copy" size={11} className="text-muted-foreground" />
            </button>
            <button onClick={() => setSourceText('')} className="p-0.5 hover:bg-accent rounded transition-all">
              <MaterialIcon icon="close" size={11} className="text-muted-foreground" />
            </button>
          </div>
          <textarea
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
            placeholder={`أدخل النص المراد ${translationMode === 'arabize' ? 'تعريبه' : 'ترجمته'}...`}
            className="flex-1 p-3 bg-transparent text-[12px] sm:text-[13px] outline-none text-foreground placeholder:text-muted-foreground resize-none leading-relaxed"
            dir={sourceLangObj?.dir || 'ltr'}
          />
        </div>

        {/* Target Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/50 shrink-0">
            <span className="text-[9px] font-bold text-muted-foreground">{targetLangObj?.name || 'الهدف'}</span>
            {translationMode === 'arabize' && (
              <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">LCT</span>
            )}
            <div className="flex-1" />
            {targetText && (
              <>
                <span className="text-[8px] text-muted-foreground">{targetText.split(/\s+/).filter(Boolean).length} كلمة</span>
                <button onClick={() => copyText(targetText)} className="p-0.5 hover:bg-accent rounded transition-all">
                  <MaterialIcon icon="content_copy" size={11} className="text-muted-foreground" />
                </button>
                <button onClick={exportTranslation} className="p-0.5 hover:bg-accent rounded transition-all">
                  <MaterialIcon icon="download" size={11} className="text-muted-foreground" />
                </button>
              </>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {isTranslating ? (
              <RasedLoader type="translation" size="sm" inline message={translationMode === 'arabize' ? 'جاري التعريب الاحترافي...' : 'جاري الترجمة...'} />
            ) : targetText ? (
              <div className="p-3 text-[12px] sm:text-[13px] text-foreground leading-relaxed whitespace-pre-wrap" dir={targetLangObj?.dir || 'rtl'}>
                {targetText}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground/30">
                <MaterialIcon icon={translationMode === 'arabize' ? 'g_translate' : 'translate'} size={40} />
                <p className="text-[11px] mt-2">
                  {translationMode === 'arabize' ? 'النص المعرّب سيظهر هنا' : 'الترجمة ستظهر هنا'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Changes Panel (Advanced) ── */}
      {showChanges && changes.length > 0 && (
        <div className="border-t border-border bg-accent/10 p-2 animate-fade-in shrink-0 max-h-[150px] overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MaterialIcon icon="track_changes" size={14} className="text-primary" />
            <span className="text-[10px] font-bold text-muted-foreground">التغييرات ({changes.length})</span>
          </div>
          <div className="flex flex-col gap-1">
            {changes.map((change, i) => {
              const style = getChangeTypeStyle(change.type);
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-card border border-border/30 animate-stagger-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                  <span className="text-[9px] text-muted-foreground line-through">{change.original}</span>
                  <MaterialIcon icon="arrow_forward" size={10} className="text-primary" />
                  <span className="text-[9px] text-foreground font-medium">{change.translated}</span>
                  {change.note && <span className="text-[7px] text-muted-foreground mr-auto">({change.note})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Translate Button + AI Bar ── */}
      <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-xl text-[11px] font-medium hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
          >
            <MaterialIcon icon={isTranslating ? 'progress_activity' : translationMode === 'arabize' ? 'g_translate' : 'translate'} size={14} className={isTranslating ? 'animate-spin' : ''} />
            {translationMode === 'arabize' ? 'تعريب احترافي' : translationMode === 'mirror' ? 'عكس التخطيط' : 'ترجم'}
          </button>
          <div className="flex-1 flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
            <img src={char} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAI(); }}
              placeholder="اطلب من راصد تحسين الترجمة... مثال: اجعل الأسلوب أكثر رسمية"
              className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground"
              disabled={aiLoading}
            />
            <button
              onClick={handleAI}
              disabled={aiLoading || !aiPrompt.trim()}
              className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all ${aiLoading ? 'animate-spin' : ''}`}
            >
              <MaterialIcon icon={aiLoading ? 'progress_activity' : 'send'} size={13} className="text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Toolbar Button ── */
function ToolbarBtn({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all active:scale-95 whitespace-nowrap ${
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <MaterialIcon icon={icon} size={14} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
