/* ═══════════════════════════════════════════════════════════════════
   ChatCanvas — راصد الذكي — AI مفتوح بالكامل
   - كل طلب يُرسل مباشرة للذكاء الاصطناعي
   - الذكاء يفهم الطلب ويختار المحرك المناسب تلقائياً
   - لا wizards، لا خطوات يدوية — AI كامل مفتوح
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { trpc } from '@/lib/trpc';
import { useJobWebSocket, type JobUpdateEvent } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import MaterialIcon from './MaterialIcon';
import { CHARACTERS, QUICK_ACTIONS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  isStreaming?: boolean;
  /** Dynamic action buttons shown below the message */
  actions?: Array<{ id: string; label: string; icon: string; variant?: 'primary' | 'secondary' | 'success' | 'danger' }>;
  /** Execution stages attached to an assistant message */
  stages?: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed'; progress: number }>;
  /** Artifacts produced by this message */
  artifacts?: Array<{ id: string; type: 'dashboard' | 'report' | 'presentation' | 'data' | 'match'; label: string; icon: string }>;
}

/* ─── Public handle for parent ─── */
export interface ChatCanvasHandle {
  sendMessage: (text: string) => void;
}

const ChatCanvas = forwardRef<ChatCanvasHandle>(function ChatCanvas(_props, ref) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dropSnap, setDropSnap] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // AI mutations via tRPC
  const chatMutation = trpc.ai.chat.useMutation();
  const generateSlidesMutation = trpc.ai.generateSlides.useMutation();
  const generateReportMutation = trpc.ai.generateReport.useMutation();
  const analyzeDashboardMutation = trpc.ai.analyzeDashboard.useMutation();
  const translateMutation = trpc.ai.translate.useMutation();
  const summarizeMutation = trpc.ai.summarize.useMutation();
  const createPresentation = trpc.presentations.create.useMutation();
  const createReport = trpc.reports.create.useMutation();
  const createDashboard = trpc.dashboards.create.useMutation();

  const character = theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving;
  const [welcomeVisible, setWelcomeVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Expose sendMessage to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => {
      setInput(text);
      // Trigger send after state update
      setTimeout(() => {
        const fakeInput = text;
        doSend(fakeInput);
      }, 100);
    },
  }));

  // WebSocket for real-time job progress tracking
  const handleJobWsUpdate = useCallback((event: JobUpdateEvent) => {
    if (event.progress !== undefined) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.stages) {
          const updated = { ...last, stages: last.stages.map(s =>
            s.status === 'running' ? { ...s, progress: event.progress ?? s.progress } : s
          ) };
          return [...prev.slice(0, -1), updated];
        }
        return prev;
      });
    }
    if (event.result) {
      toast.success('تم إكمال المهمة بنجاح', { duration: 3000 });
    }
    if (event.error) {
      toast.error(`فشلت المهمة: ${event.error}`, { duration: 5000 });
    }
  }, []);
  useJobWebSocket(handleJobWsUpdate);

  // Welcome entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setWelcomeVisible(true), 150);
    return () => clearTimeout(timer);
  }, []);

  // Parallax mouse tracking for welcome screen
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePos({ x, y });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) {
        setChatMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ==================== AI Chat — Open AI Agent ====================
  // ─── Intent Detection ─── Detects what the user wants and routes to the right engine
  const detectIntent = (text: string): { intent: string; topic: string } => {
    const t = text;
    // Presentation / عرض
    if (/عرض|شرائح|سلايد|بريزنتيشن|presentation|slides|pptx/i.test(t))
      return { intent: 'presentation', topic: t.replace(/أنشئ|نفذ|اعمل|سوي|سو|اصنع|صمم|جهز|حضر|لي|عرض تقديمي|عرض|عن|بعنوان|حول|يتكلم|يتحدث/gi, '').trim() || t };
    // Report / تقرير
    if (/تقرير|تقارير|ريبورت|report/i.test(t))
      return { intent: 'report', topic: t.replace(/أنشئ|نفذ|اعمل|سوي|سو|اصنع|صمم|جهز|حضر|لي|تقرير|عن|بعنوان|حول/gi, '').trim() || t };
    // Dashboard / لوحة
    if (/لوحة|داشبورد|مؤشر|مؤشرات|dashboard|kpi|احصائ/i.test(t))
      return { intent: 'dashboard', topic: t.replace(/أنشئ|نفذ|اعمل|سوي|سو|اصنع|صمم|جهز|حضر|لي|لوحة مؤشرات|لوحة|عن|بعنوان|حول/gi, '').trim() || t };
    // Translation / ترجمة
    if (/ترجم|ترجمة|translate/i.test(t))
      return { intent: 'translate', topic: t };
    // Summary / تلخيص
    if (/لخص|تلخيص|ملخص|summarize|summary/i.test(t))
      return { intent: 'summarize', topic: t };
    // Default — regular chat
    return { intent: 'chat', topic: t };
  };

  const addAssistantMessage = useCallback((content: string, extras?: Partial<ChatMessage>) => {
    setIsTyping(false);
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant' as const,
      content,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      ...extras,
    }]);
  }, []);

  const doSend = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const userText = text.trim();

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const { intent, topic } = detectIntent(userText);

      // ═══ PRESENTATION ENGINE ═══
      if (intent === 'presentation') {
        addAssistantMessage('جاري إنشاء العرض التقديمي... ⏳', {
          stages: [
            { name: 'تحليل الموضوع', status: 'completed', progress: 100 },
            { name: 'توليد الشرائح', status: 'running', progress: 50 },
            { name: 'التنسيق والتصميم', status: 'pending', progress: 0 },
          ],
        });

        const slidesResult = await generateSlidesMutation.mutateAsync({
          prompt: topic || userText,
          slideCount: 8,
          style: 'professional',
        });

        const slides = slidesResult.slides || [];
        let savedId = '';
        if (slides.length > 0) {
          const saved = await createPresentation.mutateAsync({
            title: slides[0]?.title || topic || 'عرض تقديمي جديد',
            description: topic,
            slides: JSON.stringify(slides),
            theme: 'ndmo',
          });
          savedId = saved?.id ? String(saved.id) : '';
        }

        addAssistantMessage(
          `تم إنشاء العرض التقديمي بنجاح! 🎉\n\n**${slides[0]?.title || 'العرض'}**\n\nيحتوي على **${slides.length} شرائح** جاهزة.\n\n${slides.map((s: any, i: number) => `${i + 1}. ${s.title}`).join('\n')}`,
          {
            stages: [
              { name: 'تحليل الموضوع', status: 'completed', progress: 100 },
              { name: 'توليد الشرائح', status: 'completed', progress: 100 },
              { name: 'التنسيق والتصميم', status: 'completed', progress: 100 },
            ],
            artifacts: [{ id: savedId || 'pres-1', type: 'presentation', label: slides[0]?.title || 'عرض تقديمي', icon: 'slideshow' }],
            actions: [
              { id: 'open-presentation', label: 'فتح في محرر العروض', icon: 'slideshow', variant: 'primary' },
              { id: 'new-presentation', label: 'عرض آخر', icon: 'add', variant: 'secondary' },
            ],
          }
        );
        return;
      }

      // ═══ REPORT ENGINE ═══
      if (intent === 'report') {
        addAssistantMessage('جاري إنشاء التقرير... ⏳', {
          stages: [
            { name: 'تحليل المتطلبات', status: 'completed', progress: 100 },
            { name: 'كتابة الأقسام', status: 'running', progress: 40 },
            { name: 'المراجعة النهائية', status: 'pending', progress: 0 },
          ],
        });

        const reportResult = await generateReportMutation.mutateAsync({
          prompt: topic || userText,
          reportType: 'general',
        });

        const sections = reportResult.sections || [];
        let savedId = '';
        if (sections.length > 0) {
          const saved = await createReport.mutateAsync({
            title: topic || 'تقرير جديد',
            description: topic,
            reportType: 'general',
            sections: JSON.stringify(sections),
          });
          savedId = saved?.id ? String(saved.id) : '';
        }

        addAssistantMessage(
          `تم إنشاء التقرير بنجاح! 📄\n\n**${topic || 'التقرير'}**\n\nيحتوي على **${sections.length} أقسام**:\n\n${sections.map((s: any, i: number) => `${i + 1}. ${s.title || s.type || 'قسم'}`).join('\n')}`,
          {
            stages: [
              { name: 'تحليل المتطلبات', status: 'completed', progress: 100 },
              { name: 'كتابة الأقسام', status: 'completed', progress: 100 },
              { name: 'المراجعة النهائية', status: 'completed', progress: 100 },
            ],
            artifacts: [{ id: savedId || 'report-1', type: 'report', label: topic || 'تقرير', icon: 'description' }],
            actions: [
              { id: 'open-report', label: 'فتح في محرر التقارير', icon: 'description', variant: 'primary' },
              { id: 'new-report', label: 'تقرير آخر', icon: 'add', variant: 'secondary' },
            ],
          }
        );
        return;
      }

      // ═══ DASHBOARD ENGINE ═══
      if (intent === 'dashboard') {
        addAssistantMessage('جاري إنشاء لوحة المؤشرات... ⏳', {
          stages: [
            { name: 'تحليل المؤشرات', status: 'completed', progress: 100 },
            { name: 'تصميم الودجات', status: 'running', progress: 50 },
            { name: 'ربط البيانات', status: 'pending', progress: 0 },
          ],
        });

        const dashResult = await analyzeDashboardMutation.mutateAsync({
          prompt: topic || userText,
        });

        const widgets = dashResult.widgets || [];
        let savedId = '';
        if (widgets.length > 0) {
          const saved = await createDashboard.mutateAsync({
            title: topic || 'لوحة مؤشرات جديدة',
            description: topic,
            widgets: JSON.stringify(widgets),
            layout: '{}',
          });
          savedId = saved?.id ? String(saved.id) : '';
        }

        addAssistantMessage(
          `تم إنشاء لوحة المؤشرات بنجاح! 📊\n\n**${topic || 'لوحة المؤشرات'}**\n\nتحتوي على **${widgets.length} ودجات**:\n\n${widgets.map((w: any, i: number) => `${i + 1}. ${w.title || w.type || 'ودجة'}`).join('\n')}`,
          {
            stages: [
              { name: 'تحليل المؤشرات', status: 'completed', progress: 100 },
              { name: 'تصميم الودجات', status: 'completed', progress: 100 },
              { name: 'ربط البيانات', status: 'completed', progress: 100 },
            ],
            artifacts: [{ id: savedId || 'dash-1', type: 'dashboard', label: topic || 'لوحة مؤشرات', icon: 'dashboard' }],
            actions: [
              { id: 'open-dashboard', label: 'فتح في محرر اللوحات', icon: 'dashboard', variant: 'primary' },
              { id: 'new-dashboard', label: 'لوحة أخرى', icon: 'add', variant: 'secondary' },
            ],
          }
        );
        return;
      }

      // ═══ TRANSLATE ═══
      if (intent === 'translate') {
        const translateResult = await translateMutation.mutateAsync({
          text: topic,
          sourceLang: 'auto',
          targetLang: /\b(إنجليزي|english|en)\b/i.test(userText) ? 'en' : 'ar',
        });
        addAssistantMessage(`**الترجمة:**\n\n${translateResult.translated || translateResult.content || 'تمت الترجمة'}`, {
          actions: [{ id: 'translate-again', label: 'ترجمة أخرى', icon: 'translate', variant: 'secondary' }],
        });
        return;
      }

      // ═══ SUMMARIZE ═══
      if (intent === 'summarize') {
        const summaryResult = await summarizeMutation.mutateAsync({ text: topic });
        addAssistantMessage(`**الملخص:**\n\n${summaryResult.summary || summaryResult.content || 'تم التلخيص'}`, {
          actions: [{ id: 'summarize-again', label: 'تلخيص آخر', icon: 'summarize', variant: 'secondary' }],
        });
        return;
      }

      // ═══ REGULAR CHAT ═══
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user' as const, content: userText });
      const result = await chatMutation.mutateAsync({ messages: chatHistory });

      addAssistantMessage(result.content || 'تم معالجة طلبك.', {
        actions: [
          { id: 'presentation', label: 'أنشئ عرض تقديمي', icon: 'slideshow', variant: 'primary' },
          { id: 'dashboard', label: 'أنشئ لوحة مؤشرات', icon: 'dashboard', variant: 'secondary' },
          { id: 'report', label: 'أنشئ تقرير', icon: 'description', variant: 'secondary' },
        ],
      });
    } catch (error: any) {
      setIsTyping(false);
      const errorMsg = error?.message?.includes('API') || error?.message?.includes('OPENAI')
        ? 'عذراً، لم يتم تكوين مفتاح الذكاء الاصطناعي بعد. يرجى إضافة OPENAI_API_KEY في إعدادات Railway.'
        : `عذراً، حدث خطأ: ${error?.message || 'يرجى المحاولة مرة أخرى.'}`;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
  }, [messages, chatMutation, generateSlidesMutation, generateReportMutation, analyzeDashboardMutation, translateMutation, summarizeMutation, createPresentation, createReport, createDashboard, addAssistantMessage]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    doSend(text);
  }, [input, doSend]);

  // Handle action button clicks — route to correct engine
  const handleActionClick = useCallback((action: { id: string; label: string }) => {
    // Direct engine triggers from action buttons
    if (action.id === 'open-presentation' || action.id === 'presentation') {
      doSend('أنشئ عرض تقديمي');
    } else if (action.id === 'open-report' || action.id === 'report') {
      doSend('أنشئ تقرير');
    } else if (action.id === 'open-dashboard' || action.id === 'dashboard' || action.id === 'analyze') {
      doSend('أنشئ لوحة مؤشرات');
    } else if (action.id === 'new-presentation') {
      doSend('أنشئ عرض تقديمي آخر');
    } else if (action.id === 'new-report') {
      doSend('أنشئ تقرير آخر');
    } else if (action.id === 'new-dashboard') {
      doSend('أنشئ لوحة مؤشرات أخرى');
    } else {
      doSend(action.label);
    }
  }, [doSend]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setChatMenuOpen(false);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div
      ref={canvasRef}
      className={`flex-1 h-full rounded-xl flex flex-col overflow-hidden relative ${dragOver ? 'drop-zone-active' : ''}`}
      style={{
        background: 'var(--card)',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        border: '1px solid var(--border)',
      }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const rasidData = e.dataTransfer.getData('application/rasid-item');
        if (rasidData) {
          try {
            const item = JSON.parse(rasidData);
            const dropText = `تحليل: ${item.title}`;
            setInput(prev => prev ? `${prev}\n${dropText}` : dropText);
            setDropSnap(true);
            setTimeout(() => setDropSnap(false), 400);
          } catch { /* ignore parse errors */ }
        }
      }}
      onMouseMove={isEmpty ? handleMouseMove : undefined}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-8 right-8 h-[1px] rounded-full z-10" style={{ background: 'linear-gradient(90deg, transparent, var(--primary) / 0.15, transparent)' }} />
      
      {/* Header */}
      <div
        className="h-10 sm:h-11 flex items-center justify-between px-3 sm:px-4 shrink-0 relative"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <img src={character} alt="راصد" className="w-7 h-7 rounded-full object-contain" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))' }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
          </div>
          <span className="text-[13px] sm:text-[14px] font-bold text-foreground" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>راصد الذكي</span>
          {isTyping && (
            <span className="text-[10px] text-primary animate-pulse-soft mr-1">يفكر...</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <div className="relative" ref={chatMenuRef}>
            <button
              onClick={() => setChatMenuOpen(!chatMenuOpen)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all active:scale-95"
            >
              <MaterialIcon icon="more_vert" size={16} className="text-muted-foreground" />
            </button>
            {chatMenuOpen && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-popover rounded-xl shadow-xl border border-border py-1 z-50 animate-menu-pop">
                <button
                  onClick={handleNewConversation}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground hover:bg-accent transition-all"
                >
                  <MaterialIcon icon="add" size={15} />
                  محادثة جديدة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* ═══ Empty Welcome Screen ═══ */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full px-4 sm:px-6 relative overflow-hidden">
            {/* Ambient background effects */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute w-[300px] h-[300px] rounded-full opacity-[0.03] blur-[80px] transition-transform duration-[800ms] ease-out"
                style={{
                  background: 'radial-gradient(circle, var(--primary) 0%, transparent 70%)',
                  top: '20%',
                  left: '30%',
                  transform: `translate(${mousePos.x * 20}px, ${mousePos.y * 15}px)`,
                }}
              />
              <div
                className="absolute w-[200px] h-[200px] rounded-full opacity-[0.02] blur-[60px] transition-transform duration-[1000ms] ease-out"
                style={{
                  background: 'radial-gradient(circle, var(--gold) 0%, transparent 70%)',
                  bottom: '25%',
                  right: '25%',
                  transform: `translate(${mousePos.x * -15}px, ${mousePos.y * -10}px)`,
                }}
              />
            </div>

            {/* Character with parallax */}
            <div
              className={`relative mb-3 sm:mb-5 transition-all duration-700 ${welcomeVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-90'}`}
              style={{ transform: welcomeVisible ? `translate(${mousePos.x * 8}px, ${mousePos.y * 5}px)` : undefined }}
            >
              <div className="absolute inset-[-12px] rounded-full bg-primary/[0.03] animate-pulse-glow" />
              <img
                src={character}
                alt="راصد الذكي"
                className="w-24 h-24 sm:w-32 sm:h-32 object-contain animate-float-slow relative z-10 drop-shadow-lg"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-3 bg-foreground/[0.04] rounded-full blur-md animate-pulse-soft" />
            </div>

            {/* Title */}
            <h2
              className={`text-[18px] sm:text-[22px] font-extrabold text-foreground mb-1.5 transition-all duration-700 delay-200 ${welcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              أنت تأمر <span className="text-gold relative">
                وأنا أطامر
                <span className="absolute -bottom-0.5 left-0 right-0 h-[2px] bg-gradient-to-l from-transparent via-gold/40 to-transparent" />
              </span>
            </h2>
            <p
              className={`text-[11px] sm:text-[13px] text-muted-foreground text-center max-w-[380px] mb-5 sm:mb-7 transition-all duration-700 delay-300 ${welcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              اكتب طلبك بلغتك الطبيعية — راصد يفهم ويُنفذ مباشرة
            </p>

            {/* Quick actions */}
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-[480px]">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={action.id}
                  onClick={() => doSend(action.label)}
                  className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/20 hover:shadow-lg transition-all duration-300 active:scale-[0.96] text-[10px] sm:text-[11px] font-medium text-foreground btn-hover-lift group ${welcomeVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                  style={{ transitionDelay: `${400 + i * 60}ms` }}
                >
                  <MaterialIcon icon={action.icon} size={15} className="text-primary transition-transform duration-200 group-hover:scale-110" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Keyboard hint */}
            <div className={`mt-6 sm:mt-8 flex items-center gap-2 transition-all duration-700 delay-[800ms] ${welcomeVisible ? 'opacity-60 translate-y-0' : 'opacity-0 translate-y-2'}`}>
              <MaterialIcon icon="keyboard" size={14} className="text-muted-foreground/40" />
              <span className="text-[9px] text-muted-foreground/40">Enter للإرسال — Shift+Enter لسطر جديد</span>
            </div>
          </div>
        )}

        {/* ═══ Chat Messages ═══ */}
        {!isEmpty && (
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                style={{
                  animation: `${msg.role === 'user' ? 'msg-slide-left' : 'msg-slide-right'} 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: 0,
                }}
              >
                {msg.role === 'assistant' && (
                  <div className="shrink-0 mt-1">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                      <img src={character} alt="راصد" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] sm:max-w-[80%]`}>
                  <div
                    className={`px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl text-[12px] sm:text-[13px] leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md shadow-primary/10'
                        : 'bg-accent/60 text-foreground rounded-bl-md border border-border/30'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle rounded-sm" />
                    )}

                    {/* Execution Stages */}
                    {msg.stages && msg.stages.length > 0 && (
                      <div className="mt-3 p-2.5 rounded-xl bg-card/60 border border-border/30">
                        <div className="flex items-center gap-1 mb-2">
                          <MaterialIcon icon="timeline" size={12} className="text-primary" />
                          <span className="text-[9px] font-bold text-muted-foreground">مراحل التنفيذ</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {msg.stages.map((stage, si) => (
                            <div key={si} className="flex items-center gap-2 animate-stagger-in" style={{ animationDelay: `${si * 0.1}s` }}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                stage.status === 'completed' ? 'bg-success/15 text-success' :
                                stage.status === 'running' ? 'bg-primary/15 text-primary' :
                                stage.status === 'failed' ? 'bg-danger/15 text-danger' :
                                'bg-muted/30 text-muted-foreground'
                              }`}>
                                <MaterialIcon icon={
                                  stage.status === 'completed' ? 'check' :
                                  stage.status === 'running' ? 'sync' :
                                  stage.status === 'failed' ? 'close' : 'circle'
                                } size={11} className={stage.status === 'running' ? 'animate-spin' : ''} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-medium">{stage.name}</span>
                                  <span className="text-[8px] text-muted-foreground">{stage.progress}%</span>
                                </div>
                                <div className="w-full h-1 bg-muted/30 rounded-full mt-0.5 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${
                                    stage.status === 'completed' ? 'bg-success' :
                                    stage.status === 'running' ? 'bg-primary' :
                                    stage.status === 'failed' ? 'bg-danger' : 'bg-muted'
                                  }`} style={{ width: `${stage.progress}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Artifacts */}
                    {msg.artifacts && msg.artifacts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.artifacts.map((art, ai) => (
                          <button
                            key={art.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/5 border border-primary/10 text-[9px] font-medium text-primary hover:bg-primary/10 transition-all active:scale-95 animate-stagger-in"
                            style={{ animationDelay: `${ai * 0.08}s` }}
                          >
                            <MaterialIcon icon={art.icon} size={12} />
                            {art.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`text-[8px] sm:text-[9px] mt-1.5 flex items-center gap-1 ${
                      msg.role === 'user' ? 'text-primary-foreground/40 justify-end' : 'text-muted-foreground/60'
                    }`}>
                      {msg.time}
                      {msg.role === 'user' && <MaterialIcon icon="done_all" size={10} />}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 pr-1">
                      {msg.actions.map((action, ai) => {
                        const variantClass = action.variant === 'primary'
                          ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
                          : action.variant === 'success'
                          ? 'bg-success/10 text-success border-success/20 hover:bg-success/15'
                          : action.variant === 'danger'
                          ? 'bg-danger/10 text-danger border-danger/20 hover:bg-danger/15'
                          : 'bg-accent text-foreground border-border hover:bg-accent/80';
                        return (
                          <button
                            key={action.id}
                            onClick={() => handleActionClick(action)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all active:scale-95 animate-stagger-in ${variantClass}`}
                            style={{ animationDelay: `${ai * 0.06}s` }}
                          >
                            <MaterialIcon icon={action.icon} size={12} />
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-2.5" style={{ animation: 'msg-slide-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <div className="shrink-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                    <img src={character} alt="راصد" className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-contain" />
                  </div>
                </div>
                <div className="bg-accent/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2 border border-border/30">
                  <span className="w-2 h-2 bg-primary/40 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-primary/40 rounded-full typing-dot" />
                  <span className="w-2 h-2 bg-primary/40 rounded-full typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="px-1.5 sm:px-2.5 md:px-4 pb-1.5 sm:pb-2.5 md:pb-3 pt-1.5 sm:pt-2 shrink-0 mobile-safe-bottom">
        <div className={`relative flex items-end gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 border-2 transition-all duration-300 ${
          inputFocused
            ? 'border-primary/30 shadow-[0_0_20px_-4px_var(--glow)]'
            : 'border-transparent hover:border-border/40'
        }`}
        style={{
          background: theme === 'dark'
            ? 'rgba(255,255,255,0.92)'
            : 'rgba(0,0,0,0.03)',
        }}
        >
          {/* Glow line on focus */}
          {inputFocused && (
            <div className="absolute top-0 left-[10%] right-[10%] h-[2px] bg-gradient-to-l from-transparent via-primary/40 to-transparent animate-fade-in" />
          )}
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            <button className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-95 group ${theme === 'dark' ? 'hover:bg-gray-200' : 'hover:bg-accent'}`} title="إرفاق ملف">
              <MaterialIcon icon="attach_file" size={19} className={`transition-colors ${theme === 'dark' ? 'text-gray-500 group-hover:text-gray-800' : 'text-muted-foreground group-hover:text-primary'}`} />
            </button>
            <button className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-95 hidden sm:flex group ${theme === 'dark' ? 'hover:bg-gray-200' : 'hover:bg-accent'}`} title="تسجيل صوتي">
              <MaterialIcon icon="mic" size={19} className={`transition-colors ${theme === 'dark' ? 'text-gray-500 group-hover:text-gray-800' : 'text-muted-foreground group-hover:text-primary'}`} />
            </button>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder="اكتب طلبك هنا... راصد يفهم ويُنفذ مباشرة"
            rows={1}
            className={`flex-1 bg-transparent text-[13px] sm:text-[14px] outline-none resize-none min-h-[32px] max-h-[120px] py-1.5 leading-relaxed ${theme === 'dark' ? 'text-gray-800 placeholder:text-gray-400' : 'text-foreground placeholder:text-muted-foreground/50'}`}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300 shrink-0 mb-0.5 ${
              input.trim() && !isTyping
                ? theme === 'dark'
                  ? 'bg-[#0f2744] text-white hover:opacity-90 active:scale-90 shadow-md shadow-[#0f2744]/30'
                  : 'bg-primary text-primary-foreground hover:opacity-90 active:scale-90 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30'
                : theme === 'dark'
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <MaterialIcon icon="arrow_upward" size={19} />
          </button>
        </div>
        <p className="text-[8px] sm:text-[9px] text-muted-foreground/70 text-center mt-1.5">
          منصة <span className="font-extrabold" style={{ color: 'oklch(0.78 0.12 75)', textShadow: '0 0 8px oklch(0.78 0.12 75 / 0.3)' }}>راصد</span> الذكي — مكتب إدارة البيانات الوطنية
        </p>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center z-10 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(100,160,255,0.08) 0%, transparent 70%)' }}>
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/40 flex items-center justify-center" style={{ animation: 'drop-zone-pulse 1.5s ease-in-out infinite' }}>
                <MaterialIcon icon="add_circle" size={28} className="text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-ping-slow" style={{ border: '2px solid rgba(100,160,255,0.2)' }} />
              <div className="absolute -inset-2 rounded-3xl animate-ping-slower" style={{ border: '1px solid rgba(100,160,255,0.1)' }} />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-primary">أفلت هنا لتحليل البيانات</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">سيتم إضافة المصدر تلقائياً</p>
            </div>
          </div>
        </div>
      )}

      {/* Drop snap feedback */}
      {dropSnap && (
        <div className="absolute inset-0 rounded-xl pointer-events-none z-20 drop-snap" style={{ border: '2px solid rgba(100,160,255,0.5)', boxShadow: '0 0 30px rgba(100,160,255,0.15)' }} />
      )}
    </div>
  );
});

export default ChatCanvas;
