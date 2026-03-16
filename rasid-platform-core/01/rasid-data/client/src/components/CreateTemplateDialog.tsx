/* ═══════════════════════════════════════════════════════════════════
   CreateTemplateDialog — Create New Template Element
   
   Three modes:
   1. AI Generation — describe what you want, AI creates HTML
   2. HTML Upload — paste or upload raw HTML
   3. Blank Template — start from a blank 1280x720 canvas
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef } from 'react';
import MaterialIcon from './MaterialIcon';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface CreateTemplateDialogProps {
  categories: { id: number; slug: string; nameAr: string; icon: string }[];
  onCreated: () => void;
  onClose: () => void;
}

type CreateMode = 'ai' | 'html' | 'blank';

/* ─── Blank Template HTML ───────────────────────────────────────── */
const BLANK_TEMPLATE = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 1280px; height: 720px; overflow: hidden;
  font-family: 'Tajawal', sans-serif; direction: rtl;
  background: linear-gradient(135deg, #0f2744 0%, #1a3a5c 100%);
  display: flex; align-items: center; justify-content: center;
  color: #ffffff;
}
.container {
  text-align: center; padding: 60px;
}
h1 { font-size: 48px; font-weight: 800; margin-bottom: 16px; color: #d4af37; }
p { font-size: 24px; opacity: 0.8; }
</style>
</head>
<body>
<div class="container">
  <h1>عنوان الشريحة</h1>
  <p>أضف المحتوى هنا</p>
</div>
</body>
</html>`;

export default function CreateTemplateDialog({ categories, onCreated, onClose }: CreateTemplateDialogProps) {
  const [mode, setMode] = useState<CreateMode>('ai');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // AI mode
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatedHtml, setGeneratedHtml] = useState('');

  // HTML mode
  const [pastedHtml, setPastedHtml] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Mutations
  const createMutation = trpc.slideLibrary.createElement.useMutation({
    onSuccess: () => {
      toast.success('تم إنشاء العنصر بنجاح');
      setLoading(false);
      onCreated();
      onClose();
    },
    onError: (err) => {
      toast.error(`فشل: ${err.message}`);
      setLoading(false);
    },
  });

  const aiGenerateMutation = trpc.slideLibrary.convertPptxToHtml.useMutation({
    onSuccess: (data) => {
      setGeneratedHtml(data.html);
      setLoading(false);
      toast.success('تم توليد القالب بنجاح! راجعه ثم اضغط حفظ.');
    },
    onError: (err) => {
      toast.error(`فشل التوليد: ${err.message}`);
      setLoading(false);
    },
  });

  const handleAIGenerate = () => {
    if (!aiPrompt.trim()) {
      toast.error('يرجى وصف القالب المطلوب');
      return;
    }
    setLoading(true);
    aiGenerateMutation.mutate({
      slideName: name || 'قالب جديد',
      slideDescription: aiPrompt,
      categorySlug: categories.find(c => c.id === categoryId)?.slug,
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم العنصر');
      return;
    }

    let htmlToSave = '';
    if (mode === 'ai') {
      htmlToSave = generatedHtml;
    } else if (mode === 'html') {
      htmlToSave = pastedHtml;
    } else {
      htmlToSave = BLANK_TEMPLATE;
    }

    if (!htmlToSave.trim()) {
      toast.error('لا يوجد محتوى HTML للحفظ');
      return;
    }

    setLoading(true);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
      htmlTemplate: htmlToSave,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast.error('يرجى اختيار ملف HTML فقط');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setPastedHtml(content);
      if (!name) setName(file.name.replace(/\.(html|htm)$/, ''));
      toast.success('تم تحميل الملف');
    };
    reader.readAsText(file);
  };

  const previewHtml = mode === 'ai' ? generatedHtml : mode === 'html' ? pastedHtml : BLANK_TEMPLATE;

  const modes: { id: CreateMode; label: string; icon: string; desc: string }[] = [
    { id: 'ai', label: 'توليد بالذكاء الاصطناعي', icon: 'auto_awesome', desc: 'صف ما تريد وسيتم توليده تلقائياً' },
    { id: 'html', label: 'رفع HTML', icon: 'code', desc: 'الصق كود HTML أو ارفع ملف' },
    { id: 'blank', label: 'قالب فارغ', icon: 'note_add', desc: 'ابدأ من قالب فارغ وعدّله في المحرر' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-[900px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MaterialIcon icon="add_circle" size={20} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">إنشاء عنصر جديد</h2>
              <p className="text-[11px] text-muted-foreground">أضف عنصر تصميم جديد لمكتبة العروض</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center">
            <MaterialIcon icon="close" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Mode Selection */}
          <div className="grid grid-cols-3 gap-3">
            {modes.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-3.5 rounded-xl border-2 transition-all text-right ${
                  mode === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <MaterialIcon
                  icon={m.icon}
                  size={22}
                  className={mode === m.id ? 'text-primary' : 'text-muted-foreground'}
                />
                <h4 className="text-[12px] font-bold text-foreground mt-2">{m.label}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">اسم العنصر *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: بطاقة مؤشرات الأداء"
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">الفئة</label>
              <select
                value={categoryId || ''}
                onChange={e => setCategoryId(Number(e.target.value) || undefined)}
                className="w-full h-10 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">بدون فئة</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">الوصف (اختياري)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="وصف مختصر للعنصر"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Mode-specific content */}
          {mode === 'ai' && (
            <div className="space-y-3">
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                صف القالب المطلوب بالتفصيل
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                rows={4}
                placeholder="مثال: شريحة تحتوي على 4 بطاقات KPI بألوان NDMO مع رسم بياني دائري في الأسفل يوضح نسب الامتثال..."
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleAIGenerate}
                disabled={loading || !aiPrompt.trim()}
                className="h-10 px-5 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 text-white text-[12px] font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="auto_awesome" size={16} />
                    توليد بالذكاء الاصطناعي
                  </>
                )}
              </button>
            </div>
          )}

          {mode === 'html' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="h-9 px-4 rounded-xl border border-border text-[12px] font-medium text-foreground flex items-center gap-2 hover:bg-accent transition-all"
                >
                  <MaterialIcon icon="upload_file" size={16} />
                  رفع ملف HTML
                </button>
                <input ref={fileRef} type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
                <span className="text-[10px] text-muted-foreground">أو الصق الكود أدناه</span>
              </div>
              <textarea
                value={pastedHtml}
                onChange={e => setPastedHtml(e.target.value)}
                rows={8}
                placeholder="الصق كود HTML الكامل هنا (يجب أن يكون 1280x720 بكسل)..."
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-[11px] font-mono text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                dir="ltr"
              />
            </div>
          )}

          {mode === 'blank' && (
            <div className="bg-accent/30 rounded-xl p-4 text-center">
              <MaterialIcon icon="note_add" size={32} className="text-primary/40 mx-auto mb-2" />
              <p className="text-[12px] text-foreground font-medium">سيتم إنشاء قالب فارغ</p>
              <p className="text-[10px] text-muted-foreground mt-1">يمكنك تعديله لاحقاً من المحرر المرئي</p>
            </div>
          )}

          {/* Preview */}
          {previewHtml && (mode === 'ai' ? generatedHtml : true) && (
            <div>
              <h4 className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
                <MaterialIcon icon="preview" size={14} className="text-primary" />
                معاينة
              </h4>
              <div className="relative w-full overflow-hidden rounded-xl border border-border" style={{ aspectRatio: '16/9' }}>
                <iframe
                  srcDoc={previewHtml}
                  title="Preview"
                  sandbox="allow-scripts"
                  style={{
                    width: 1280,
                    height: 720,
                    transform: `scale(${0.5})`,
                    transformOrigin: 'top right',
                    border: 'none',
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    right: 0,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-card/50">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-border text-[12px] font-medium text-muted-foreground hover:bg-accent transition-all"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !name.trim() || (mode === 'ai' && !generatedHtml) || (mode === 'html' && !pastedHtml.trim())}
            className="h-9 px-6 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <MaterialIcon icon="save" size={16} />
            )}
            حفظ العنصر
          </button>
        </div>
      </div>
    </div>
  );
}
