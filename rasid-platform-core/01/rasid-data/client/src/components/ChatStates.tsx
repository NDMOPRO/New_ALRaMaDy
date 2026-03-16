/* RASID Visual DNA — Chat Canvas States
   15 Ultra Premium interactive states with breathtaking animations
   Each state is a self-contained component rendered inside the chat canvas */
import { useState, useEffect, useRef, useCallback } from 'react';
import MaterialIcon from './MaterialIcon';
import { useTheme } from '@/contexts/ThemeContext';
import { RASED_USAGE } from '@/lib/rasedAssets';

// ============================================================
// TYPE DEFINITIONS
// ============================================================
export type ChatStateType =
  | 'empty'
  | 'loading'
  | 'multi-file'
  | 'suggested-actions'
  | 'plan'
  | 'running'
  | 'success'
  | 'warning'
  | 'failure'
  | 'compare'
  | 'evidence'
  | 'inspector'
  | 'export'
  | 'template-lock'
  | 'fix-retry';

interface ChatStateProps {
  onStateChange?: (state: ChatStateType) => void;
  onBack?: () => void;
}

// ============================================================
// 1. EMPTY STATE — حالة فارغة
// ============================================================
export function EmptyState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; size: number; delay: number }>>([]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    // Generate floating particles
    const p = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 3,
    }));
    setParticles(p);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 relative overflow-hidden">
      {/* Floating particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/10 animate-float-particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${4 + Math.random() * 3}s`,
          }}
        />
      ))}

      {/* Pulsing ring */}
      <div className={`relative mb-6 transition-all duration-1000 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <div className="absolute inset-[-20px] rounded-full border-2 border-primary/10 animate-ping-slow" />
        <div className="absolute inset-[-35px] rounded-full border border-primary/5 animate-ping-slower" />
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center backdrop-blur-sm">
          <MaterialIcon icon="chat_bubble_outline" size={32} className="text-primary/40 animate-breathe" />
        </div>
      </div>

      <h3 className={`text-[16px] font-bold text-foreground mb-2 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        لا توجد محادثات بعد
      </h3>
      <p className={`text-[12px] text-muted-foreground text-center max-w-[280px] mb-6 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        ابدأ محادثة جديدة مع راصد الذكي لتحليل بياناتك أو إنشاء تقاريرك
      </p>

      <div className={`flex gap-2 transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => onStateChange?.('suggested-actions')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20 btn-hover-lift"
        >
          <MaterialIcon icon="auto_awesome" size={15} />
          ابدأ الآن
        </button>
        <button
          onClick={() => onStateChange?.('multi-file')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95"
        >
          <MaterialIcon icon="upload_file" size={15} />
          رفع ملفات
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 2. LOADING STATE — حالة التحميل
// ============================================================
export function LoadingState({ onStateChange }: ChatStateProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const stages = [
    { label: 'جاري تحليل البيانات...', icon: 'analytics', color: 'text-primary' },
    { label: 'استخراج المعلومات...', icon: 'manage_search', color: 'text-info' },
    { label: 'بناء النتائج...', icon: 'construction', color: 'text-warning' },
    { label: 'المراجعة النهائية...', icon: 'fact_check', color: 'text-success' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onStateChange?.('success'), 600);
          return 100;
        }
        return prev + 0.8;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [onStateChange]);

  useEffect(() => {
    if (progress < 25) setStage(0);
    else if (progress < 50) setStage(1);
    else if (progress < 75) setStage(2);
    else setStage(3);
  }, [progress]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      {/* Rasid Character Loading */}
      <div className="relative w-32 h-32 mb-6">
        {/* Outer golden ring with progress */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(212,175,55,0.15)" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldGrad1)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${progress * 2.89} 289`}
            className="transition-all duration-300"
            style={{ filter: 'drop-shadow(0 0 6px rgba(212,175,55,0.4))' }}
          />
          <defs>
            <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="1" />
              <stop offset="100%" stopColor="#f5d060" stopOpacity="0.6" />
            </linearGradient>
          </defs>
        </svg>
        {/* Orbiting gold dot */}
        <div className="absolute w-2.5 h-2.5 rounded-full shadow-lg animate-orbit"
          style={{ top: '0', left: '50%', marginLeft: '-5px', marginTop: '-5px', background: 'linear-gradient(135deg, #d4af37, #f5d060)', boxShadow: '0 0 10px rgba(212,175,55,0.6)' }}
        />
        {/* Inner glow */}
        <div className="absolute inset-3 rounded-full animate-breathe" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)' }} />
        {/* Rasid character */}
        <img
          src={RASED_USAGE.loadingDefault}
          alt="راصد"
          className="absolute inset-4 w-auto h-auto object-contain animate-float-slow"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
        />
      </div>

      {/* Progress percentage */}
      <div className="text-[28px] font-extrabold text-foreground mb-1 tabular-nums animate-count-up">
        {Math.round(progress)}<span className="text-[16px] text-muted-foreground">٪</span>
      </div>

      {/* Stage label */}
      <div className="flex items-center gap-2 mb-6 h-6">
        <MaterialIcon icon={stages[stage].icon} size={16} className={`${stages[stage].color} animate-pulse-soft`} />
        <span className="text-[12px] font-medium text-muted-foreground animate-fade-switch" key={stage}>
          {stages[stage].label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[300px] h-2 bg-accent rounded-full overflow-hidden relative">
        <div
          className="h-full rounded-full bg-gradient-to-l from-primary via-primary/80 to-primary/60 transition-all duration-300 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-l from-white/30 to-transparent animate-shimmer-bar" />
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex items-center gap-3 mt-5">
        {stages.map((s, i) => (
          <div key={i} className={`flex items-center gap-1 transition-all duration-500 ${i <= stage ? 'opacity-100' : 'opacity-30'}`}>
            <div className={`w-2 h-2 rounded-full transition-all duration-500 ${i < stage ? 'bg-success' : i === stage ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'}`} />
            <span className="text-[9px] text-muted-foreground hidden sm:inline">{s.label.replace('...', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 3. MULTI-FILE STATE — حالة متعددة الملفات
// ============================================================
export function MultiFileState({ onStateChange }: ChatStateProps) {
  const [files, setFiles] = useState([
    { id: 1, name: 'بيانات_الجهات_Q4.xlsx', size: '2.4 MB', type: 'excel', progress: 100, status: 'ready' as const },
    { id: 2, name: 'تقرير_الامتثال_السنوي.pdf', size: '5.1 MB', type: 'pdf', progress: 100, status: 'ready' as const },
    { id: 3, name: 'مؤشرات_الأداء.csv', size: '890 KB', type: 'csv', progress: 72, status: 'uploading' as const },
    { id: 4, name: 'محضر_الاجتماع.docx', size: '1.2 MB', type: 'doc', progress: 0, status: 'pending' as const },
  ]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    // Simulate upload progress
    const interval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.status === 'uploading' && f.progress < 100) {
          const newProgress = Math.min(f.progress + 3, 100);
          return { ...f, progress: newProgress, status: newProgress >= 100 ? 'ready' as const : 'uploading' as const };
        }
        if (f.status === 'pending') {
          return { ...f, status: 'uploading' as const, progress: 5 };
        }
        return f;
      }));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const fileIcons: Record<string, { icon: string; color: string; bg: string }> = {
    excel: { icon: 'table_chart', color: 'text-success', bg: 'bg-success/10' },
    pdf: { icon: 'picture_as_pdf', color: 'text-destructive', bg: 'bg-destructive/10' },
    csv: { icon: 'grid_on', color: 'text-info', bg: 'bg-info/10' },
    doc: { icon: 'description', color: 'text-primary', bg: 'bg-primary/10' },
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className={`flex items-center justify-between mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <MaterialIcon icon="folder_open" size={18} className="text-primary" />
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-foreground">الملفات المرفوعة</h3>
            <p className="text-[10px] text-muted-foreground">{files.length} ملفات — {files.filter(f => f.status === 'ready').length} جاهزة</p>
          </div>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-primary/30 text-[10px] font-medium text-primary hover:bg-primary/5 transition-all active:scale-95">
          <MaterialIcon icon="add" size={14} />
          إضافة ملف
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {files.map((file, i) => {
          const fi = fileIcons[file.type] || fileIcons.doc;
          return (
            <div
              key={file.id}
              className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-500 group ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <div className={`w-10 h-10 rounded-xl ${fi.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                <MaterialIcon icon={fi.icon} size={20} className={fi.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-foreground truncate">{file.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-muted-foreground">{file.size}</span>
                  {file.status === 'ready' && (
                    <span className="flex items-center gap-0.5 text-[9px] text-success font-medium">
                      <MaterialIcon icon="check_circle" size={10} />
                      جاهز
                    </span>
                  )}
                  {file.status === 'uploading' && (
                    <span className="flex items-center gap-0.5 text-[9px] text-primary font-medium animate-pulse">
                      <MaterialIcon icon="progress_activity" size={10} className="animate-icon-spin" />
                      {file.progress}٪
                    </span>
                  )}
                  {file.status === 'pending' && (
                    <span className="text-[9px] text-muted-foreground">في الانتظار</span>
                  )}
                </div>
                {file.status === 'uploading' && (
                  <div className="h-1 bg-accent rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-300 relative" style={{ width: `${file.progress}%` }}>
                      <div className="absolute inset-0 bg-gradient-to-l from-white/40 to-transparent animate-shimmer-bar" />
                    </div>
                  </div>
                )}
              </div>
              <button className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all">
                <MaterialIcon icon="close" size={14} className="text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Action bar */}
      <div className={`flex gap-2 mt-4 pt-3 border-t border-border transition-all duration-700 delay-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => onStateChange?.('plan')}
          className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          <MaterialIcon icon="auto_awesome" size={16} />
          تحليل الملفات
        </button>
        <button
          onClick={() => onStateChange?.('compare')}
          className="h-10 px-4 rounded-xl border border-border text-foreground text-[12px] font-medium hover:bg-accent transition-all active:scale-95 flex items-center gap-2"
        >
          <MaterialIcon icon="compare" size={16} />
          مقارنة
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 4. SUGGESTED ACTIONS STATE — حالة الإجراءات المقترحة
// ============================================================
export function SuggestedActionsState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { setVisible(true); }, []);

  const actions = [
    { id: 'analyze', label: 'تحليل شامل', desc: 'تحليل جميع البيانات المرفوعة واستخراج الأنماط', icon: 'analytics', color: '#2563eb', gradient: 'from-blue-500/10 to-blue-600/5' },
    { id: 'dashboard', label: 'لوحة مؤشرات', desc: 'إنشاء لوحة مؤشرات تفاعلية من البيانات', icon: 'dashboard', gradient: 'from-emerald-500/10 to-emerald-600/5', color: '#059669' },
    { id: 'report', label: 'تقرير احترافي', desc: 'إنشاء تقرير مفصل بالتوصيات والنتائج', icon: 'description', gradient: 'from-amber-500/10 to-amber-600/5', color: '#d97706' },
    { id: 'compare', label: 'مقارنة بيانات', desc: 'مقارنة بين مصادر البيانات المختلفة', icon: 'compare_arrows', gradient: 'from-violet-500/10 to-violet-600/5', color: '#7c3aed' },
    { id: 'clean', label: 'تنظيف البيانات', desc: 'تنظيف وتوحيد البيانات وإزالة التكرارات', icon: 'cleaning_services', gradient: 'from-cyan-500/10 to-cyan-600/5', color: '#0891b2' },
    { id: 'extract', label: 'استخراج معلومات', desc: 'استخراج المعلومات الرئيسية من الملفات', icon: 'manage_search', gradient: 'from-rose-500/10 to-rose-600/5', color: '#e11d48' },
  ];

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center gap-2 mb-1">
          <MaterialIcon icon="lightbulb" size={18} className="text-gold" />
          <h3 className="text-[14px] font-bold text-foreground">إجراءات مقترحة</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">بناءً على البيانات المتاحة، إليك أفضل الخيارات</p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-2 content-start overflow-y-auto">
        {actions.map((action, i) => (
          <button
            key={action.id}
            onClick={() => onStateChange?.('plan')}
            onMouseEnter={() => setHoveredId(action.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border border-border bg-gradient-to-br ${action.gradient} hover:shadow-lg hover:border-primary/20 transition-all duration-500 active:scale-[0.97] text-right overflow-hidden group ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            style={{ transitionDelay: `${150 + i * 80}ms` }}
          >
            {/* Hover glow */}
            <div className={`absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-primary/5 group-hover:to-transparent transition-all duration-500`} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${action.color}15` }}
            >
              <MaterialIcon icon={action.icon} size={20} style={{ color: action.color }} />
            </div>
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-foreground mb-0.5">{action.label}</p>
              <p className="text-[9px] text-muted-foreground leading-relaxed">{action.desc}</p>
            </div>
            {/* Arrow indicator */}
            <MaterialIcon
              icon="arrow_forward"
              size={14}
              className={`absolute bottom-2 left-2 transition-all duration-300 ${hoveredId === action.id ? 'opacity-100 translate-x-0 text-primary' : 'opacity-0 translate-x-2 text-muted-foreground'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 5. PLAN STATE — حالة الخطة
// ============================================================
export function PlanState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const steps = [
    { label: 'قراءة وتحليل الملفات المرفوعة', icon: 'description', duration: '~30 ثانية' },
    { label: 'استخراج البيانات وتنظيفها', icon: 'cleaning_services', duration: '~1 دقيقة' },
    { label: 'تحليل الأنماط والمؤشرات', icon: 'analytics', duration: '~2 دقيقة' },
    { label: 'إنشاء التقرير والتوصيات', icon: 'auto_awesome', duration: '~1 دقيقة' },
    { label: 'المراجعة النهائية والتصدير', icon: 'fact_check', duration: '~30 ثانية' },
  ];

  useEffect(() => {
    setVisible(true);
    steps.forEach((_, i) => {
      setTimeout(() => setActiveStep(i), 400 + i * 300);
    });
  }, []);

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center gap-3 mb-5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="route" size={20} className="text-primary" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-foreground">خطة التنفيذ</h3>
          <p className="text-[10px] text-muted-foreground">5 خطوات — الوقت المتوقع: ~5 دقائق</p>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-700 ${i <= activeStep ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'} ${i === activeStep ? 'bg-primary/5 border border-primary/15' : ''}`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {/* Step number with connector line */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-500 ${
                i <= activeStep ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-100' : 'bg-accent text-muted-foreground scale-90'
              }`}>
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-0.5 h-6 mt-1 rounded-full transition-all duration-700 ${i < activeStep ? 'bg-primary/30' : 'bg-border'}`} />
              )}
            </div>
            <div className="pt-1">
              <div className="flex items-center gap-1.5">
                <MaterialIcon icon={step.icon} size={14} className={i <= activeStep ? 'text-primary' : 'text-muted-foreground/40'} />
                <p className={`text-[12px] font-bold transition-colors duration-500 ${i <= activeStep ? 'text-foreground' : 'text-muted-foreground/50'}`}>{step.label}</p>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{step.duration}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`flex gap-2 mt-4 pt-3 border-t border-border transition-all duration-700 delay-[1500ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => onStateChange?.('running')}
          className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 btn-hover-lift"
        >
          <MaterialIcon icon="play_arrow" size={18} />
          بدء التنفيذ
        </button>
        <button
          onClick={() => onStateChange?.('suggested-actions')}
          className="h-10 px-4 rounded-xl border border-border text-muted-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95"
        >
          تعديل
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 6. RUNNING STATE — حالة التشغيل
// ============================================================
export function RunningState({ onStateChange }: ChatStateProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const logsRef = useRef<HTMLDivElement>(null);

  const logMessages = [
    'بدء قراءة الملفات...',
    'تم تحميل بيانات_الجهات_Q4.xlsx',
    'تم تحميل تقرير_الامتثال_السنوي.pdf',
    'جاري استخراج البيانات...',
    'تم استخراج 1,247 سجل',
    'تنظيف البيانات: إزالة 23 تكرار',
    'تحليل الأنماط: تم اكتشاف 8 مؤشرات',
    'إنشاء الرسوم البيانية...',
    'كتابة التوصيات...',
    'المراجعة النهائية...',
  ];

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => onStateChange?.('success'), 800);
          return 100;
        }
        return prev + 0.5;
      });
    }, 50);

    const logInterval = setInterval(() => {
      setLogs(prev => {
        if (prev.length >= logMessages.length) {
          clearInterval(logInterval);
          return prev;
        }
        return [...prev, logMessages[prev.length]];
      });
    }, 800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, []);

  useEffect(() => {
    setCurrentStep(Math.floor(progress / 25));
  }, [progress]);

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header with animated icon */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center overflow-hidden">
            <img src={RASED_USAGE.loadingAI} alt="راصد" className="w-8 h-8 object-contain animate-float-slow" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse shadow-lg" style={{ background: 'linear-gradient(135deg, #d4af37, #f5d060)', boxShadow: '0 0 8px rgba(212,175,55,0.5)' }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-foreground">جاري التنفيذ</h3>
            <span className="text-[14px] font-extrabold text-primary tabular-nums">{Math.round(progress)}٪</span>
          </div>
          <div className="h-2 bg-accent rounded-full mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-l from-primary to-primary/70 transition-all duration-200 relative" style={{ width: `${progress}%` }}>
              <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-l from-white/0 via-white/30 to-white/0" />
            </div>
          </div>
        </div>
      </div>

      {/* Live log */}
      <div ref={logsRef} className="flex-1 bg-accent/30 rounded-xl border border-border p-3 overflow-y-auto font-mono space-y-1">
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 animate-slide-in-right" style={{ animationDelay: `${i * 50}ms` }}>
            <MaterialIcon icon="chevron_left" size={12} className="text-primary/40 mt-0.5 shrink-0" />
            <span className="text-[10px] text-foreground/70">{log}</span>
          </div>
        ))}
        {progress < 100 && (
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>

      {/* Cancel button */}
      <button
        onClick={() => onStateChange?.('warning')}
        className="mt-3 h-9 rounded-xl border border-border text-muted-foreground text-[11px] font-medium hover:bg-destructive/5 hover:text-destructive hover:border-destructive/20 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
      >
        <MaterialIcon icon="stop_circle" size={15} />
        إيقاف التنفيذ
      </button>
    </div>
  );
}

// ============================================================
// 7. SUCCESS STATE — حالة النجاح
// ============================================================
export function SuccessState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState<Array<{ id: number; x: number; delay: number; color: string; size: number }>>([]);

  useEffect(() => {
    setVisible(true);
    const colors = ['#059669', '#2563eb', '#d97706', '#7c3aed', '#e11d48'];
    setConfetti(Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      delay: Math.random() * 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 4 + Math.random() * 6,
    })));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 relative overflow-hidden">
      {/* Confetti */}
      {confetti.map(c => (
        <div
          key={c.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${c.x}%`,
            top: '-10px',
            width: c.size,
            height: c.size,
            backgroundColor: c.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${c.delay}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}

      {/* Success icon with ring burst */}
      <div className={`relative mb-6 transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}>
        <div className="absolute inset-[-15px] rounded-full border-2 border-success/20 animate-success-ring" />
        <div className="absolute inset-[-30px] rounded-full border border-success/10 animate-success-ring-2" />
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success/20 to-success/10 flex items-center justify-center shadow-xl shadow-success/20">
          <MaterialIcon icon="check_circle" size={40} className="text-success animate-success-check" />
        </div>
      </div>

      <h3 className={`text-[18px] font-extrabold text-foreground mb-2 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        تم بنجاح!
      </h3>
      <p className={`text-[12px] text-muted-foreground text-center max-w-[300px] mb-6 transition-all duration-700 delay-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        تم تحليل البيانات وإنشاء التقرير بنجاح. يمكنك الآن تصديره أو مراجعته.
      </p>

      {/* Stats */}
      <div className={`flex gap-4 mb-6 transition-all duration-700 delay-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {[
          { label: 'سجلات', value: '1,247', icon: 'database' },
          { label: 'مؤشرات', value: '8', icon: 'trending_up' },
          { label: 'توصيات', value: '12', icon: 'lightbulb' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-accent/50">
            <MaterialIcon icon={stat.icon} size={16} className="text-success" />
            <span className="text-[14px] font-extrabold text-foreground">{stat.value}</span>
            <span className="text-[9px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className={`flex gap-2 transition-all duration-700 delay-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={() => onStateChange?.('export')}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          <MaterialIcon icon="download" size={15} />
          تصدير
        </button>
        <button
          onClick={() => onStateChange?.('inspector')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95"
        >
          <MaterialIcon icon="visibility" size={15} />
          مراجعة
        </button>
        <button
          onClick={() => onStateChange?.('evidence')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95"
        >
          <MaterialIcon icon="source" size={15} />
          الأدلة
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 8. WARNING STATE — حالة التحذير
// ============================================================
export function WarningState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  const warnings = [
    { label: '3 سجلات تحتوي على قيم مفقودة', severity: 'medium' },
    { label: 'تنسيق التاريخ غير موحد في عمود "تاريخ_التحديث"', severity: 'low' },
    { label: 'تكرار محتمل في 12 سجل', severity: 'medium' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className={`relative mb-6 transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <div className="absolute inset-[-12px] rounded-full bg-warning/10 animate-pulse-glow" />
        <div className="w-18 h-18 rounded-full bg-gradient-to-br from-warning/20 to-warning/10 flex items-center justify-center">
          <MaterialIcon icon="warning" size={36} className="text-warning animate-shake-gentle" />
        </div>
      </div>

      <h3 className={`text-[16px] font-extrabold text-foreground mb-2 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        تحذيرات أثناء المعالجة
      </h3>
      <p className={`text-[11px] text-muted-foreground text-center max-w-[320px] mb-5 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        تم اكتشاف بعض المشكلات التي قد تؤثر على دقة النتائج
      </p>

      <div className={`w-full max-w-[380px] space-y-2 mb-6 transition-all duration-700 delay-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {warnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-warning/5 border border-warning/15 animate-slide-in-right"
            style={{ animationDelay: `${500 + i * 150}ms` }}
          >
            <MaterialIcon icon="error_outline" size={16} className="text-warning shrink-0 mt-0.5" />
            <span className="text-[11px] text-foreground">{w.label}</span>
          </div>
        ))}
      </div>

      <div className={`flex gap-2 transition-all duration-700 delay-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button onClick={() => onStateChange?.('running')} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-warning text-white text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-warning/20">
          <MaterialIcon icon="play_arrow" size={15} />
          متابعة رغم التحذيرات
        </button>
        <button onClick={() => onStateChange?.('fix-retry')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95">
          <MaterialIcon icon="build" size={15} />
          إصلاح
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 9. FAILURE STATE — حالة الفشل
// ============================================================
export function FailureState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(true); }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className={`relative mb-6 transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        <div className="absolute inset-[-12px] rounded-full bg-destructive/10 animate-pulse-glow" />
        <div className="w-18 h-18 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center">
          <MaterialIcon icon="error" size={36} className="text-destructive animate-shake-gentle" />
        </div>
      </div>

      <h3 className={`text-[16px] font-extrabold text-foreground mb-2 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        فشل في التنفيذ
      </h3>
      <p className={`text-[11px] text-muted-foreground text-center max-w-[320px] mb-4 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        حدث خطأ أثناء معالجة البيانات. يمكنك إعادة المحاولة أو مراجعة التفاصيل.
      </p>

      {/* Error details */}
      <div className={`w-full max-w-[380px] p-3 rounded-xl bg-destructive/5 border border-destructive/15 mb-6 transition-all duration-700 delay-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <MaterialIcon icon="bug_report" size={14} className="text-destructive" />
          <span className="text-[10px] font-bold text-destructive">تفاصيل الخطأ</span>
        </div>
        <p className="text-[10px] text-foreground/70 font-mono bg-destructive/5 p-2 rounded-lg" dir="ltr">
          Error: Column "compliance_score" contains non-numeric values in rows 45, 89, 234. Expected: number, Got: string.
        </p>
      </div>

      <div className={`flex gap-2 transition-all duration-700 delay-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button onClick={() => onStateChange?.('fix-retry')} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20">
          <MaterialIcon icon="refresh" size={15} />
          إعادة المحاولة
        </button>
        <button onClick={() => onStateChange?.('inspector')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95">
          <MaterialIcon icon="search" size={15} />
          فحص البيانات
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 10. COMPARE STATE — قارن المصدر مقابل الإخراج
// ============================================================
export function CompareState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'side' | 'diff'>('side');

  useEffect(() => { setVisible(true); }, []);

  const sourceData = [
    { field: 'اسم الجهة', value: 'وزارة المالية' },
    { field: 'نسبة الامتثال', value: '78%' },
    { field: 'عدد المخالفات', value: '12' },
    { field: 'التصنيف', value: 'متوسط' },
    { field: 'آخر تحديث', value: '2024/03/01' },
  ];

  const outputData = [
    { field: 'اسم الجهة', value: 'وزارة المالية', changed: false },
    { field: 'نسبة الامتثال', value: '82%', changed: true },
    { field: 'عدد المخالفات', value: '8', changed: true },
    { field: 'التصنيف', value: 'جيد', changed: true },
    { field: 'آخر تحديث', value: '2024/03/14', changed: true },
  ];

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center justify-between mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <MaterialIcon icon="compare" size={18} className="text-violet-500" />
          </div>
          <h3 className="text-[13px] font-bold text-foreground">مقارنة المصدر والمخرج</h3>
        </div>
        <div className="flex gap-1 bg-accent rounded-lg p-0.5">
          <button onClick={() => setActiveTab('side')} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === 'side' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            جنباً لجنب
          </button>
          <button onClick={() => setActiveTab('diff')} className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${activeTab === 'diff' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            الفروقات
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'side' ? (
          <div className="grid grid-cols-2 gap-2">
            {/* Source */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-accent/50 border-b border-border">
                <span className="text-[10px] font-bold text-muted-foreground">المصدر</span>
              </div>
              <div className="p-2 space-y-1">
                {sourceData.map((d, i) => (
                  <div key={i} className={`p-2 rounded-lg text-[10px] transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${200 + i * 80}ms` }}
                  >
                    <span className="text-muted-foreground block text-[9px]">{d.field}</span>
                    <span className="text-foreground font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Output */}
            <div className="rounded-xl border border-primary/20 overflow-hidden">
              <div className="px-3 py-2 bg-primary/5 border-b border-primary/10">
                <span className="text-[10px] font-bold text-primary">المخرج</span>
              </div>
              <div className="p-2 space-y-1">
                {outputData.map((d, i) => (
                  <div key={i} className={`p-2 rounded-lg text-[10px] transition-all duration-500 ${d.changed ? 'bg-success/5 border border-success/15' : ''} ${visible ? 'opacity-100' : 'opacity-0'}`}
                    style={{ transitionDelay: `${300 + i * 80}ms` }}
                  >
                    <span className="text-muted-foreground block text-[9px]">{d.field}</span>
                    <span className={`font-medium ${d.changed ? 'text-success' : 'text-foreground'}`}>{d.value}</span>
                    {d.changed && <MaterialIcon icon="arrow_upward" size={10} className="text-success inline mr-1" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {outputData.filter(d => d.changed).map((d, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border border-border bg-card transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              >
                <MaterialIcon icon="swap_horiz" size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] text-muted-foreground block">{d.field}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-destructive/70 line-through">{sourceData.find(s => s.field === d.field)?.value}</span>
                    <MaterialIcon icon="arrow_forward" size={12} className="text-muted-foreground" />
                    <span className="text-[11px] text-success font-bold">{d.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button onClick={() => onStateChange?.('export')} className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
          <MaterialIcon icon="check" size={15} />
          اعتماد المخرج
        </button>
        <button onClick={() => onStateChange?.('fix-retry')} className="h-9 px-4 rounded-xl border border-border text-muted-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95">
          تعديل
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 11. EVIDENCE DRAWER — درج الأدلة
// ============================================================
export function EvidenceDrawerState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(0);

  useEffect(() => { setVisible(true); }, []);

  const evidences = [
    { id: 0, title: 'مصدر البيانات الأساسي', type: 'ملف', source: 'بيانات_الجهات_Q4.xlsx', snippet: 'الصف 1-500: بيانات الامتثال للجهات الحكومية للربع الرابع 2024', confidence: 95 },
    { id: 1, title: 'تقرير الامتثال المرجعي', type: 'تقرير', source: 'تقرير_الامتثال_السنوي.pdf', snippet: 'الفصل 3: معايير الامتثال الوطنية — المادة 12 تنص على...', confidence: 88 },
    { id: 2, title: 'المعيار الوطني للبيانات', type: 'معيار', source: 'NDMO-STD-2024-v3', snippet: 'البند 4.2: يجب أن تحقق الجهات نسبة امتثال لا تقل عن 80%', confidence: 100 },
    { id: 3, title: 'بيانات الفترة السابقة', type: 'مقارنة', source: 'بيانات_Q3_2024.xlsx', snippet: 'مقارنة مع الربع الثالث: تحسن بنسبة 4% في المتوسط العام', confidence: 82 },
  ];

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center gap-2 mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <MaterialIcon icon="source" size={18} className="text-amber-500" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-foreground">الأدلة والمصادر</h3>
          <p className="text-[10px] text-muted-foreground">{evidences.length} مصادر مرجعية</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {evidences.map((ev, i) => (
          <div
            key={ev.id}
            className={`rounded-xl border border-border overflow-hidden transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${expandedId === ev.id ? 'shadow-md border-primary/20' : ''}`}
            style={{ transitionDelay: `${150 + i * 100}ms` }}
          >
            <button
              onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <MaterialIcon icon={ev.type === 'ملف' ? 'description' : ev.type === 'تقرير' ? 'article' : ev.type === 'معيار' ? 'verified' : 'compare'} size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-right">
                <p className="text-[11px] font-bold text-foreground">{ev.title}</p>
                <p className="text-[9px] text-muted-foreground">{ev.source}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-success/10">
                  <span className="text-[9px] font-bold text-success">{ev.confidence}%</span>
                </div>
                <MaterialIcon icon={expandedId === ev.id ? 'expand_less' : 'expand_more'} size={16} className="text-muted-foreground" />
              </div>
            </button>
            {expandedId === ev.id && (
              <div className="px-3 pb-3 animate-slide-in-bottom">
                <div className="p-2.5 rounded-lg bg-accent/30 border border-border text-[10px] text-foreground/70 leading-relaxed">
                  {ev.snippet}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => onStateChange?.('success')} className="mt-3 h-9 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95 flex items-center justify-center gap-1.5">
        <MaterialIcon icon="arrow_back" size={14} />
        العودة للنتائج
      </button>
    </div>
  );
}

// ============================================================
// 12. INSPECTOR PANEL — لوحة المفتش
// ============================================================
export function InspectorState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'quality'>('overview');

  useEffect(() => { setVisible(true); }, []);

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center justify-between mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <MaterialIcon icon="manage_search" size={18} className="text-cyan-500" />
          </div>
          <h3 className="text-[13px] font-bold text-foreground">لوحة المفتش</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-accent rounded-xl p-1 mb-4">
        {[
          { id: 'overview' as const, label: 'نظرة عامة', icon: 'dashboard' },
          { id: 'details' as const, label: 'التفاصيل', icon: 'list_alt' },
          { id: 'quality' as const, label: 'الجودة', icon: 'verified' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all ${activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <MaterialIcon icon={tab.icon} size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-3 animate-fade-in">
            {/* Score card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/15">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-foreground">نقاط الجودة الإجمالية</span>
                <span className="text-[22px] font-extrabold text-primary">87<span className="text-[12px]">/100</span></span>
              </div>
              <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full w-[87%] relative">
                  <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-l from-white/0 via-white/30 to-white/0" />
                </div>
              </div>
            </div>
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'الاكتمال', value: '92%', icon: 'check_circle', color: 'text-success' },
                { label: 'الدقة', value: '88%', icon: 'gps_fixed', color: 'text-primary' },
                { label: 'الاتساق', value: '85%', icon: 'sync', color: 'text-info' },
                { label: 'التوقيت', value: '79%', icon: 'schedule', color: 'text-warning' },
              ].map((m, i) => (
                <div key={i} className={`p-3 rounded-xl border border-border bg-card transition-all duration-500 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  <MaterialIcon icon={m.icon} size={18} className={m.color} />
                  <p className="text-[16px] font-extrabold text-foreground mt-1">{m.value}</p>
                  <p className="text-[9px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-2 animate-fade-in">
            {[
              { label: 'إجمالي السجلات', value: '1,247' },
              { label: 'السجلات الصالحة', value: '1,224' },
              { label: 'السجلات المرفوضة', value: '23' },
              { label: 'الأعمدة المعالجة', value: '18' },
              { label: 'الجهات المشمولة', value: '45' },
              { label: 'الفترة الزمنية', value: 'Q4 2024' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-accent/30 border border-border">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[12px] font-bold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-3 animate-fade-in">
            {[
              { label: 'فحص القيم المفقودة', status: 'pass', detail: '99.8% مكتمل' },
              { label: 'فحص التكرارات', status: 'warn', detail: '12 سجل مكرر' },
              { label: 'فحص التنسيق', status: 'pass', detail: 'جميع الأعمدة متوافقة' },
              { label: 'فحص النطاق', status: 'fail', detail: '3 قيم خارج النطاق' },
              { label: 'فحص المرجعية', status: 'pass', detail: 'جميع المراجع صالحة' },
            ].map((check, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <MaterialIcon
                  icon={check.status === 'pass' ? 'check_circle' : check.status === 'warn' ? 'warning' : 'cancel'}
                  size={18}
                  className={check.status === 'pass' ? 'text-success' : check.status === 'warn' ? 'text-warning' : 'text-destructive'}
                />
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-foreground">{check.label}</p>
                  <p className="text-[9px] text-muted-foreground">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => onStateChange?.('success')} className="mt-3 h-9 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95 flex items-center justify-center gap-1.5">
        <MaterialIcon icon="arrow_back" size={14} />
        العودة
      </button>
    </div>
  );
}

// ============================================================
// 13. EXPORT PANEL — لوحة التصدير
// ============================================================
export function ExportState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => { setVisible(true); }, []);

  const formats = [
    { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf', color: '#dc2626', desc: 'تقرير جاهز للطباعة' },
    { id: 'excel', label: 'Excel', icon: 'table_chart', color: '#059669', desc: 'جداول بيانات قابلة للتحرير' },
    { id: 'pptx', label: 'PowerPoint', icon: 'slideshow', color: '#d97706', desc: 'عرض تقديمي' },
    { id: 'json', label: 'JSON', icon: 'data_object', color: '#7c3aed', desc: 'بيانات خام للمطورين' },
    { id: 'csv', label: 'CSV', icon: 'grid_on', color: '#0891b2', desc: 'جدول بسيط' },
  ];

  const handleExport = () => {
    setExporting(true);
    setExportProgress(0);
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setExporting(false), 500);
          return 100;
        }
        return prev + 5;
      });
    }, 80);
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center gap-2 mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <MaterialIcon icon="download" size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-foreground">تصدير النتائج</h3>
          <p className="text-[10px] text-muted-foreground">اختر صيغة التصدير المناسبة</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {formats.map((fmt, i) => (
          <button
            key={fmt.id}
            onClick={() => setSelectedFormat(fmt.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 group ${
              selectedFormat === fmt.id ? 'border-primary/30 bg-primary/5 shadow-md' : 'border-border bg-card hover:shadow-sm'
            } ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
            style={{ transitionDelay: `${150 + i * 80}ms` }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ backgroundColor: `${fmt.color}15` }}
            >
              <MaterialIcon icon={fmt.icon} size={22} style={{ color: fmt.color }} />
            </div>
            <div className="flex-1 text-right">
              <p className="text-[12px] font-bold text-foreground">{fmt.label}</p>
              <p className="text-[9px] text-muted-foreground">{fmt.desc}</p>
            </div>
            {selectedFormat === fmt.id && (
              <MaterialIcon icon="check_circle" size={18} className="text-primary animate-scale-in" />
            )}
          </button>
        ))}
      </div>

      {/* Export button */}
      <div className="mt-3 pt-3 border-t border-border">
        {exporting ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="progress_activity" size={14} className="text-primary animate-icon-spin" />
                جاري التصدير...
              </span>
              <span className="text-[11px] font-bold text-primary">{Math.round(exportProgress)}٪</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-200 relative" style={{ width: `${exportProgress}%` }}>
                <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-l from-white/0 via-white/30 to-white/0" />
              </div>
            </div>
            {exportProgress >= 100 && (
              <div className="flex items-center gap-1.5 text-success text-[11px] font-medium animate-fade-in">
                <MaterialIcon icon="check_circle" size={14} />
                تم التصدير بنجاح!
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={handleExport}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 btn-hover-lift"
          >
            <MaterialIcon icon="download" size={17} />
            تصدير كـ {formats.find(f => f.id === selectedFormat)?.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 14. TEMPLATE LOCK — قفل القالب
// ============================================================
export function TemplateLockState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => { setVisible(true); }, []);

  const handleUnlock = () => {
    setUnlocking(true);
    setTimeout(() => {
      setLocked(false);
      setUnlocking(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      {/* Lock icon with animation */}
      <div className={`relative mb-6 transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
        {locked && !unlocking && (
          <>
            <div className="absolute inset-[-15px] rounded-full border-2 border-primary/15 animate-pulse-glow" />
            <div className="absolute inset-[-30px] rounded-full border border-primary/8 animate-ping-slower" />
          </>
        )}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${
          locked ? 'bg-gradient-to-br from-primary/15 to-primary/10' : 'bg-gradient-to-br from-success/15 to-success/10'
        }`}>
          {unlocking ? (
            <MaterialIcon icon="progress_activity" size={36} className="text-primary animate-icon-spin" />
          ) : (
            <MaterialIcon
              icon={locked ? 'lock' : 'lock_open'}
              size={36}
              className={`${locked ? 'text-primary' : 'text-success'} transition-all duration-500 ${!locked ? 'animate-success-check' : ''}`}
            />
          )}
        </div>
      </div>

      <h3 className={`text-[16px] font-extrabold text-foreground mb-2 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {locked ? 'القالب مقفل' : 'تم فتح القالب'}
      </h3>
      <p className={`text-[11px] text-muted-foreground text-center max-w-[320px] mb-6 transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {locked
          ? 'هذا القالب محمي ويتطلب صلاحيات المحرر لتعديله. يمكنك فتحه للتعديل أو استخدامه كما هو.'
          : 'يمكنك الآن تعديل القالب بحرية. سيتم حفظ التغييرات تلقائياً.'
        }
      </p>

      {/* Template info */}
      <div className={`w-full max-w-[340px] p-4 rounded-xl bg-accent/50 border border-border mb-6 transition-all duration-700 delay-400 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="flex items-center gap-3 mb-3">
          <MaterialIcon icon="description" size={20} className="text-primary" />
          <div>
            <p className="text-[12px] font-bold text-foreground">قالب تقرير الامتثال السنوي</p>
            <p className="text-[9px] text-muted-foreground">الإصدار 3.2 — آخر تحديث: مارس 2024</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-[9px] font-medium text-primary">رسمي</span>
          <span className="px-2 py-0.5 rounded-md bg-success/10 text-[9px] font-medium text-success">معتمد</span>
          <span className="px-2 py-0.5 rounded-md bg-info/10 text-[9px] font-medium text-info">NDMO</span>
        </div>
      </div>

      <div className={`flex gap-2 transition-all duration-700 delay-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {locked ? (
          <>
            <button onClick={handleUnlock} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-primary/20">
              <MaterialIcon icon="lock_open" size={15} />
              فتح للتعديل
            </button>
            <button onClick={() => onStateChange?.('plan')} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95">
              <MaterialIcon icon="play_arrow" size={15} />
              استخدام كما هو
            </button>
          </>
        ) : (
          <button onClick={() => onStateChange?.('plan')} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-success text-white text-[11px] font-medium hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-success/20">
            <MaterialIcon icon="edit" size={15} />
            بدء التعديل
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 15. FIX / RETRY FLOW — إصلاح / إعادة محاولة التدفق
// ============================================================
export function FixRetryState({ onStateChange }: ChatStateProps) {
  const [visible, setVisible] = useState(false);
  const [selectedFixes, setSelectedFixes] = useState<string[]>(['fix-values', 'fix-format']);
  const [fixing, setFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState(0);

  useEffect(() => { setVisible(true); }, []);

  const fixes = [
    { id: 'fix-values', label: 'تصحيح القيم غير الصالحة', desc: 'استبدال 3 قيم نصية بقيم رقمية', icon: 'edit_note', auto: true },
    { id: 'fix-format', label: 'توحيد تنسيق التاريخ', desc: 'تحويل جميع التواريخ إلى YYYY/MM/DD', icon: 'calendar_today', auto: true },
    { id: 'fix-duplicates', label: 'إزالة التكرارات', desc: 'حذف 12 سجل مكرر', icon: 'delete_sweep', auto: true },
    { id: 'fix-missing', label: 'ملء القيم المفقودة', desc: 'استخدام المتوسط لـ 3 قيم مفقودة', icon: 'auto_fix_high', auto: false },
  ];

  const toggleFix = (id: string) => {
    setSelectedFixes(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleFix = () => {
    setFixing(true);
    setFixProgress(0);
    const interval = setInterval(() => {
      setFixProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => onStateChange?.('running'), 800);
          return 100;
        }
        return prev + 3;
      });
    }, 80);
  };

  return (
    <div className="flex flex-col h-full p-4">
      <div className={`flex items-center gap-2 mb-4 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <MaterialIcon icon="build" size={18} className="text-amber-500" />
        </div>
        <div>
          <h3 className="text-[13px] font-bold text-foreground">إصلاح وإعادة المحاولة</h3>
          <p className="text-[10px] text-muted-foreground">حدد الإصلاحات المطلوبة ثم أعد التنفيذ</p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {fixes.map((fix, i) => (
          <button
            key={fix.id}
            onClick={() => toggleFix(fix.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
              selectedFixes.includes(fix.id) ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-accent/30'
            } ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'}`}
            style={{ transitionDelay: `${150 + i * 100}ms` }}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              selectedFixes.includes(fix.id) ? 'bg-primary border-primary' : 'border-border'
            }`}>
              {selectedFixes.includes(fix.id) && <MaterialIcon icon="check" size={12} className="text-primary-foreground" />}
            </div>
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <MaterialIcon icon={fix.icon} size={16} className="text-primary" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-[11px] font-bold text-foreground">{fix.label}</p>
              <p className="text-[9px] text-muted-foreground">{fix.desc}</p>
            </div>
            {fix.auto && (
              <span className="px-1.5 py-0.5 rounded-md bg-success/10 text-[8px] font-bold text-success shrink-0">تلقائي</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        {fixing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
                <MaterialIcon icon="build" size={14} className="text-amber-500 animate-icon-spin" />
                جاري الإصلاح...
              </span>
              <span className="text-[11px] font-bold text-primary">{Math.round(fixProgress)}٪</span>
            </div>
            <div className="h-2 bg-accent rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-l from-amber-500 to-amber-400 rounded-full transition-all duration-200 relative" style={{ width: `${fixProgress}%` }}>
                <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-l from-white/0 via-white/30 to-white/0" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleFix}
              disabled={selectedFixes.length === 0}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-40"
            >
              <MaterialIcon icon="auto_fix_high" size={17} />
              إصلاح وإعادة التنفيذ ({selectedFixes.length})
            </button>
            <button
              onClick={() => onStateChange?.('plan')}
              className="h-10 px-4 rounded-xl border border-border text-muted-foreground text-[11px] font-medium hover:bg-accent transition-all active:scale-95"
            >
              تخطي
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
