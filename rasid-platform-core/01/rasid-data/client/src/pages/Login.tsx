/* RASID Visual DNA — Login Page — Ultra Premium v3
   Split layout: form (right) + branded visual (left)
   3D depth effects, NDMO logo, golden accents, glassmorphism, particle effects
   Mobile: full-width form with logo on top */
import { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { LOGOS, CHARACTERS } from '@/lib/assets';
import { NDMO_LOGO } from '@/lib/rasedAssets';
import MaterialIcon from '@/components/MaterialIcon';

/* ===== Floating Particles with 3D depth ===== */
function FloatingParticles3D() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ perspective: '800px', transformStyle: 'preserve-3d' }}>
      {Array.from({ length: 25 }).map((_, i) => {
        const size = Math.random() * 4 + 2;
        const z = Math.random() * 100 - 50;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: i % 4 === 0
                ? 'rgba(212,175,55,0.5)'
                : i % 4 === 1
                ? 'rgba(255,215,0,0.3)'
                : i % 4 === 2
                ? 'rgba(59,130,246,0.3)'
                : 'rgba(255,255,255,0.15)',
              transform: `translateZ(${z}px)`,
              animation: `float-particle ${8 + Math.random() * 12}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
              filter: z > 0 ? 'blur(0px)' : `blur(${Math.abs(z) / 30}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/* ===== 3D Animated Golden Rings ===== */
function GoldenRings3D() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ perspective: '600px', transformStyle: 'preserve-3d' }}>
      {/* Outer ring */}
      <div
        className="absolute w-[500px] h-[500px] -top-[250px] -left-[250px] rounded-full opacity-[0.06]"
        style={{
          border: '2px solid rgba(212,175,55,0.5)',
          transform: 'rotateX(60deg) rotateZ(0deg)',
          animation: 'spin 25s linear infinite',
        }}
      />
      {/* Middle ring */}
      <div
        className="absolute w-[400px] h-[400px] -top-[200px] -left-[200px] rounded-full opacity-[0.08]"
        style={{
          border: '1.5px solid rgba(212,175,55,0.4)',
          transform: 'rotateX(60deg) rotateZ(60deg)',
          animation: 'spin 20s linear infinite reverse',
        }}
      />
      {/* Inner ring */}
      <div
        className="absolute w-[300px] h-[300px] -top-[150px] -left-[150px] rounded-full opacity-[0.1]"
        style={{
          border: '1px solid rgba(255,215,0,0.5)',
          transform: 'rotateX(60deg) rotateZ(120deg)',
          animation: 'spin 15s linear infinite',
        }}
      />
    </div>
  );
}

/* ===== 3D Hexagonal Grid Background ===== */
function HexGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hexagons" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
            <path d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100" fill="none" stroke="rgba(212,175,55,0.5)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexagons)" />
      </svg>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [, navigate] = useLocation();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const logo = isDark ? LOGOS.dark_header : LOGOS.light_header;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!userId.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    setLoading(true);
    const result = await login(userId, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'حدث خطأ في تسجيل الدخول');
    }
  }, [userId, password, login, navigate]);

  return (
    <div className="min-h-screen flex bg-background overflow-hidden" dir="rtl">

      {/* ===== Right Side — Form ===== */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-8 relative">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, oklch(0.78 0.12 75) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }} />

        <div className={`w-full max-w-[440px] relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>

          {/* Rasid Logo with golden glow */}
          <div className={`flex justify-center mb-6 relative transition-all duration-700 delay-200 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <div className="absolute inset-0 flex justify-center items-center">
              <div className="w-24 h-24 rounded-full opacity-20" style={{
                background: 'radial-gradient(circle, oklch(0.78 0.12 75), transparent)',
                filter: 'blur(20px)',
              }} />
            </div>
            <img src={logo} alt="راصد" className="h-20 sm:h-24 object-contain animate-float-slow relative z-10" style={{ filter: 'drop-shadow(0 0 18px rgba(212,175,55,0.4)) drop-shadow(0 2px 6px rgba(0,0,0,0.15))' }} />
          </div>

          {/* Welcome Text */}
          <div className={`text-center mb-8 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <h1 className="text-[26px] sm:text-[30px] font-bold text-foreground mb-2">
              مرحباً بك في <span className="gold-text">راصد</span>
            </h1>
            <p className="text-[14px] text-muted-foreground">سجّل دخولك للوصول إلى منصة البيانات الوطنية</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3.5 mb-5 rounded-2xl bg-destructive/10 border border-destructive/20 animate-fade-in backdrop-blur-sm">
              <MaterialIcon icon="error" size={18} className="text-destructive shrink-0" />
              <span className="text-[12px] text-destructive font-medium">{error}</span>
            </div>
          )}

          {/* Form Card — Premium Glass */}
          <div className={`relative transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {/* Golden border glow behind form */}
            <div className="absolute -inset-[1px] rounded-3xl opacity-30" style={{
              background: 'linear-gradient(135deg, oklch(0.78 0.12 75 / 0.3), oklch(0.90 0.08 75 / 0.1), oklch(0.78 0.12 75 / 0.3))',
            }} />

            <form
              onSubmit={handleSubmit}
              className="relative bg-card/80 backdrop-blur-xl rounded-3xl border border-border/50 p-6 sm:p-8 space-y-5 shadow-2xl"
            >
              {/* Top gold accent */}
              <div className="absolute top-0 left-[15%] right-[15%] h-[2px] gold-accent-line" />

              {/* Username */}
              <div className="space-y-2">
                <label className="block text-[12px] font-bold text-foreground">اسم المستخدم</label>
                <div className={`flex items-center gap-3 h-13 border rounded-2xl px-4 bg-background/50 transition-all duration-300 ${
                  focusedField === 'user'
                    ? 'border-primary/50 shadow-lg shadow-primary/10 scale-[1.01]'
                    : 'border-border/60 hover:border-border'
                }`}>
                  <MaterialIcon icon="person" size={18} className={`shrink-0 transition-colors duration-300 ${focusedField === 'user' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <input
                    type="text"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    onFocus={() => setFocusedField('user')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="mruhaily"
                    className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground/60"
                    autoComplete="username"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="block text-[12px] font-bold text-foreground">كلمة المرور</label>
                <div className={`flex items-center gap-3 h-13 border rounded-2xl px-4 bg-background/50 transition-all duration-300 ${
                  focusedField === 'pass'
                    ? 'border-primary/50 shadow-lg shadow-primary/10 scale-[1.01]'
                    : 'border-border/60 hover:border-border'
                }`}>
                  <MaterialIcon icon="lock" size={18} className={`shrink-0 transition-colors duration-300 ${focusedField === 'pass' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="أدخل كلمة المرور"
                    className="flex-1 bg-transparent text-[13px] outline-none text-foreground placeholder:text-muted-foreground/60"
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                  >
                    <MaterialIcon icon={showPassword ? 'visibility_off' : 'visibility'} size={18} />
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${
                      rememberMe
                        ? 'bg-primary border-primary shadow-md shadow-primary/20'
                        : 'border-border hover:border-primary/40 group-hover:scale-110'
                    }`}
                  >
                    {rememberMe && <MaterialIcon icon="check" size={12} className="text-primary-foreground" />}
                  </div>
                  <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">تذكرني</span>
                </label>
                <Link href="/forgot-password" className="text-[12px] text-primary hover:underline font-medium hover:opacity-80 transition-all">
                  نسيت كلمة المرور؟
                </Link>
              </div>

              {/* Submit — Premium Gold-accented Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 rounded-2xl text-[14px] font-bold transition-all duration-300 active:scale-[0.97] disabled:opacity-50 flex items-center justify-center gap-2 relative overflow-hidden group"
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, oklch(0.30 0.08 250), oklch(0.25 0.06 250))'
                    : 'linear-gradient(135deg, oklch(0.30 0.08 250), oklch(0.22 0.06 250))',
                  color: 'white',
                  boxShadow: '0 8px 32px oklch(0.30 0.08 250 / 0.3), inset 0 1px 0 oklch(1 0 0 / 0.1)',
                }}
              >
                {/* Hover shimmer */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(90deg, transparent, oklch(0.78 0.12 75 / 0.15), transparent)',
                    animation: 'shimmer 2s ease-in-out infinite',
                  }}
                />
                {/* Bottom gold line */}
                <div className="absolute bottom-0 left-[20%] right-[20%] h-[2px] gold-accent-line opacity-60" />

                {loading ? (
                  <>
                    <MaterialIcon icon="progress_activity" size={18} className="animate-spin relative z-10" />
                    <span className="relative z-10">جاري تسجيل الدخول...</span>
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="login" size={18} className="relative z-10" />
                    <span className="relative z-10">تسجيل الدخول</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Register Link */}
          <div className="text-center mt-6">
            <span className="text-[13px] text-muted-foreground">ليس لديك حساب؟ </span>
            <Link href="/register" className="text-[13px] font-bold hover:underline transition-all gold-text">
              إنشاء حساب جديد
            </Link>
          </div>

          {/* NDMO Logo + Powered by */}
          <div className="flex flex-col items-center mt-8 gap-2">
            <img
              src={NDMO_LOGO}
              alt="NDMO — مكتب إدارة البيانات الوطنية"
              className="h-8 sm:h-9 w-auto object-contain opacity-50 dark:invert dark:opacity-60 transition-opacity duration-300 hover:opacity-80"
            />
            <span className="text-[10px] text-muted-foreground/40 tracking-wider">مكتب إدارة البيانات الوطنية — NDMO</span>
          </div>
        </div>
      </div>

      {/* ===== Left Side — Branded Visual with 3D Effects (hidden on mobile) ===== */}
      <div
        className="hidden lg:flex w-[45%] relative overflow-hidden items-center justify-center"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #060e1a 0%, #0a1a33 25%, #0f2744 50%, #142d52 75%, #0f2744 100%)'
            : 'linear-gradient(135deg, #081829 0%, #0d2240 25%, #133358 50%, #0f2744 75%, #0a1a33 100%)',
        }}
      >
        {/* 3D Floating particles */}
        <FloatingParticles3D />

        {/* 3D Golden rings */}
        <GoldenRings3D />

        {/* Hexagonal grid background */}
        <HexGrid />

        {/* Decorative 3D orbs */}
        <div className="absolute top-[8%] right-[8%] w-80 h-80 rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, rgba(212,175,55,0.6), transparent)',
            filter: 'blur(40px)',
            animation: 'float-slow 12s ease-in-out infinite',
          }}
        />
        <div className="absolute bottom-[12%] left-[3%] w-60 h-60 rounded-full opacity-[0.06]"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.5), transparent)',
            filter: 'blur(30px)',
            animation: 'float-slow 10s ease-in-out infinite reverse',
          }}
        />
        <div className="absolute top-[55%] right-[55%] w-44 h-44 rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, rgba(255,215,0,0.5), transparent)',
            filter: 'blur(25px)',
            animation: 'float-slow 8s ease-in-out infinite',
            animationDelay: '3s',
          }}
        />

        {/* Golden border on the edge */}
        <div className="absolute top-0 right-0 bottom-0 w-[2px]"
          style={{
            background: 'linear-gradient(to bottom, transparent, oklch(0.78 0.12 75 / 0.4), oklch(0.90 0.08 75 / 0.6), oklch(0.78 0.12 75 / 0.4), transparent)',
          }}
        />

        <div className={`relative z-10 text-center px-12 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Character with 3D glow */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex justify-center items-center">
              <div className="w-52 h-52 rounded-full" style={{
                background: 'radial-gradient(circle, rgba(212,175,55,0.18), transparent)',
                filter: 'blur(35px)',
                animation: 'pulse-soft 4s ease-in-out infinite',
              }} />
            </div>
            {/* 3D shadow under character */}
            <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-40 h-6 rounded-full opacity-20"
              style={{
                background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent)',
                filter: 'blur(8px)',
              }}
            />
            <img
              src={CHARACTERS.char6_standing}
              alt="راصد"
              className="w-56 h-auto mx-auto animate-float-slow drop-shadow-2xl relative z-10"
              style={{
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3)) drop-shadow(0 0 40px rgba(212,175,55,0.1))',
              }}
            />
          </div>

          {/* Title with gold accent */}
          <h2 className="text-[28px] font-bold text-white mb-3">
            منصة <span style={{
              background: 'linear-gradient(135deg, oklch(0.78 0.12 75), oklch(0.90 0.08 75))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>راصد</span> البيانات
          </h2>
          <p className="text-[14px] text-white/70 leading-relaxed max-w-[340px] mx-auto">
            أداتك الذكية لرصد وتحليل البيانات الوطنية — أحد مبادرات مكتب إدارة البيانات الوطنية
          </p>

          {/* Feature pills — Premium with 3D hover */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-8">
            {[
              { label: 'تحليل ذكي', icon: 'analytics' },
              { label: 'تقارير احترافية', icon: 'description' },
              { label: 'لوحات مؤشرات', icon: 'dashboard' },
              { label: 'مطابقة بصرية', icon: 'compare' },
            ].map((f, i) => (
              <span
                key={f.label}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-medium text-white/90 backdrop-blur-md border transition-all duration-500 hover:scale-105 hover:bg-white/15 hover:shadow-[0_4px_16px_rgba(212,175,55,0.15)] ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{
                  background: 'oklch(1 0 0 / 0.08)',
                  borderColor: 'oklch(0.78 0.12 75 / 0.2)',
                  transitionDelay: `${0.6 + i * 0.1}s`,
                }}
              >
                <MaterialIcon icon={f.icon} size={14} style={{ color: 'oklch(0.85 0.10 75)' }} />
                {f.label}
              </span>
            ))}
          </div>

          {/* Stats row with count-up feel */}
          <div className="flex justify-center gap-8 mt-10">
            {[
              { value: '١٥٠+', label: 'جهة حكومية' },
              { value: '٥٠٠+', label: 'تقرير مُنشأ' },
              { value: '٩٩٪', label: 'دقة التحليل' },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${0.8 + i * 0.15}s` }}
              >
                <div className="text-[22px] font-bold" style={{
                  background: 'linear-gradient(135deg, oklch(0.78 0.12 75), oklch(0.90 0.08 75))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{s.value}</div>
                <div className="text-[10px] text-white/50 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
