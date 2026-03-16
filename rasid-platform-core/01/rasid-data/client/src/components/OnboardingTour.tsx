/**
 * OnboardingTour — Interactive guided tour with spotlight overlay,
 * golden tooltips, and Rased character animations.
 * 
 * Shows on first login, persisted via localStorage.
 * Step-by-step tour covering all main services.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RASED_USAGE } from '@/lib/rasedAssets';
import MaterialIcon from './MaterialIcon';

/* ─── Tour Step Definition ─── */
interface TourStep {
  /** CSS selector to spotlight */
  target: string;
  /** Title shown in tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Rased character image URL */
  character: string;
  /** Character speech bubble text */
  speech?: string;
  /** Tooltip placement relative to target */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Icon for the step indicator */
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="welcome"]',
    title: 'مرحباً بك في راصد البيانات',
    description: 'منصة ذكية لإدارة وتحليل البيانات الوطنية. دعني أعرّفك على أهم الأدوات والخدمات المتاحة لك.',
    character: RASED_USAGE.onboardingWelcome,
    speech: 'أهلاً وسهلاً! أنا راصد، مساعدك الذكي. تعال أوريك المنصة!',
    placement: 'center',
    icon: 'waving_hand',
  },
  {
    target: '[data-tour="data-panel"]',
    title: 'لوحة البيانات',
    description: 'هنا تجد جميع ملفاتك ومصادر بياناتك. يمكنك رفع ملفات Excel وPDF وCSV وسحبها مباشرة إلى المنصة.',
    character: RASED_USAGE.onboardingData,
    speech: 'ارفع بياناتك هنا وأنا أتكفل بالباقي!',
    placement: 'left',
    icon: 'database',
  },
  {
    target: '[data-tour="chat-canvas"]',
    title: 'المحادثة الذكية',
    description: 'تحدث معي بالعربية! اطلب تحليل بيانات، إنشاء تقارير، أو أي مهمة تريدها. أفهم طلباتك وأنفذها فوراً.',
    character: RASED_USAGE.onboardingChat,
    speech: 'اكتب طلبك وأنا أنفذه... جرّب الآن!',
    placement: 'right',
    icon: 'chat',
  },
  {
    target: '[data-tour="tab-presentations"]',
    title: 'محرك العروض التقديمية',
    description: 'أنشئ عروضاً احترافية بالذكاء الاصطناعي. اختر من مكتبة القوالب أو دع الذكاء الاصطناعي يصمم لك عرضاً كاملاً.',
    character: RASED_USAGE.onboardingPresentation,
    speech: 'عروض تقديمية مذهلة بضغطة زر!',
    placement: 'bottom',
    icon: 'slideshow',
  },
  {
    target: '[data-tour="tab-reports"]',
    title: 'محرك التقارير',
    description: 'أنشئ تقارير مفصلة مع رسوم بيانية وجداول. يمكنك تحرير كل قسم وتصدير التقرير كـ PDF.',
    character: RASED_USAGE.onboardingReport,
    speech: 'تقارير احترافية جاهزة للطباعة!',
    placement: 'bottom',
    icon: 'article',
  },
  {
    target: '[data-tour="tab-dashboards"]',
    title: 'لوحات المؤشرات',
    description: 'صمم لوحات مؤشرات تفاعلية مع رسوم بيانية حية. اسحب وأفلت العناصر لتخصيص اللوحة.',
    character: RASED_USAGE.onboardingDashboard,
    speech: 'بياناتك في لوحة واحدة... بصرياً!',
    placement: 'bottom',
    icon: 'dashboard',
  },
  {
    target: '[data-tour="tab-extraction"]',
    title: 'محرك التفريغ',
    description: 'استخرج البيانات من أي ملف — صور، PDF، صوت، فيديو. الذكاء الاصطناعي يقرأ ويفهم المحتوى.',
    character: RASED_USAGE.onboardingExtraction,
    speech: 'أقرأ أي ملف وأستخرج بياناته!',
    placement: 'bottom',
    icon: 'document_scanner',
  },
  {
    target: '[data-tour="tab-translation"]',
    title: 'محرك الترجمة',
    description: 'ترجمة ذكية مع الحفاظ على المصطلحات التقنية. يدعم معجم مخصص لمصطلحات البيانات الوطنية.',
    character: RASED_USAGE.onboardingTranslation,
    speech: 'ترجمة دقيقة تراعي السياق!',
    placement: 'bottom',
    icon: 'translate',
  },
  {
    target: '[data-tour="studio-panel"]',
    title: 'الاستوديو',
    description: 'أدوات إنشاء المخرجات — لوحات مؤشرات، تقارير، عروض، مطابقة، تعريب، وتفريغ. كل شيء في مكان واحد.',
    character: RASED_USAGE.onboardingStudio,
    speech: 'كل أدوات الإنتاج هنا!',
    placement: 'right',
    icon: 'auto_awesome',
  },
  {
    target: '[data-tour="complete"]',
    title: 'أنت جاهز!',
    description: 'الآن أنت تعرف كل شيء عن المنصة. ابدأ بتحميل بياناتك أو اطلب مني أي مهمة عبر المحادثة. أنا دائماً هنا لمساعدتك!',
    character: RASED_USAGE.onboardingComplete,
    speech: 'يلا نبدأ! أنت تأمر وأنا أطامر!',
    placement: 'center',
    icon: 'rocket_launch',
  },
];

const STORAGE_KEY = 'rasid_onboarding_completed';

/* ─── Spotlight Overlay ─── */
function SpotlightOverlay({ rect, onClick }: { rect: DOMRect | null; onClick: () => void }) {
  if (!rect) {
    // Center mode — full overlay with no spotlight
    return (
      <div
        className="fixed inset-0 z-[9998] transition-all duration-500"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 100%)' }}
        onClick={onClick}
      />
    );
  }

  const padding = 12;
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const r = 16;

  return (
    <svg
      className="fixed inset-0 z-[9998] w-full h-full transition-all duration-500"
      onClick={onClick}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
        {/* Golden glow filter */}
        <filter id="gold-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feFlood floodColor="#d4a853" floodOpacity="0.6" result="color" />
          <feComposite in="color" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Dark overlay with spotlight cutout */}
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#spotlight-mask)" />
      {/* Golden border around spotlight */}
      <rect
        x={x} y={y} width={w} height={h} rx={r} ry={r}
        fill="none"
        stroke="url(#gold-border-grad)"
        strokeWidth="2.5"
        filter="url(#gold-glow)"
        className="animate-pulse"
      />
      {/* Golden gradient for border */}
      <defs>
        <linearGradient id="gold-border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d799" />
          <stop offset="50%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ─── Golden Tooltip ─── */
function GoldenTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const isCenter = step.placement === 'center';
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  useEffect(() => {
    if (!tooltipRef.current) return;
    const tt = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (isCenter || !targetRect) {
      setPos({ top: (vh - tt.height) / 2, left: (vw - tt.width) / 2 });
      return;
    }

    let top = 0;
    let left = 0;
    const gap = 20;

    switch (step.placement) {
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width - tt.width) / 2;
        break;
      case 'top':
        top = targetRect.top - tt.height - gap;
        left = targetRect.left + (targetRect.width - tt.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tt.height) / 2;
        left = targetRect.left - tt.width - gap;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tt.height) / 2;
        left = targetRect.right + gap;
        break;
    }

    // Clamp within viewport
    left = Math.max(16, Math.min(left, vw - tt.width - 16));
    top = Math.max(16, Math.min(top, vh - tt.height - 16));

    setPos({ top, left });
  }, [targetRect, step.placement, isCenter, stepIndex]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] animate-fade-in"
      style={{ top: pos.top, left: pos.left, maxWidth: isCenter ? 520 : 420 }}
    >
      <div className="relative rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, rgba(212,168,83,0.15) 0%, rgba(15,23,42,0.95) 30%, rgba(15,23,42,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        border: '2px solid transparent',
        backgroundClip: 'padding-box',
      }}>
        {/* Golden border gradient */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
          background: 'linear-gradient(135deg, #f5d799, #d4a853, #b8860b, #d4a853) border-box',
          mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '2px',
          borderRadius: '1rem',
        }} />

        {/* Shimmer effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 animate-shimmer" style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }} />
        </div>

        <div className="p-5 relative">
          {/* Character + Speech Bubble */}
          <div className="flex items-start gap-4 mb-4">
            {/* Rased Character */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-gold/20 p-1 animate-float">
                <img
                  src={step.character}
                  alt="راصد"
                  className="w-full h-full object-contain"
                />
              </div>
              {/* Glow ring */}
              <div className="absolute -inset-1 rounded-xl opacity-50 animate-pulse" style={{
                background: 'linear-gradient(135deg, #d4a853, transparent, #d4a853)',
                filter: 'blur(4px)',
                zIndex: -1,
              }} />
            </div>

            {/* Speech Bubble */}
            {step.speech && (
              <div className="relative flex-1 bg-gradient-to-br from-gold/10 to-transparent rounded-xl px-4 py-3 border border-gold/20">
                <div className="absolute -right-0 top-4 w-0 h-0 border-t-[8px] border-t-transparent border-l-[10px] border-l-gold/20 border-b-[8px] border-b-transparent" style={{ right: '-10px' }} />
                <p className="text-sm text-gold font-medium leading-relaxed">{step.speech}</p>
              </div>
            )}
          </div>

          {/* Step Icon + Title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center">
              <MaterialIcon icon={step.icon} size={22} className="text-gold" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{step.title}</h3>
              <span className="text-xs text-gold/60">الخطوة {stepIndex + 1} من {totalSteps}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed mb-5">{step.description}</p>

          {/* Progress Bar */}
          <div className="flex gap-1.5 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full flex-1 transition-all duration-500"
                style={{
                  background: i <= stepIndex
                    ? 'linear-gradient(90deg, #d4a853, #f5d799)'
                    : 'rgba(255,255,255,0.1)',
                  boxShadow: i <= stepIndex ? '0 0 8px rgba(212,168,83,0.4)' : 'none',
                }}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-gray-400 hover:text-gold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              تخطي الجولة
            </button>

            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-gold/80 hover:text-gold bg-gold/5 hover:bg-gold/10 border border-gold/20 transition-all"
                >
                  <MaterialIcon icon="arrow_forward" size={16} />
                  السابق
                </button>
              )}
              <button
                onClick={onNext}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-black transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f5d799, #d4a853, #b8860b)',
                  boxShadow: '0 4px 15px rgba(212,168,83,0.4)',
                }}
              >
                {isLast ? 'ابدأ الآن!' : 'التالي'}
                <MaterialIcon icon={isLast ? 'rocket_launch' : 'arrow_back'} size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main OnboardingTour Component ─── */
export default function OnboardingTour({ onComplete }: { onComplete?: () => void }) {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  // Check if onboarding was already completed
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay start to let the page render
      const timer = setTimeout(() => setActive(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Find and track the target element
  const updateTargetRect = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step || step.placement === 'center') {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(step.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!active) return;
    updateTargetRect();

    // Watch for layout changes
    resizeObserver.current = new ResizeObserver(updateTargetRect);
    resizeObserver.current.observe(document.body);

    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      resizeObserver.current?.disconnect();
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [active, currentStep, updateTargetRect]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Tour complete
      localStorage.setItem(STORAGE_KEY, 'true');
      setActive(false);
      onComplete?.();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
    onComplete?.();
  }, [onComplete]);

  if (!active) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      <SpotlightOverlay
        rect={targetRect}
        onClick={() => {}} // Don't close on overlay click
      />
      <GoldenTooltip
        step={step}
        stepIndex={currentStep}
        totalSteps={TOUR_STEPS.length}
        targetRect={targetRect}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </>
  );
}

/**
 * Hook to manually trigger the onboarding tour
 */
export function useOnboardingTour() {
  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  const isCompleted = useMemo(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }, []);

  return { resetTour, isCompleted };
}
