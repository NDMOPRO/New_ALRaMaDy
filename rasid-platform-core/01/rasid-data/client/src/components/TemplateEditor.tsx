/* ═══════════════════════════════════════════════════════════════════
   TemplateEditor — Visual HTML Template Editor
   
   Features:
   - Live iframe preview (1280x720)
   - Property panels: colors, fonts, spacing, backgrounds
   - Content slot editing (inline text editing)
   - CSS property inspector with visual controls
   - Undo/redo support
   - Save to database
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import MaterialIcon from './MaterialIcon';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface TemplateEditorProps {
  elementId: number;
  elementName: string;
  initialHtml: string;
  onSave?: () => void;
  onClose: () => void;
}

/* ─── Color Presets ─────────────────────────────────────────────── */
const COLOR_PRESETS = [
  { label: 'NDMO أزرق داكن', value: '#0f2744' },
  { label: 'NDMO ذهبي', value: '#d4af37' },
  { label: 'NDMO أزرق فاتح', value: '#3E518E' },
  { label: 'تركوازي', value: '#0CAB8F' },
  { label: 'أبيض', value: '#ffffff' },
  { label: 'رمادي فاتح', value: '#f1f5f9' },
  { label: 'أحمر', value: '#dc2626' },
  { label: 'أخضر', value: '#059669' },
  { label: 'بنفسجي', value: '#7c3aed' },
  { label: 'برتقالي', value: '#d97706' },
];

const FONT_OPTIONS = [
  { label: 'Tajawal', value: "'Tajawal', sans-serif" },
  { label: 'Cairo', value: "'Cairo', sans-serif" },
  { label: 'Noto Sans Arabic', value: "'Noto Sans Arabic', sans-serif" },
  { label: 'IBM Plex Sans Arabic', value: "'IBM Plex Sans Arabic', sans-serif" },
  { label: 'DIN Next Arabic', value: "'DIN Next Arabic', sans-serif" },
];

/* ─── Helper: Parse CSS from HTML ───────────────────────────────── */
function extractCssVariables(html: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const uniqueColors = new Set<string>();
  let cm;
  const colorRe = /(#[0-9a-fA-F]{3,8})/g;
  while ((cm = colorRe.exec(html)) !== null) {
    uniqueColors.add(cm[1].toLowerCase());
  }
  let i = 0;
  Array.from(uniqueColors).forEach(c => {
    vars[`color_${i}`] = c;
    i++;
  });
  return vars;
}

/* ─── Helper: Replace color in HTML ─────────────────────────────── */
function replaceColorInHtml(html: string, oldColor: string, newColor: string): string {
  const escaped = oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'gi');
  return html.replace(regex, newColor);
}

/* ─── Helper: Replace text content ──────────────────────────────── */
function replaceTextInHtml(html: string, oldText: string, newText: string): string {
  if (!oldText.trim()) return html;
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(>\\s*)${escaped}(\\s*<)`, 'g');
  return html.replace(regex, `$1${newText}$2`);
}

/* ─── Helper: Extract editable text nodes ───────────────────────── */
function extractTextNodes(html: string): string[] {
  const texts: string[] = [];
  const regex = />([^<]{3,})</g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[1].trim();
    if (text && !text.startsWith('//') && !text.startsWith('{') && !text.startsWith('function') && !text.includes('var ') && text.length < 200) {
      texts.push(text);
    }
  }
  return Array.from(new Set(texts));
}

/* ─── Helper: Extract unique colors ─────────────────────────────── */
function extractUniqueColors(html: string): string[] {
  const colors = new Set<string>();
  const regex = /#[0-9a-fA-F]{6}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    colors.add(match[0].toLowerCase());
  }
  return Array.from(colors);
}

/* ─── Main Component ────────────────────────────────────────────── */
export default function TemplateEditor({ elementId, elementName, initialHtml, onSave, onClose }: TemplateEditorProps) {
  const [html, setHtml] = useState(initialHtml);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'colors' | 'text' | 'code'>('colors');
  const [saving, setSaving] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.5);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);

  // Extract editable content
  const colors = useMemo(() => extractUniqueColors(html), [html]);
  const textNodes = useMemo(() => extractTextNodes(html), [html]);

  // Calculate preview scale
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setPreviewScale(Math.min(w / 1280, 0.75));
      }
    });
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Push to undo stack
  const pushUndo = useCallback((prevHtml: string) => {
    setUndoStack(prev => [...prev.slice(-30), prevHtml]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, html]);
    setHtml(prev);
    setUndoStack(s => s.slice(0, -1));
  }, [undoStack, html]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(s => [...s, html]);
    setHtml(next);
    setRedoStack(r => r.slice(0, -1));
  }, [redoStack, html]);

  // Color change handler
  const handleColorChange = useCallback((oldColor: string, newColor: string) => {
    pushUndo(html);
    setHtml(prev => replaceColorInHtml(prev, oldColor, newColor));
  }, [html, pushUndo]);

  // Text change handler
  const handleTextChange = useCallback((oldText: string, newText: string) => {
    if (oldText === newText) return;
    pushUndo(html);
    setHtml(prev => replaceTextInHtml(prev, oldText, newText));
  }, [html, pushUndo]);

  // Code change handler
  const handleCodeChange = useCallback((newCode: string) => {
    pushUndo(html);
    setHtml(newCode);
  }, [html, pushUndo]);

  // Save mutation
  const updateMutation = trpc.slideLibrary.updateElement.useMutation({
    onSuccess: () => {
      toast.success('تم حفظ القالب بنجاح');
      setSaving(false);
      onSave?.();
    },
    onError: (err) => {
      toast.error(`فشل الحفظ: ${err.message}`);
      setSaving(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    updateMutation.mutate({ id: elementId, htmlTemplate: html });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, handleSave, onClose]);

  const tabs = [
    { id: 'colors' as const, label: 'الألوان', icon: 'palette' },
    { id: 'text' as const, label: 'النصوص', icon: 'text_fields' },
    { id: 'code' as const, label: 'الكود', icon: 'code' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MaterialIcon icon="edit_note" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-foreground">محرر القالب المرئي</h2>
              <p className="text-[11px] text-muted-foreground">{elementName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-all disabled:opacity-30"
              title="تراجع (Ctrl+Z)"
            >
              <MaterialIcon icon="undo" size={18} className="text-muted-foreground" />
            </button>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-all disabled:opacity-30"
              title="إعادة (Ctrl+Y)"
            >
              <MaterialIcon icon="redo" size={18} className="text-muted-foreground" />
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || html === initialHtml}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <MaterialIcon icon="save" size={16} />
              )}
              حفظ
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all"
            >
              <MaterialIcon icon="close" size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Property Panel */}
          <div className="w-[340px] border-l border-border bg-card/30 flex flex-col overflow-hidden shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 h-10 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:bg-accent/50'
                  }`}
                >
                  <MaterialIcon icon={tab.icon} size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'colors' && (
                <ColorsPanel colors={colors} onColorChange={handleColorChange} />
              )}
              {activeTab === 'text' && (
                <TextPanel textNodes={textNodes} onTextChange={handleTextChange} />
              )}
              {activeTab === 'code' && (
                <CodePanel html={html} onCodeChange={handleCodeChange} codeRef={codeRef} />
              )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="flex-1 bg-muted/30 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-card/30 flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <MaterialIcon icon="preview" size={14} />
                معاينة حية — {Math.round(previewScale * 100)}%
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewScale(s => Math.max(0.2, s - 0.1))}
                  className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center"
                >
                  <MaterialIcon icon="remove" size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => setPreviewScale(s => Math.min(1, s + 0.1))}
                  className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center"
                >
                  <MaterialIcon icon="add" size={14} className="text-muted-foreground" />
                </button>
                <button
                  onClick={() => {
                    if (previewContainerRef.current) {
                      setPreviewScale(previewContainerRef.current.clientWidth / 1280);
                    }
                  }}
                  className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center"
                  title="ملائمة"
                >
                  <MaterialIcon icon="fit_screen" size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>
            <div
              ref={previewContainerRef}
              className="flex-1 overflow-auto flex items-start justify-center p-6"
            >
              <div
                style={{
                  width: 1280,
                  height: 720,
                  transform: `scale(${previewScale})`,
                  transformOrigin: 'top center',
                  flexShrink: 0,
                }}
              >
                <iframe
                  srcDoc={html}
                  title="Template Preview"
                  sandbox="allow-scripts"
                  style={{
                    width: 1280,
                    height: 720,
                    border: 'none',
                    borderRadius: 8,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Colors Panel ──────────────────────────────────────────────── */
function ColorsPanel({ colors, onColorChange }: { colors: string[]; onColorChange: (old: string, newVal: string) => void }) {
  const [editingColor, setEditingColor] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
          <MaterialIcon icon="palette" size={14} className="text-primary" />
          ألوان القالب ({colors.length})
        </h4>
        <p className="text-[10px] text-muted-foreground mb-3">
          انقر على أي لون لتغييره. التغيير سيطبق على جميع الأماكن التي يظهر فيها هذا اللون.
        </p>
        <div className="space-y-2">
          {colors.map((color, i) => (
            <div key={`${color}-${i}`} className="flex items-center gap-3 bg-accent/30 rounded-lg p-2.5">
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => setEditingColor(editingColor === color ? null : color)}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => onColorChange(color, e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-mono text-foreground" dir="ltr">{color}</p>
                <p className="text-[9px] text-muted-foreground">
                  {COLOR_PRESETS.find(p => p.value.toLowerCase() === color.toLowerCase())?.label || 'لون مخصص'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Presets */}
      <div>
        <h4 className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
          <MaterialIcon icon="auto_awesome" size={14} className="text-amber-500" />
          ألوان سريعة
        </h4>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map(preset => (
            <button
              key={preset.value}
              className="w-8 h-8 rounded-lg border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: preset.value }}
              title={preset.label}
              onClick={() => {
                // Copy color to clipboard for manual use
                navigator.clipboard.writeText(preset.value);
                toast.success(`تم نسخ ${preset.label}: ${preset.value}`);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Text Panel ────────────────────────────────────────────────── */
function TextPanel({ textNodes, onTextChange }: { textNodes: string[]; onTextChange: (old: string, newVal: string) => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const startEdit = (idx: number) => {
    setEditingIndex(idx);
    setEditValue(textNodes[idx]);
  };

  const commitEdit = () => {
    if (editingIndex !== null && editValue !== textNodes[editingIndex]) {
      onTextChange(textNodes[editingIndex], editValue);
    }
    setEditingIndex(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
          <MaterialIcon icon="text_fields" size={14} className="text-primary" />
          النصوص القابلة للتحرير ({textNodes.length})
        </h4>
        <p className="text-[10px] text-muted-foreground mb-3">
          انقر على أي نص لتعديله. سيتم تحديث المعاينة فوراً.
        </p>
      </div>
      <div className="space-y-2">
        {textNodes.map((text, i) => (
          <div key={i} className="bg-accent/30 rounded-lg p-2.5">
            {editingIndex === i ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={Math.min(4, Math.ceil(text.length / 40))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-primary/30 bg-background text-[11px] text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitEdit();
                    }
                    if (e.key === 'Escape') {
                      setEditingIndex(null);
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={commitEdit}
                    className="h-6 px-3 rounded-md bg-primary text-primary-foreground text-[10px] font-medium"
                  >
                    تطبيق
                  </button>
                  <button
                    onClick={() => setEditingIndex(null)}
                    className="h-6 px-3 rounded-md border border-border text-[10px] text-muted-foreground"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => startEdit(i)}
                className="cursor-pointer hover:bg-accent/50 rounded-md p-1.5 transition-all group"
              >
                <p className="text-[11px] text-foreground leading-relaxed">{text}</p>
                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MaterialIcon icon="edit" size={10} className="text-primary" />
                  <span className="text-[9px] text-primary">انقر للتعديل</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Code Panel ────────────────────────────────────────────────── */
function CodePanel({ html, onCodeChange, codeRef }: { html: string; onCodeChange: (code: string) => void; codeRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const [localCode, setLocalCode] = useState(html);
  const [isDirty, setIsDirty] = useState(false);

  // Sync when html changes externally
  useEffect(() => {
    if (!isDirty) {
      setLocalCode(html);
    }
  }, [html, isDirty]);

  const applyCode = () => {
    onCodeChange(localCode);
    setIsDirty(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-[12px] font-bold text-foreground mb-2 flex items-center gap-1.5">
          <MaterialIcon icon="code" size={14} className="text-primary" />
          كود HTML
        </h4>
        <p className="text-[10px] text-muted-foreground mb-3">
          تحرير الكود مباشرة للتحكم الكامل. انقر "تطبيق" لتحديث المعاينة.
        </p>
      </div>
      <textarea
        ref={codeRef}
        value={localCode}
        onChange={(e) => {
          setLocalCode(e.target.value);
          setIsDirty(true);
        }}
        className="w-full h-[calc(100vh-380px)] px-3 py-2 rounded-lg border border-border bg-background text-[11px] font-mono text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
        dir="ltr"
        spellCheck={false}
      />
      {isDirty && (
        <button
          onClick={applyCode}
          className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
        >
          <MaterialIcon icon="play_arrow" size={16} />
          تطبيق التغييرات
        </button>
      )}
    </div>
  );
}
