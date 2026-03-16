/**
 * RasedLoader — Custom loading screens with Rased character,
 * golden shimmer effects, and contextual loading messages.
 * 
 * Usage:
 *   <RasedLoader type="default" />
 *   <RasedLoader type="data" message="جاري تحميل البيانات..." />
 *   <RasedLoader type="ai" />
 */
import { useState, useEffect, useRef } from 'react';
import { RASED_USAGE } from '@/lib/rasedAssets';

/* ─── Loading Messages by Type ─── */
const LOADING_MESSAGES: Record<string, string[]> = {
  default: [
    'جاري التحميل...',
    'لحظات وأكون جاهز!',
    'أحضّر لك كل شيء...',
    'راصد يعمل بجد!',
  ],
  data: [
    'جاري تحميل البيانات...',
    'أقرأ الملفات...',
    'أحلل المحتوى...',
    'البيانات في الطريق!',
  ],
  ai: [
    'الذكاء الاصطناعي يفكر...',
    'أحلل طلبك...',
    'أعمل على النتائج...',
    'لحظات وتكون النتيجة جاهزة!',
  ],
  presentation: [
    'أصمم العرض التقديمي...',
    'أختار أفضل التصاميم...',
    'أنسق الشرائح...',
    'عرضك قارب على الجهوزية!',
  ],
  report: [
    'أكتب التقرير...',
    'أجمع البيانات والرسوم...',
    'أنسق الأقسام...',
    'التقرير شبه جاهز!',
  ],
  dashboard: [
    'أبني لوحة المؤشرات...',
    'أحسب الإحصائيات...',
    'أرسم الرسوم البيانية...',
    'اللوحة جاهزة تقريباً!',
  ],
  excel: [
    'أحلل جدول البيانات...',
    'أقرأ الأعمدة والصفوف...',
    'أعالج البيانات...',
    'الجدول في الطريق!',
  ],
  extraction: [
    'أستخرج المحتوى...',
    'أقرأ الملف بعناية...',
    'أحوّل البيانات...',
    'الاستخراج قارب على الانتهاء!',
  ],
  translation: [
    'أترجم النص...',
    'أراعي السياق والمصطلحات...',
    'أدقق الترجمة...',
    'الترجمة شبه جاهزة!',
  ],
};

const CHARACTER_MAP: Record<string, string> = {
  default: RASED_USAGE.loadingDefault,
  data: RASED_USAGE.loadingData,
  ai: RASED_USAGE.loadingAI,
  presentation: RASED_USAGE.loadingPresentation,
  report: RASED_USAGE.loadingReport,
  dashboard: RASED_USAGE.loadingDashboard,
  excel: RASED_USAGE.loadingExcel,
  extraction: RASED_USAGE.loadingExtraction,
  translation: RASED_USAGE.loadingTranslation,
};

export type LoaderType = keyof typeof LOADING_MESSAGES;

interface RasedLoaderProps {
  type?: LoaderType;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Show as full-page overlay */
  fullPage?: boolean;
  /** Show as inline within a container */
  inline?: boolean;
}

/* ─── Floating Particles ─── */
function GoldenParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + Math.random() * 4,
            height: 3 + Math.random() * 4,
            background: `rgba(212, 168, 83, ${0.2 + Math.random() * 0.4})`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Progress Ring ─── */
function ProgressRing({ progress, size }: { progress: number; size: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="absolute -inset-1 animate-spin-slow">
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5d799" />
          <stop offset="50%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#b8860b" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(212,168,83,0.1)"
        strokeWidth="3"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

/* ─── Main RasedLoader Component ─── */
export default function RasedLoader({
  type = 'default',
  message,
  size = 'md',
  fullPage = false,
  inline = false,
}: RasedLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const messages = LOADING_MESSAGES[type] || LOADING_MESSAGES.default;
  const character = CHARACTER_MAP[type] || CHARACTER_MAP.default;
  const displayMessage = message || messages[msgIndex];

  // Cycle through messages
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [messages.length]);

  // Animate dots
  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Simulate progress
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 8;
      });
    }, 800);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const sizes = {
    sm: { char: 'w-16 h-16', ring: 80, text: 'text-xs', gap: 'gap-2', pad: 'p-4' },
    md: { char: 'w-24 h-24', ring: 112, text: 'text-sm', gap: 'gap-3', pad: 'p-6' },
    lg: { char: 'w-32 h-32', ring: 148, text: 'text-base', gap: 'gap-4', pad: 'p-8' },
  };
  const s = sizes[size];

  const content = (
    <div className={`flex flex-col items-center ${s.gap} ${s.pad} animate-fade-in`}>
      {/* Character with Progress Ring */}
      <div className="relative">
        <ProgressRing progress={progress} size={s.ring} />
        <div className={`${s.char} rounded-2xl overflow-hidden bg-gradient-to-br from-gold/10 to-primary/10 p-2 animate-float relative`}>
          <img
            src={character}
            alt="راصد"
            className="w-full h-full object-contain drop-shadow-lg"
          />
          {/* Glow effect */}
          <div className="absolute -inset-2 rounded-2xl opacity-30 animate-pulse" style={{
            background: 'radial-gradient(circle, rgba(212,168,83,0.3) 0%, transparent 70%)',
          }} />
        </div>
      </div>

      {/* Loading Message with Shimmer */}
      <div className="text-center relative">
        <p className={`${s.text} font-bold text-foreground animate-fade-in`} key={msgIndex}>
          {displayMessage}
        </p>
        <p className={`${s.text} text-gold/60 mt-1`}>{dots}</p>
      </div>

      {/* Golden Progress Bar */}
      <div className="w-48 h-1.5 rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #b8860b, #d4a853, #f5d799)',
            boxShadow: '0 0 10px rgba(212,168,83,0.5)',
          }}
        />
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-background/80 backdrop-blur-md">
        <GoldenParticles />
        {content}
      </div>
    );
  }

  if (inline) {
    return content;
  }

  return (
    <div className="flex-1 h-full flex items-center justify-center relative">
      <GoldenParticles />
      {content}
    </div>
  );
}

/* ─── Skeleton Screen Components ─── */

/** Golden shimmer skeleton line */
export function SkeletonLine({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{ width, height, background: 'var(--color-muted)' }}
    >
      <div
        className="h-full w-full animate-shimmer"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.08) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}

/** Golden shimmer skeleton card */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border/30 p-4 space-y-3 overflow-hidden relative ${className}`}>
      <div className="absolute inset-0 animate-shimmer" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(212,168,83,0.05) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }} />
      <SkeletonLine width="60%" height={16} />
      <SkeletonLine width="100%" height={10} />
      <SkeletonLine width="80%" height={10} />
      <div className="flex gap-2 mt-4">
        <SkeletonLine width={60} height={28} />
        <SkeletonLine width={60} height={28} />
      </div>
    </div>
  );
}

/** Engine-specific skeleton screen */
export function EngineSkeleton({ type }: { type: LoaderType }) {
  const character = CHARACTER_MAP[type] || CHARACTER_MAP.default;

  return (
    <div className="flex-1 h-full flex flex-col p-4 gap-4 animate-fade-in relative overflow-hidden">
      <GoldenParticles />

      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 pb-3 border-b border-border/30">
        <SkeletonLine width={120} height={32} />
        <SkeletonLine width={80} height={32} />
        <div className="flex-1" />
        <SkeletonLine width={100} height={32} />
      </div>

      {/* Content area with Rased character */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-gold/10 to-primary/10 p-2 animate-float">
            <img src={character} alt="راصد" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2 w-64">
            <SkeletonLine width="100%" height={14} />
            <SkeletonLine width="70%" height={10} />
          </div>
        </div>
      </div>

      {/* Bottom skeleton */}
      <div className="grid grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
