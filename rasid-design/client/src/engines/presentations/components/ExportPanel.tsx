/**
 * ExportPanel — Export presentations to PPTX, PDF, images
 * E02-0018: PPTX export
 * E02-0019: PDF export
 * E02-0020: Image export (PNG/SVG)
 */

import { useState } from 'react';
import { usePresentationStore } from '../store';
import { exportAndDownloadPPTX, exportAndDownloadPDF } from '../services/export';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileDown, FileText, Image, Presentation, Loader2, Check, AlertCircle,
} from 'lucide-react';

type ExportFormat = 'pptx' | 'pdf' | 'png';
type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

export function ExportPanel() {
  const { deck, activeSlideId } = usePresentationStore();
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!deck) return null;

  const handleExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    setStatus('exporting');
    setProgress(10);
    setErrorMsg('');

    try {
      setProgress(30);

      switch (format) {
        case 'pptx':
          setProgress(50);
          await exportAndDownloadPPTX(deck);
          break;
        case 'pdf':
          setProgress(50);
          await exportAndDownloadPDF(deck);
          break;
        case 'png':
          // Export current slide as image
          setProgress(50);
          const slideEl = document.querySelector('[data-slide-canvas]') as HTMLElement;
          if (slideEl) {
            const { exportSlideAsImage, downloadBlob } = await import('../services/export');
            const blob = await exportSlideAsImage(slideEl, 'png');
            const slideIdx = deck?.slides.findIndex(s => s.id === activeSlideId) ?? 0;
            downloadBlob(blob, `slide-${slideIdx + 1}.png`);
          }
          break;
      }

      setProgress(100);
      setStatus('done');
      setTimeout(() => {
        setStatus('idle');
        setActiveFormat(null);
        setProgress(0);
      }, 2000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'حدث خطأ أثناء التصدير');
      setTimeout(() => {
        setStatus('idle');
        setActiveFormat(null);
        setProgress(0);
      }, 3000);
    }
  };

  const formats: { id: ExportFormat; label: string; desc: string; icon: any }[] = [
    {
      id: 'pptx',
      label: 'PowerPoint',
      desc: 'ملف PPTX قابل للتحرير',
      icon: Presentation,
    },
    {
      id: 'pdf',
      label: 'PDF',
      desc: 'ملف PDF للطباعة والمشاركة',
      icon: FileText,
    },
    {
      id: 'png',
      label: 'صورة PNG',
      desc: 'الشريحة الحالية كصورة',
      icon: Image,
    },
  ];

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <FileDown className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">تصدير العرض</h3>
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {deck.properties.title} — {deck.slides.length} شريحة
      </div>

      {/* Export progress */}
      {status === 'exporting' && (
        <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>جارٍ التصدير...</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {status === 'done' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-xs text-green-600">
          <Check className="w-3 h-3" />
          تم التصدير بنجاح!
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
          <AlertCircle className="w-3 h-3" />
          {errorMsg}
        </div>
      )}

      {/* Format buttons */}
      <div className="space-y-2">
        {formats.map(fmt => {
          const Icon = fmt.icon;
          const isActive = activeFormat === fmt.id && status === 'exporting';

          return (
            <button
              key={fmt.id}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-right
                ${isActive ? 'border-gold bg-gold/5' : 'hover:border-gold/30 hover:bg-muted/30'}
                ${status === 'exporting' && !isActive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              onClick={() => status !== 'exporting' && handleExport(fmt.id)}
              disabled={status === 'exporting'}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isActive ? 'bg-gold/20 text-gold' : 'bg-muted text-muted-foreground'
              }`}>
                {isActive ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{fmt.label}</div>
                <div className="text-[10px] text-muted-foreground">{fmt.desc}</div>
              </div>
              <Badge variant="outline" className="text-[9px]">
                {fmt.id.toUpperCase()}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Export settings */}
      <div className="pt-3 border-t space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">إعدادات التصدير</h4>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">الحجم:</span>
            <span className="mr-1 font-medium">{deck.properties.slideSize}</span>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">الاتجاه:</span>
            <span className="mr-1 font-medium">{deck.properties.direction === 'rtl' ? 'يمين لليسار' : 'يسار لليمين'}</span>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">الشرائح:</span>
            <span className="mr-1 font-medium">{deck.slides.length}</span>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <span className="text-muted-foreground">السمة:</span>
            <span className="mr-1 font-medium">{deck.theme.nameAr || deck.theme.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
