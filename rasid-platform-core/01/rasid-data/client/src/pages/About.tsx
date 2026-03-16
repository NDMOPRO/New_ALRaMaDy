/* ═══════════════════════════════════════════════════════════════════
   RASID — About Page (من نحن)
   Innovative design showcasing NDMO vision, mission, and objectives
   with premium animations, 3D effects, and Rased character
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useTheme } from '@/contexts/ThemeContext';
import MaterialIcon from '@/components/MaterialIcon';
import { NDMO_LOGO, RASED_USAGE } from '@/lib/rasedAssets';
import { LOGOS } from '@/lib/assets';

/* ─── Count-up hook ─── */
function useCountUp(target: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

/* ─── Intersection observer hook ─── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─── Stat card ─── */
function StatCard({ icon, label, value, suffix, delay }: { icon: string; label: string; value: number; suffix: string; delay: number }) {
  const { ref, inView } = useInView();
  const count = useCountUp(value, 2000, inView);
  return (
    <div ref={ref} className={`relative group transition-all duration-700`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="relative bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl p-6 text-center transition-all duration-500 group-hover:border-amber-400/40 group-hover:shadow-[0_8px_32px_rgba(212,175,55,0.12)] group-hover:translate-y-[-4px]">
        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-400/15 to-amber-600/10 flex items-center justify-center border border-amber-400/20">
          <MaterialIcon icon={icon} size={28} className="text-amber-500" />
        </div>
        <div className="text-3xl font-black text-foreground mb-1" style={{ fontFeatureSettings: '"tnum"' }}>
          {inView ? count : 0}<span className="text-amber-500 text-lg mr-1">{suffix}</span>
        </div>
        <div className="text-sm text-muted-foreground font-medium">{label}</div>
      </div>
    </div>
  );
}

/* ─── Objective card ─── */
function ObjectiveCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  const { ref, inView } = useInView(0.15);
  return (
    <div
      ref={ref}
      className={`relative group transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="h-full relative bg-card/60 backdrop-blur-md border border-border/40 rounded-2xl p-6 transition-all duration-500 group-hover:border-amber-400/40 group-hover:shadow-[0_8px_32px_rgba(212,175,55,0.1)] group-hover:translate-y-[-4px]">
        {/* Number badge */}
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
          {index + 1}
        </div>
        <div className="w-12 h-12 mb-4 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/20">
          <MaterialIcon icon={icon} size={24} className="text-primary" />
        </div>
        <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Policy card ─── */
function PolicyCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  const { ref, inView } = useInView(0.15);
  return (
    <div
      ref={ref}
      className={`relative group transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="flex gap-4 items-start bg-card/50 backdrop-blur-md border border-border/30 rounded-xl p-5 transition-all duration-500 group-hover:border-amber-400/30 group-hover:bg-card/70 group-hover:shadow-[0_4px_20px_rgba(212,175,55,0.08)]">
        <div className="w-11 h-11 shrink-0 rounded-lg bg-gradient-to-br from-amber-400/15 to-amber-600/10 flex items-center justify-center border border-amber-400/20">
          <MaterialIcon icon={icon} size={22} className="text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

export default function About() {
  const { theme } = useTheme();
  const [, navigate] = useLocation();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const objectives = [
    { icon: 'account_balance', title: 'حوكمة البيانات الوطنية', desc: 'تطوير إطار حوكمة البيانات على المستوى الوطني وتحديد السياسات والضوابط والمعايير الخاصة بإدارة البيانات' },
    { icon: 'shield', title: 'حماية البيانات الشخصية', desc: 'المحافظة على خصوصية البيانات الشخصية وسرية البيانات الحساسة وحقوق الأفراد عند التعامل معها' },
    { icon: 'share', title: 'نشر ثقافة مشاركة البيانات', desc: 'تعزيز ثقافة مشاركة البيانات بين الجهات الحكومية وتحقيق التكامل والتعاون المشترك' },
    { icon: 'public', title: 'السيادة الرقمية الوطنية', desc: 'المحافظة على السيادة الوطنية الرقمية للبيانات الشخصية وتوفير أفضل مستويات الحماية' },
    { icon: 'verified', title: 'رفع مستوى الثقة', desc: 'رفع مستوى الثقة في الخدمات المعتمدة على البيانات ومعايير الرقابة المجتمعية على أداء الجهات العامة' },
    { icon: 'integration_instructions', title: 'تمكين الجهات الحكومية', desc: 'تمكين الجهات الحكومية من إعداد سياساتها وتنفيذ خططها في مجال إدارة البيانات والذكاء الاصطناعي' },
  ];

  const policies = [
    { icon: 'category', title: 'سياسة تصنيف البيانات', desc: 'حماية سرية البيانات الوطنية على أربعة مستويات: سري للغاية، وسري، ومقيد، ومتاح' },
    { icon: 'person_pin', title: 'سياسة حماية البيانات الشخصية', desc: 'تنظيم عملية جمع البيانات الشخصية ومعالجتها ومشاركتها والحفاظ على السيادة الوطنية الرقمية' },
    { icon: 'swap_horiz', title: 'سياسة مشاركة المعلومات', desc: 'تعزيز مشاركة البيانات والحصول عليها من مصادرها وتحقيق التعاون بين الجهات الحكومية' },
    { icon: 'visibility', title: 'سياسة حرية المعلومات', desc: 'تنظيم إطلاع المستفيدين على المعلومات العامة أو الحصول عليها بكافة أشكالها من الجهات الحكومية' },
    { icon: 'child_care', title: 'سياسة حماية بيانات الأطفال', desc: 'حماية الأطفال من المخاطر المحتملة المترتبة على جمع ومعالجة بياناتهم الشخصية عبر المنصات الرقمية' },
    { icon: 'flight_takeoff', title: 'سياسة نقل البيانات خارج المملكة', desc: 'المحافظة على السيادة الوطنية الرقمية وتوفير أفضل مستويات الحماية عند نقل البيانات الشخصية خارج المملكة' },
    { icon: 'cloud_done', title: 'سياسة البيانات المفتوحة', desc: 'تعزيز الشفافية وتمكين الابتكار من خلال إتاحة البيانات الحكومية المفتوحة للجمهور والقطاع الخاص' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" dir="rtl">

      {/* ═══ HERO SECTION ═══ */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0" style={{
          background: isDark
            ? 'linear-gradient(135deg, oklch(0.18 0.03 250) 0%, oklch(0.14 0.04 240) 40%, oklch(0.12 0.02 220) 100%)'
            : 'linear-gradient(135deg, oklch(0.97 0.01 250) 0%, oklch(0.94 0.02 240) 40%, oklch(0.96 0.01 220) 100%)',
        }} />

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(212,175,55,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />

        {/* Floating orbs */}
        <div className="absolute w-[500px] h-[500px] rounded-full opacity-20" style={{
          background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
          top: '-10%', right: '-5%',
          animation: 'float-slow 12s ease-in-out infinite',
        }} />
        <div className="absolute w-[400px] h-[400px] rounded-full opacity-15" style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
          bottom: '-10%', left: '-5%',
          animation: 'float-slow 15s ease-in-out infinite reverse',
        }} />

        {/* Content */}
        <div className="relative z-10 container max-w-6xl mx-auto px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text side */}
            <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {/* NDMO Logo — compact, no white box */}
              <div className="mb-8">
                <img
                  src={NDMO_LOGO}
                  alt="NDMO — مكتب إدارة البيانات الوطنية"
                  className={`h-14 sm:h-16 w-auto object-contain transition-all duration-500 ${isDark ? 'brightness-0 invert opacity-80' : 'opacity-90'}`}
                />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
                <span className="text-foreground">مكتب إدارة</span>
                <br />
                <span className="bg-gradient-to-l from-amber-400 via-amber-500 to-amber-600 bg-clip-text text-transparent">البيانات الوطنية</span>
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
                الجهة التنظيمية والمرجعية الوطنية لإدارة البيانات وحوكمتها في المملكة العربية السعودية، تأسس عام ٢٠١٩م ويرتبط تنظيمياً بالهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا).
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:translate-y-[-2px] transition-all duration-300 flex items-center gap-2"
                >
                  <MaterialIcon icon="rocket_launch" size={18} />
                  ابدأ مع راصد
                </button>
                <button
                  onClick={() => {
                    document.getElementById('objectives')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-6 py-3 rounded-xl border border-border/60 text-foreground font-bold text-sm hover:border-amber-400/40 hover:bg-amber-400/5 hover:translate-y-[-2px] transition-all duration-300 flex items-center gap-2"
                >
                  <MaterialIcon icon="arrow_downward" size={18} />
                  اكتشف المزيد
                </button>
              </div>
            </div>

            {/* Character side */}
            <div className={`relative flex justify-center transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}>
              {/* Glow behind character */}
              <div className="absolute w-80 h-80 rounded-full" style={{
                background: 'radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)',
                animation: 'pulse-soft 4s ease-in-out infinite',
              }} />
              {/* Decorative rings */}
              <div className="absolute w-72 h-72 rounded-full border border-amber-400/10" style={{ animation: 'logo-orbit 20s linear infinite' }} />
              <div className="absolute w-80 h-80 rounded-full border border-amber-400/5" style={{ animation: 'logo-orbit 25s linear infinite reverse' }} />
              {/* Character */}
              <img
                src={RASED_USAGE.onboardingComplete}
                alt="شخصية راصد"
                className="relative z-10 h-[380px] sm:h-[440px] object-contain drop-shadow-2xl"
                style={{ animation: 'float-slow 6s ease-in-out infinite' }}
              />
            </div>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-6 left-6 z-20 w-10 h-10 rounded-xl bg-card/80 backdrop-blur-md border border-border/50 flex items-center justify-center text-foreground hover:border-amber-400/40 hover:text-amber-500 transition-all duration-300 hover:translate-y-[-2px]"
        >
          <MaterialIcon icon="arrow_back" size={20} />
        </button>
      </section>

      {/* ═══ STATS SECTION ═══ */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/[0.02] to-transparent" />
        <div className="container max-w-5xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard icon="account_balance" label="جهة حكومية" value={200} suffix="+" delay={0} />
            <StatCard icon="policy" label="سياسة وطنية" value={7} suffix="" delay={100} />
            <StatCard icon="calendar_month" label="سنوات من العطاء" value={6} suffix="+" delay={200} />
            <StatCard icon="security" label="مستوى تصنيف" value={4} suffix="" delay={300} />
          </div>
        </div>
      </section>

      {/* ═══ VISION & MISSION ═══ */}
      <section className="relative py-20">
        <div className="container max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Vision */}
            <div className={`relative group transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="h-full relative bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 transition-all duration-500 group-hover:border-amber-400/40 group-hover:shadow-[0_12px_40px_rgba(212,175,55,0.1)]">
                <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 flex items-center justify-center border border-amber-400/25">
                  <MaterialIcon icon="visibility" size={32} className="text-amber-500" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-4">الرؤية</h2>
                <p className="text-muted-foreground leading-relaxed text-base">
                  أن تكون المملكة العربية السعودية رائدة عالمياً في إدارة البيانات وحوكمتها، وتحقيق التميز في الاقتصاد القائم على البيانات ضمن رؤية المملكة ٢٠٣٠.
                </p>
                {/* Decorative corner */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-400/20 rounded-tl-lg" />
              </div>
            </div>

            {/* Mission */}
            <div className={`relative group transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="h-full relative bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-8 transition-all duration-500 group-hover:border-amber-400/40 group-hover:shadow-[0_12px_40px_rgba(212,175,55,0.1)]">
                <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/25">
                  <MaterialIcon icon="flag" size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-4">الرسالة</h2>
                <p className="text-muted-foreground leading-relaxed text-base">
                  وضع سياسات وآليات الحوكمة والمعايير والضوابط الخاصة بالبيانات والذكاء الاصطناعي، ومتابعة الالتزام بها، وتمكين الجهات الحكومية من إدارة بياناتها بكفاءة وفعالية.
                </p>
                {/* Decorative corner */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-primary/20 rounded-tl-lg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ OBJECTIVES ═══ */}
      <section id="objectives" className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
        <div className="container max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-600 dark:text-amber-400 text-xs font-bold mb-4">
              <MaterialIcon icon="target" size={14} />
              الأهداف الاستراتيجية
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground">
              أهداف مكتب إدارة البيانات الوطنية
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {objectives.map((obj, i) => (
              <ObjectiveCard key={i} {...obj} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ POLICIES ═══ */}
      <section className="relative py-20">
        <div className="container max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-4">
              <MaterialIcon icon="gavel" size={14} />
              السياسات الوطنية
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-3">
              سبع سياسات لحوكمة البيانات
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              أقر المكتب سبع سياسات خاصة بحوكمة البيانات الوطنية لرفع مستوى نضج مجال البيانات والذكاء الاصطناعي
            </p>
          </div>
          <div className="space-y-4">
            {policies.map((pol, i) => (
              <PolicyCard key={i} {...pol} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RASID SECTION ═══ */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: isDark
            ? 'linear-gradient(135deg, oklch(0.16 0.04 250) 0%, oklch(0.13 0.03 240) 100%)'
            : 'linear-gradient(135deg, oklch(0.95 0.02 250) 0%, oklch(0.93 0.01 240) 100%)',
        }} />
        <div className="container max-w-5xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center">
              <img
                src={RASED_USAGE.onboardingWelcome}
                alt="شخصية راصد"
                className="h-[280px] sm:h-[340px] object-contain drop-shadow-2xl"
                style={{ animation: 'float-slow 5s ease-in-out infinite' }}
              />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src={LOGOS.dark_header} alt="راصد" className="w-12 h-12 object-contain" />
                <h2 className="text-3xl font-black text-foreground">منصة راصد البيانات</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed text-base mb-6">
                أحد مبادرات مكتب إدارة البيانات الوطنية، تقدم أدوات ذكية متكاملة لرصد وتحليل البيانات الوطنية باستخدام تقنيات الذكاء الاصطناعي المتقدمة.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: 'analytics', label: 'تحليل ذكي' },
                  { icon: 'description', label: 'تقارير احترافية' },
                  { icon: 'dashboard', label: 'لوحات مؤشرات' },
                  { icon: 'compare_arrows', label: 'مطابقة بصرية' },
                  { icon: 'translate', label: 'ترجمة متقدمة' },
                  { icon: 'slideshow', label: 'عروض تقديمية' },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border/30 text-sm text-foreground">
                    <MaterialIcon icon={f.icon} size={18} className="text-amber-500" />
                    {f.label}
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate('/')}
                className="mt-6 px-6 py-3 rounded-xl bg-gradient-to-l from-amber-500 to-amber-600 text-white font-bold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:translate-y-[-2px] transition-all duration-300 flex items-center gap-2"
              >
                <MaterialIcon icon="arrow_back" size={18} />
                العودة إلى المنصة
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-8 border-t border-border/30">
        <div className="container max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-3">
            <img
              src={NDMO_LOGO}
              alt="NDMO"
              className={`h-8 w-auto object-contain ${isDark ? 'brightness-0 invert opacity-60' : 'opacity-50'}`}
            />
            <div className="w-px h-5 bg-border/50" />
            <img src={LOGOS.dark_header} alt="راصد" className="h-8 w-auto object-contain opacity-60" />
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} مكتب إدارة البيانات الوطنية — جميع الحقوق محفوظة
          </p>
        </div>
      </footer>
    </div>
  );
}
