import { useState, useEffect, useCallback, useRef } from 'react';
import { useRoute } from 'wouter';
import { trpc } from '@/lib/trpc';
import MaterialIcon from '@/components/MaterialIcon';

interface SlideElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style?: Record<string, any>;
}

interface Slide {
  id: string;
  elements: SlideElement[];
  background?: { type: string; color?: string; gradient?: string; imageUrl?: string };
  notes?: string;
  transition?: string;
}

function renderElement(el: SlideElement) {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.width}%`,
    height: `${el.height}%`,
    color: el.style?.color,
    fontFamily: el.style?.fontFamily,
    fontSize: el.style?.fontSize ? `${el.style.fontSize}px` : undefined,
    fontWeight: el.style?.fontWeight,
    textAlign: el.style?.textAlign as any,
    backgroundColor: el.style?.backgroundColor,
    borderRadius: el.style?.borderRadius ? `${el.style.borderRadius}px` : undefined,
    opacity: el.style?.opacity,
    display: 'flex',
    alignItems: el.type === 'heading' ? 'center' : 'flex-start',
    justifyContent: el.style?.textAlign === 'center' ? 'center' : el.style?.textAlign === 'right' ? 'flex-end' : 'flex-start',
    padding: '0.5%',
    overflow: 'hidden',
    direction: 'rtl',
  };

  if (el.type === 'image' && el.style?.imageSrc) {
    return <img key={el.id} src={el.style.imageSrc} alt="" style={{ ...base, objectFit: (el.style?.objectFit as any) || 'cover' }} />;
  }
  if (el.type === 'chart') {
    return (
      <div key={el.id} style={base} className="flex items-center justify-center">
        <MaterialIcon icon="bar_chart" size={48} className="text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div key={el.id} style={base}>
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{el.content}</span>
    </div>
  );
}

function getSlideBackground(bg?: Slide['background']): React.CSSProperties {
  if (!bg) return { background: '#1a1a2e' };
  if (bg.type === 'gradient' && bg.gradient) return { background: bg.gradient };
  if (bg.type === 'image' && bg.imageUrl) return { backgroundImage: `url(${bg.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return { background: bg.color || '#1a1a2e' };
}

export default function SharedPresentation() {
  const [, params] = useRoute('/shared/:token');
  const token = params?.token || '';
  const [password, setPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState<string | undefined>(undefined);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.presentations.viewShared.useQuery(
    { token, password: submittedPassword },
    { enabled: !!token }
  );

  const slides: Slide[] = (() => {
    if (!data || typeof data !== 'object') return [];
    const d = data as Record<string, unknown>;
    if ('error' in d || 'needsPassword' in d) return [];
    try {
      const raw = (d as any).slides;
      return typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
    } catch { return []; }
  })();

  const goNext = useCallback(() => setCurrentSlide(p => Math.min(p + 1, slides.length - 1)), [slides.length]);
  const goPrev = useCallback(() => setCurrentSlide(p => Math.max(p - 1, 0)), []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
      if (e.key === 'Escape') { setIsFullscreen(false); }
      if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, toggleFullscreen]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center animate-fade-in">
          <MaterialIcon icon="progress_activity" size={48} className="text-primary animate-spin mx-auto mb-4" />
          <p className="text-[14px] text-muted-foreground">جاري تحميل العرض...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || (data && typeof data === 'object' && data !== null && 'error' in (data as Record<string, unknown>))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center max-w-md mx-auto p-8">
          <MaterialIcon icon="error_outline" size={64} className="text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">تعذر الوصول</h2>
          <p className="text-muted-foreground">{(data as any)?.error || 'حدث خطأ أثناء تحميل العرض'}</p>
        </div>
      </div>
    );
  }

  // Password required
  if (data && typeof data === 'object' && data !== null && 'needsPassword' in (data as Record<string, unknown>) && (data as any).needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="max-w-sm w-full mx-auto p-8">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
            <div className="text-center mb-6">
              <MaterialIcon icon="lock" size={48} className="text-primary mx-auto mb-3" />
              <h2 className="text-lg font-bold text-foreground mb-1">{(data as any).title || 'عرض محمي'}</h2>
              <p className="text-sm text-muted-foreground">هذا العرض محمي بكلمة مرور</p>
            </div>
            <form onSubmit={e => { e.preventDefault(); setSubmittedPassword(password); }} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
              <button type="submit" className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-all">
                عرض
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Presentation viewer
  const slide = slides[currentSlide];
  if (!slide) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <p className="text-muted-foreground">لا توجد شرائح في هذا العرض</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0a0a1a] flex flex-col" dir="rtl">
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#111128] border-b border-white/5">
          <div className="flex items-center gap-3">
            <MaterialIcon icon="slideshow" size={24} className="text-primary" />
            <h1 className="text-sm font-bold text-white">{(data as any)?.title || 'عرض تقديمي'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">
              {currentSlide + 1} / {slides.length}
            </span>
            {(data as any)?.viewCount !== undefined && (
              <span className="text-xs text-white/30 flex items-center gap-1">
                <MaterialIcon icon="visibility" size={12} />
                {(data as any).viewCount}
              </span>
            )}
            <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-white/5 transition-all">
              <MaterialIcon icon="fullscreen" size={20} className="text-white/60" />
            </button>
          </div>
        </div>
      )}

      {/* Slide Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-5xl rounded-xl overflow-hidden shadow-2xl"
          style={{
            ...getSlideBackground(slide.background),
            aspectRatio: '16/9',
          }}
          onClick={goNext}
        >
          {slide.elements.map(el => renderElement(el))}

          {/* Navigation arrows */}
          <button
            onClick={e => { e.stopPropagation(); goPrev(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
            disabled={currentSlide === 0}
          >
            <MaterialIcon icon="chevron_right" size={24} className="text-white" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); goNext(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center opacity-0 hover:opacity-100 transition-all"
            disabled={currentSlide === slides.length - 1}
          >
            <MaterialIcon icon="chevron_left" size={24} className="text-white" />
          </button>
        </div>
      </div>

      {/* Slide Thumbnails */}
      {!isFullscreen && (
        <div className="flex items-center gap-2 px-4 py-3 bg-[#111128] border-t border-white/5 overflow-x-auto no-scrollbar">
          {slides.map((s, i) => (
            <button
              key={s.id || i}
              onClick={() => setCurrentSlide(i)}
              className={`shrink-0 w-20 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                i === currentSlide ? 'border-primary shadow-lg shadow-primary/20' : 'border-white/10 hover:border-white/20'
              }`}
              style={getSlideBackground(s.background)}
            >
              <span className="text-[8px] text-white/60 font-bold">{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen controls */}
      {isFullscreen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 opacity-0 hover:opacity-100 transition-all z-50">
          <button onClick={goPrev} disabled={currentSlide === 0} className="text-white/70 hover:text-white disabled:opacity-30">
            <MaterialIcon icon="chevron_right" size={20} />
          </button>
          <span className="text-xs text-white/60 min-w-[40px] text-center">{currentSlide + 1}/{slides.length}</span>
          <button onClick={goNext} disabled={currentSlide === slides.length - 1} className="text-white/70 hover:text-white disabled:opacity-30">
            <MaterialIcon icon="chevron_left" size={20} />
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button onClick={() => { document.exitFullscreen(); setIsFullscreen(false); }} className="text-white/70 hover:text-white">
            <MaterialIcon icon="fullscreen_exit" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
