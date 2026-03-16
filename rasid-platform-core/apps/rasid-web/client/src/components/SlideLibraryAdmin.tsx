/* ═══════════════════════════════════════════════════════════════
   Slide Element Library — Admin Management Panel
   Upload PPTX references → AI decomposes into reusable elements
   Manage categories, quality ratings, and usage rules
   ═══════════════════════════════════════════════════════════════ */
import { useState, useCallback, useRef } from 'react';
import MaterialIcon from '@/components/MaterialIcon';
import ElementPreview from '@/components/ElementPreview';
import TemplateEditor from '@/components/TemplateEditor';
import CreateTemplateDialog from '@/components/CreateTemplateDialog';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface Category {
  id: number;
  slug: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  description: string | null;
  sortOrder: number;
}

interface SlideElement {
  id: number;
  templateId: number | null;
  categoryId: number | null;
  name: string;
  description: string | null;
  sourceSlideNumber: number | null;
  designTemplate: any;
  styleProperties: any;
  contentSlots: any;
  isActive: boolean;
  qualityRating: number;
  htmlTemplate?: string | null;
  category?: Category;
  usageRules?: { id: number; triggerContext: string; ruleDescription: string; priority: number; isActive: boolean }[];
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  fileUrl: string | null;
  status: string;
  slideCount: number | null;
  elementCount: number | null;
  errorMessage: string | null;
  createdAt: Date | string;
}

// ─── Category Icon Map ──────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  kpi_card: '#2563eb',
  colored_pillars: '#7c3aed',
  data_table: '#059669',
  horizontal_bars: '#d97706',
  process_flow: '#0891b2',
  card_grid: '#6366f1',
  comparison: '#dc2626',
  circular_gauge: '#0d9488',
  timeline: '#ea580c',
  risk_matrix: '#be123c',
  governance_pyramid: '#4f46e5',
  project_card: '#0284c7',
  authority_matrix: '#7c2d12',
  classification_grid: '#4338ca',
  cover_slide: '#1d4ed8',
  section_divider: '#6b7280',
  closing_slide: '#16a34a',
  infographic: '#8b5cf6',
  org_chart: '#0369a1',
  scope_definition: '#b45309',
};

// ─── Star Rating ────────────────────────────────────────────────

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
          className={`transition-all ${readonly ? '' : 'hover:scale-125 cursor-pointer'}`}
        >
          <MaterialIcon
            icon={star <= value ? 'star' : 'star_border'}
            size={16}
            className={star <= value ? 'text-amber-500' : 'text-muted-foreground/30'}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Upload Section ─────────────────────────────────────────────

function UploadSection({ onUploadComplete }: { onUploadComplete: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadMutation = trpc.slideLibrary.uploadTemplate.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تفكيك العرض بنجاح: ${data.slideCount} شريحة → ${data.elementCount} عنصر`);
      setName('');
      setDescription('');
      setSelectedFile(null);
      setUploading(false);
      setUploadProgress(null);
      onUploadComplete();
    },
    onError: (err) => {
      toast.error(`فشل في معالجة العرض: ${err.message}`);
      setUploading(false);
      setUploadProgress(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.pptx')) {
      toast.error('يرجى اختيار ملف PPTX فقط');
      return;
    }
    setSelectedFile(file);
    if (!name) setName(file.name.replace('.pptx', ''));
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) {
      toast.error('يرجى اختيار ملف وإدخال اسم');
      return;
    }

    setUploading(true);
    setUploadProgress({ step: 'قراءة الملف...', current: 0, total: 1 });

    try {
      const buffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      setUploadProgress({ step: 'رفع وتحليل العرض بالذكاء الاصطناعي...', current: 0, total: 1 });

      uploadMutation.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        fileBase64: base64,
        fileName: selectedFile.name,
      });
    } catch (err: any) {
      toast.error(`خطأ: ${err.message}`);
      setUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="upload_file" size={22} className="text-primary" />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-foreground">رفع عرض تقديمي مرجعي</h3>
          <p className="text-[11px] text-muted-foreground">ارفع ملف PPTX وسيتم تفكيكه تلقائياً إلى عناصر تصميم قابلة لإعادة الاستخدام</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">اسم القالب *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: النموذج المرجعي الشامل"
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            disabled={uploading}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">الوصف (اختياري)</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="وصف مختصر للعرض المرجعي"
            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            disabled={uploading}
          />
        </div>
      </div>

      {/* File Drop Zone */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          selectedFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-accent/30'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pptx"
          onChange={handleFileSelect}
          className="hidden"
        />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="slideshow" size={24} className="text-primary" />
            </div>
            <div className="text-right">
              <p className="text-[13px] font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-[11px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!uploading && (
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); }}
                className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all"
              >
                <MaterialIcon icon="close" size={18} className="text-destructive" />
              </button>
            )}
          </div>
        ) : (
          <>
            <MaterialIcon icon="cloud_upload" size={36} className="text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[13px] text-muted-foreground">اسحب ملف PPTX هنا أو انقر للاختيار</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">يدعم ملفات PowerPoint (.pptx) فقط</p>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="mt-4 bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[12px] font-medium text-primary">{uploadProgress.step}</span>
          </div>
          <div className="w-full h-1.5 bg-primary/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            قد يستغرق التحليل بالذكاء الاصطناعي عدة دقائق حسب عدد الشرائح...
          </p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || !name.trim() || uploading}
        className="mt-4 w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <>
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            جاري التحليل...
          </>
        ) : (
          <>
            <MaterialIcon icon="auto_awesome" size={18} />
            تفكيك وتحليل بالذكاء الاصطناعي
          </>
        )}
      </button>
    </div>
  );
}

// ─── Templates List ─────────────────────────────────────────────

function TemplatesList({ templates, onRefresh }: { templates: Template[]; onRefresh: () => void }) {
  const deleteMutation = trpc.slideLibrary.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success('تم حذف القالب وجميع عناصره');
      onRefresh();
    },
    onError: (err) => toast.error(err.message),
  });

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 bg-card rounded-2xl border border-border">
        <MaterialIcon icon="folder_open" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-[14px] font-medium text-muted-foreground">لا توجد قوالب مرفوعة بعد</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">ارفع عرض تقديمي PPTX لبدء بناء المكتبة</p>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    processing: { label: 'جاري التحليل', color: 'text-amber-600 bg-amber-50', icon: 'hourglass_top' },
    ready: { label: 'جاهز', color: 'text-emerald-600 bg-emerald-50', icon: 'check_circle' },
    failed: { label: 'فشل', color: 'text-red-600 bg-red-50', icon: 'error' },
  };

  return (
    <div className="space-y-3 mb-6">
      <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
        <MaterialIcon icon="folder_special" size={18} className="text-primary" />
        القوالب المرفوعة ({templates.length})
      </h3>
      {templates.map(t => {
        const status = statusConfig[t.status] || statusConfig.processing;
        return (
          <div key={t.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:shadow-sm transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <MaterialIcon icon="slideshow" size={24} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-[13px] font-bold text-foreground truncate">{t.name}</h4>
                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${status.color} flex items-center gap-1`}>
                  <MaterialIcon icon={status.icon} size={12} />
                  {status.label}
                </span>
              </div>
              {t.description && <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>}
              <div className="flex items-center gap-4 mt-1.5">
                {t.slideCount && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MaterialIcon icon="layers" size={12} />
                    {t.slideCount} شريحة
                  </span>
                )}
                {t.elementCount && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <MaterialIcon icon="widgets" size={12} />
                    {t.elementCount} عنصر
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <MaterialIcon icon="schedule" size={12} />
                  {new Date(t.createdAt).toLocaleDateString('ar-SA')}
                </span>
              </div>
              {t.errorMessage && (
                <p className="text-[10px] text-destructive mt-1 truncate">{t.errorMessage}</p>
              )}
            </div>
            <button
              onClick={() => {
                if (confirm('هل أنت متأكد من حذف هذا القالب وجميع عناصره؟')) {
                  deleteMutation.mutate({ id: t.id });
                }
              }}
              className="w-9 h-9 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all shrink-0"
            >
              <MaterialIcon icon="delete_outline" size={18} className="text-destructive/60" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Element Card ───────────────────────────────────────────────

function ElementCard({ element, categories, onUpdate }: { element: SlideElement; categories: Category[]; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editName, setEditName] = useState(element.name);
  const [editDesc, setEditDesc] = useState(element.description || '');
  const [editCategoryId, setEditCategoryId] = useState(element.categoryId);
  const [editRating, setEditRating] = useState(element.qualityRating);

  const updateMutation = trpc.slideLibrary.updateElement.useMutation({
    onSuccess: () => {
      toast.success('تم تحديث العنصر');
      setEditing(false);
      onUpdate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleActiveMutation = trpc.slideLibrary.updateElement.useMutation({
    onSuccess: () => {
      onUpdate();
    },
  });

  const catColor = element.category?.slug ? CATEGORY_COLORS[element.category.slug] || '#6b7280' : '#6b7280';

  // Determine element type from styleProperties or category
  const elementType = element.styleProperties?.elementType || element.category?.slug || 'text_block';

  return (
    <div className={`bg-card rounded-xl border transition-all ${element.isActive ? 'border-border hover:shadow-sm' : 'border-border/50 opacity-60'}`}>
      {/* Visual Preview */}
      <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
        <div className="absolute inset-0 rounded-t-xl overflow-hidden border-b border-border/30">
          <ElementPreview
            elementType={elementType}
            designTemplate={element.designTemplate || {}}
            name={element.name}
            htmlTemplate={element.htmlTemplate}
          />
        </div>
        {/* Overlay badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
            style={{ backgroundColor: `${catColor}dd`, color: '#fff' }}
          >
            {element.category?.nameAr || 'غير مصنف'}
          </span>
        </div>
        {element.sourceSlideNumber && (
          <div className="absolute top-2 right-2">
            <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-md bg-black/50 text-white backdrop-blur-sm">
              شريحة {element.sourceSlideNumber}
            </span>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${catColor}15` }}
        >
          <MaterialIcon icon={element.category?.icon || 'widgets'} size={16} style={{ color: catColor } as any} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-[11px] text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <select
                value={editCategoryId || ''}
                onChange={e => setEditCategoryId(Number(e.target.value) || null)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">بدون فئة</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">الجودة:</span>
                <StarRating value={editRating} onChange={setEditRating} />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateMutation.mutate({ id: element.id, name: editName, description: editDesc, categoryId: editCategoryId || undefined, qualityRating: editRating })}
                  className="h-7 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="h-7 px-3 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:bg-accent transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <>
              <h4 className="text-[12px] font-bold text-foreground truncate mb-0.5">{element.name}</h4>
              {element.description && (
                <p className="text-[10px] text-muted-foreground line-clamp-1">{element.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <StarRating value={element.qualityRating} readonly />
                {element.usageRules && element.usageRules.length > 0 && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <MaterialIcon icon="rule" size={11} />
                    {element.usageRules.length} قاعدة
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            {element.htmlTemplate && (
              <button
                onClick={() => setEditorOpen(true)}
                className="w-7 h-7 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-all"
                title="فتح المحرر المرئي"
              >
                <MaterialIcon icon="edit_note" size={14} className="text-primary" />
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-all"
            >
              <MaterialIcon icon={expanded ? 'expand_less' : 'expand_more'} size={16} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-all"
            >
              <MaterialIcon icon="edit" size={14} className="text-muted-foreground" />
            </button>
            <button
              onClick={() => toggleActiveMutation.mutate({ id: element.id, isActive: !element.isActive })}
              className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-all"
            >
              <MaterialIcon
                icon={element.isActive ? 'visibility' : 'visibility_off'}
                size={14}
                className={element.isActive ? 'text-emerald-500' : 'text-muted-foreground/40'}
              />
            </button>
          </div>
        )}

        {/* Template Editor Modal */}
        {editorOpen && element.htmlTemplate && (
          <TemplateEditor
            elementId={element.id}
            elementName={element.name}
            initialHtml={element.htmlTemplate}
            onSave={() => { setEditorOpen(false); onUpdate(); }}
            onClose={() => setEditorOpen(false)}
          />
        )}
      </div>

      {/* Expanded Details */}
      {expanded && !editing && (
        <div className="px-3.5 pb-3.5 border-t border-border/50 pt-3 space-y-3">
          {/* Design Template */}
          {element.designTemplate && (
            <div>
              <h5 className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                <MaterialIcon icon="palette" size={12} />
                قالب التصميم
              </h5>
              <div className="bg-accent/30 rounded-lg p-2.5 text-[10px] space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">التخطيط:</span>
                  <span className="text-foreground font-medium">{element.designTemplate.layout}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">الأعمدة:</span>
                  <span className="text-foreground font-medium">{element.designTemplate.columns}</span>
                </div>
                {element.designTemplate.colorScheme && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">الألوان:</span>
                    <div className="flex items-center gap-1">
                      {element.designTemplate.colorScheme.slice(0, 6).map((c: string, i: number) => (
                        <div key={i} className="w-4 h-4 rounded-sm border border-border/50" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  </div>
                )}
                {element.designTemplate.elements && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {element.designTemplate.elements.map((el: string, i: number) => (
                      <span key={i} className="text-[8px] bg-background px-1.5 py-0.5 rounded-md border border-border/50 text-muted-foreground">
                        {el}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Content Slots */}
          {element.contentSlots && Array.isArray(element.contentSlots) && element.contentSlots.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                <MaterialIcon icon="input" size={12} />
                فتحات المحتوى ({element.contentSlots.length})
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {element.contentSlots.map((slot: any, i: number) => (
                  <span key={i} className={`text-[9px] px-2 py-0.5 rounded-full border ${slot.required ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-accent/30 text-muted-foreground'}`}>
                    {slot.name} ({slot.type})
                    {slot.required && ' *'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Usage Rules */}
          {element.usageRules && element.usageRules.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                <MaterialIcon icon="rule" size={12} />
                قواعد الاستخدام ({element.usageRules.length})
              </h5>
              <div className="space-y-1">
                {element.usageRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] bg-accent/30 rounded-lg px-2.5 py-1.5">
                    <MaterialIcon icon="arrow_left" size={12} className="text-primary shrink-0" />
                    <span className="text-foreground font-medium">{rule.triggerContext}</span>
                    <span className="text-muted-foreground">— {rule.ruleDescription}</span>
                    <span className="text-[8px] text-muted-foreground/60 mr-auto" dir="ltr">P{rule.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Texts */}
          {element.styleProperties?.texts && element.styleProperties.texts.length > 0 && (
            <div>
              <h5 className="text-[10px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                <MaterialIcon icon="text_fields" size={12} />
                نصوص من الشريحة الأصلية
              </h5>
              <div className="bg-accent/30 rounded-lg p-2.5 text-[10px] text-muted-foreground space-y-0.5">
                {element.styleProperties.texts.slice(0, 5).map((t: string, i: number) => (
                  <p key={i} className="truncate">• {t}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category Filter Bar ────────────────────────────────────────

function CategoryFilterBar({ categories, activeCategory, onSelect }: { categories: Category[]; activeCategory: string | null; onSelect: (slug: string | null) => void }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={`shrink-0 h-8 px-3 rounded-lg text-[11px] font-medium transition-all ${
          !activeCategory ? 'bg-primary text-primary-foreground' : 'bg-accent/50 text-muted-foreground hover:bg-accent'
        }`}
      >
        الكل
      </button>
      {categories.map(cat => {
        const color = CATEGORY_COLORS[cat.slug] || '#6b7280';
        const isActive = activeCategory === cat.slug;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(isActive ? null : cat.slug)}
            className={`shrink-0 h-8 px-3 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5 ${
              isActive ? 'text-white' : 'bg-accent/50 text-muted-foreground hover:bg-accent'
            }`}
            style={isActive ? { backgroundColor: color } : {}}
          >
            <MaterialIcon icon={cat.icon} size={14} />
            {cat.nameAr}
          </button>
        );
      })}
    </div>
  );
}

// ─── Stats Bar ──────────────────────────────────────────────────

function StatsBar({ stats }: { stats: { templates: number; elements: number; activeElements: number; categories: number } }) {
  const items = [
    { label: 'القوالب', value: stats.templates, icon: 'slideshow', color: '#2563eb' },
    { label: 'العناصر', value: stats.elements, icon: 'widgets', color: '#7c3aed' },
    { label: 'النشطة', value: stats.activeElements, icon: 'check_circle', color: '#059669' },
    { label: 'الفئات', value: stats.categories, icon: 'category', color: '#d97706' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map(item => (
        <div key={item.label} className="bg-card rounded-xl border border-border p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${item.color}12` }}>
            <MaterialIcon icon={item.icon} size={20} style={{ color: item.color } as any} />
          </div>
          <div>
            <p className="text-[22px] font-bold text-foreground leading-none">{item.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function SlideLibraryAdmin() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const statsQuery = trpc.slideLibrary.getStats.useQuery();
  const categoriesQuery = trpc.slideLibrary.getCategories.useQuery();
  const templatesQuery = trpc.slideLibrary.getTemplates.useQuery();
  const elementsQuery = trpc.slideLibrary.getAllElements.useQuery({ activeOnly: !showInactive });

  const refetchAll = useCallback(() => {
    statsQuery.refetch();
    categoriesQuery.refetch();
    templatesQuery.refetch();
    elementsQuery.refetch();
  }, [statsQuery, categoriesQuery, templatesQuery, elementsQuery]);

  const categories = (categoriesQuery.data || []) as Category[];
  const templates = (templatesQuery.data || []) as Template[];
  const allElements = (elementsQuery.data || []) as SlideElement[];

  // Filter elements by category
  const filteredElements = activeCategory
    ? allElements.filter(el => el.category?.slug === activeCategory)
    : allElements;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {statsQuery.data && <StatsBar stats={statsQuery.data} />}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="h-10 px-5 rounded-xl bg-emerald-600 text-white text-[12px] font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm"
        >
          <MaterialIcon icon="add_circle" size={18} />
          إنشاء عنصر جديد
        </button>
      </div>

      {/* Upload Section */}
      <UploadSection onUploadComplete={refetchAll} />

      {/* Create Template Dialog */}
      {createDialogOpen && (
        <CreateTemplateDialog
          categories={categories}
          onCreated={refetchAll}
          onClose={() => setCreateDialogOpen(false)}
        />
      )}

      {/* Templates List */}
      <TemplatesList templates={templates} onRefresh={refetchAll} />

      {/* Elements Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
            <MaterialIcon icon="widgets" size={18} className="text-primary" />
            عناصر التصميم ({filteredElements.length})
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border accent-primary"
              />
              عرض المعطلة
            </label>
            <button
              onClick={refetchAll}
              className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-all"
            >
              <MaterialIcon icon="refresh" size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <CategoryFilterBar
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />
        )}

        {/* Elements Grid */}
        {filteredElements.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-2xl border border-border">
            <MaterialIcon icon="widgets" size={40} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-[14px] font-medium text-muted-foreground">
              {activeCategory ? 'لا توجد عناصر في هذه الفئة' : 'لا توجد عناصر بعد'}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">ارفع عرض تقديمي مرجعي لاستخراج العناصر</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filteredElements.map(el => (
              <ElementCard
                key={el.id}
                element={el}
                categories={categories}
                onUpdate={refetchAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
