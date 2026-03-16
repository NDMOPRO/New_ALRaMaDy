/* RASID — Compare View
   Side-by-side or overlay comparison surface for artifacts.
   Used by strict matching, versioning, and diff views. */
import { useState } from 'react';
import MaterialIcon from './MaterialIcon';

interface CompareViewProps {
  isOpen: boolean;
  onClose: () => void;
  leftTitle?: string;
  rightTitle?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  diffStats?: { added: number; removed: number; changed: number };
}

export default function CompareView({ isOpen, onClose, leftTitle, rightTitle, leftContent, rightContent, diffStats }: CompareViewProps) {
  const [mode, setMode] = useState<'side-by-side' | 'overlay' | 'split'>('side-by-side');
  const [overlayOpacity, setOverlayOpacity] = useState(50);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-card/98 backdrop-blur-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <MaterialIcon icon="compare" size={18} className="text-primary" />
        <h3 className="text-[14px] font-bold text-foreground">المقارنة</h3>

        {/* Mode Switcher */}
        <div className="flex items-center gap-0.5 bg-accent/40 rounded-lg p-0.5 mr-3">
          {[
            { id: 'side-by-side' as const, icon: 'view_column', label: 'جنباً لجنب' },
            { id: 'overlay' as const, icon: 'layers', label: 'تراكب' },
            { id: 'split' as const, icon: 'vertical_split', label: 'تقسيم' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                mode === m.id ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MaterialIcon icon={m.icon} size={13} />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Diff Stats */}
        {diffStats && (
          <div className="flex items-center gap-2 mr-auto">
            <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">+{diffStats.added} مضاف</span>
            <span className="text-[10px] font-medium text-danger bg-danger/10 px-1.5 py-0.5 rounded">-{diffStats.removed} محذوف</span>
            <span className="text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded">~{diffStats.changed} معدّل</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Overlay slider */}
        {mode === 'overlay' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">شفافية</span>
            <input
              type="range"
              min={0}
              max={100}
              value={overlayOpacity}
              onChange={e => setOverlayOpacity(Number(e.target.value))}
              className="w-24 h-1 accent-primary"
            />
            <span className="text-[10px] text-muted-foreground w-8">{overlayOpacity}%</span>
          </div>
        )}

        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-all">
          <MaterialIcon icon="close" size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-3">
        {mode === 'side-by-side' && (
          <div className="flex gap-3 h-full">
            {/* Left */}
            <div className="flex-1 flex flex-col rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/20 border-b border-border shrink-0">
                <MaterialIcon icon="arrow_back" size={14} className="text-muted-foreground" />
                <span className="text-[12px] font-medium text-foreground">{leftTitle || 'المصدر'}</span>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {leftContent || (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MaterialIcon icon="upload_file" size={40} className="opacity-20 mb-2" />
                    <p className="text-[12px]">أسقط الملف المصدر هنا</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="flex-1 flex flex-col rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/20 border-b border-border shrink-0">
                <MaterialIcon icon="arrow_forward" size={14} className="text-muted-foreground" />
                <span className="text-[12px] font-medium text-foreground">{rightTitle || 'المخرج'}</span>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {rightContent || (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MaterialIcon icon="preview" size={40} className="opacity-20 mb-2" />
                    <p className="text-[12px]">سيظهر المخرج هنا</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode === 'overlay' && (
          <div className="relative h-full rounded-xl border border-border overflow-hidden">
            <div className="absolute inset-0 p-3 overflow-auto">
              {leftContent || <div className="text-center text-muted-foreground text-[12px] mt-20">المصدر</div>}
            </div>
            <div className="absolute inset-0 p-3 overflow-auto" style={{ opacity: overlayOpacity / 100 }}>
              {rightContent || <div className="text-center text-primary text-[12px] mt-20">المخرج</div>}
            </div>
          </div>
        )}

        {mode === 'split' && (
          <div className="relative h-full rounded-xl border border-border overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="w-1/2 overflow-auto p-3 border-l border-dashed border-primary/30">
                {leftContent || <div className="text-center text-muted-foreground text-[12px] mt-20">{leftTitle || 'المصدر'}</div>}
              </div>
              <div className="w-1/2 overflow-auto p-3">
                {rightContent || <div className="text-center text-muted-foreground text-[12px] mt-20">{rightTitle || 'المخرج'}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
