/* ═══════════════════════════════════════════════════════════════════
   ChatCanvas — راصد الذكي — AI مفتوح بالكامل
   - كل طلب يُرسل مباشرة للذكاء الاصطناعي
   - الذكاء يفهم الطلب ويختار المحرك المناسب تلقائياً
   - لا wizards، لا خطوات يدوية — AI كامل مفتوح
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, type MutableRefObject } from 'react';
import { trpc } from '@/lib/trpc';
import { useJobWebSocket, type JobUpdateEvent } from '@/hooks/useWebSocket';
import { toast } from 'sonner';
import MaterialIcon from './MaterialIcon';
import { CHARACTERS, QUICK_ACTIONS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';
import { generateHtmlPresentation, THEMES, type SlideData } from '@/lib/slideTemplates';
import { exportToPptx, exportToPdf } from '@/lib/exportUtils';

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

  // Ref to doSend so it can be used in callbacks defined before doSend
  const doSendRef = useRef<(text: string) => void>(() => {});

  // Pending intent — inline wizard above input (like Gamma.app creation wizard)
  const [pendingIntent, setPendingIntent] = useState<{
    type: 'presentation' | 'report' | 'dashboard';
    step: number;
    topic: string;
    style: string; // 'professional' | 'infographic' | 'executive' | 'creative' | 'minimal' | 'data-heavy'
    contentSource: string; // 'ai' | 'user' | 'library'
    slideCount: number;
    brandId: string;
    language: string;
    imageStyle: string; // 'none' | 'ai-generated' | 'icons-only' | 'photos'
    colorScheme: string; // hex primary color or preset name
    fontFamily: string;
    templateId: string;
  } | null>(null);

  // Handle pending intent chip selection (multi-step wizard)
  const handleIntentChip = useCallback((value: string) => {
    if (!pendingIntent) return;
    const pi = { ...pendingIntent };

    if (pi.step === 0) { pi.topic = value; pi.step = 1; }
    else if (pi.step === 1) { pi.style = value; pi.step = 2; }
    else if (pi.step === 2) { pi.contentSource = value; pi.step = 3; }
    else if (pi.step === 3) { pi.slideCount = parseInt(value) || 8; pi.step = 4; }
    else if (pi.step === 4) { pi.brandId = value; pi.imageStyle = 'ai-generated'; pi.step = 5;
      // Auto-skip language step if language already detected from Arabic text
      if (pi.language === 'ar' || pi.language === 'en') { pi.step = 6; }
    }
    else if (pi.step === 5) { pi.language = value; pi.step = 6; }
    else if (pi.step === 6) {
      // EXECUTE — save wizard choices to ref BEFORE clearing pendingIntent
      wizardChoicesRef.current = {
        topic: pi.topic,
        style: pi.style,
        contentSource: pi.contentSource,
        slideCount: pi.slideCount,
        brandId: pi.brandId,
        language: pi.language,
        imageStyle: pi.imageStyle,
      };
      setPendingIntent(null);
      const typeLabel = pi.type === 'presentation' ? 'عرض' : pi.type === 'report' ? 'تقرير' : 'لوحة مؤشرات';
      doSendRef.current(`أنشئ ${typeLabel} عن ${pi.topic}`);
      return;
    }
    setPendingIntent(pi);
  }, [pendingIntent]);

  // Handle typing topic in pending intent mode
  const handleIntentTopicSubmit = useCallback(() => {
    if (!pendingIntent || !input.trim()) return;
    handleIntentChip(input.trim());
    setInput('');
  }, [pendingIntent, input, handleIntentChip]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  // AI mutations via tRPC
  const chatMutation = trpc.ai.chat.useMutation();
  const generateSlidesMutation = trpc.ai.generatePresentation.useMutation();
  const generateTOCMutation = trpc.ai.generateTOC.useMutation();
  const generateSingleSlideMutation = trpc.ai.generateSingleSlide.useMutation();
  const editSlideAIMutation = trpc.ai.editSlideAI.useMutation();
  const generateReportMutation = trpc.ai.generateReport.useMutation();
  const analyzeDashboardMutation = trpc.ai.analyzeDashboard.useMutation();
  const translateMutation = trpc.ai.translate.useMutation();
  const summarizeMutation = trpc.ai.summarize.useMutation();
  const replicateFromImageMutation = trpc.ai.replicateFromImage.useMutation();
  const replicateFromPdfMutation = trpc.ai.replicateFromPdf.useMutation();
  const createPresentation = trpc.presentations.create.useMutation();
  const createReport = trpc.reports.create.useMutation();
  const createDashboard = trpc.dashboards.create.useMutation();
  const createSpreadsheet = trpc.spreadsheets.create.useMutation();

  // File upload state for replication
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slide viewer/editor state
  const [generatedSlides, setGeneratedSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slideHtmls, setSlideHtmls] = useState<string[]>([]);
  const [slideThemeId, setSlideThemeId] = useState('ndmo');
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editField, setEditField] = useState<{ field: string; value: string }>({ field: '', value: '' });
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  // TOC approval state
  const [pendingTOC, setPendingTOC] = useState<{ toc: { index: number; title: string; layout: string; description: string }[]; topic: string } | null>(null);
  // Progressive generation state
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  // Slideshow mode
  const [slideshowMode, setSlideshowMode] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  // Ref to store wizard choices before clearing pendingIntent
  const wizardChoicesRef = useRef<{
    topic: string; style: string; contentSource: string; slideCount: number;
    brandId: string; language: string; imageStyle: string;
  } | null>(null);
  // Ref for auto-scroll to latest slide
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  // AI edit instruction
  const [aiEditInstruction, setAiEditInstruction] = useState('');
  const [aiEditLoading, setAiEditLoading] = useState(false);
  // Code-first animation: each slide shows code first, then renders
  const [slidePhases, setSlidePhases] = useState<Record<number, 'code' | 'rendering' | 'done'>>({});
  const [slideCodeSnippets, setSlideCodeSnippets] = useState<Record<number, string>>({});

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
    // Replication from image / مطابقة بصرية
    if (/طابق|مطابقة|حول.*صورة|replicate.*image|visual.*match|استنسخ|انسخ.*صورة/i.test(t))
      return { intent: 'replicate-image', topic: t };
    // PDF conversion / تحويل PDF
    if (/حول.*pdf|pdf.*عرض|pdf.*تقرير|pdf.*شرائح|convert.*pdf|استخرج.*pdf/i.test(t))
      return { intent: 'replicate-pdf', topic: t };
    // Presentation / عرض
    if (/عرض|شرائح|سلايد|بريزنتيشن|presentation|slides|pptx/i.test(t)) {
      const cleaned = t.replace(/[أا]نش[ئيء]|نفذ|اعمل|سوي|سو|[أا]صنع|صمم|جهز|حضر|[أا]بني|ابغ[اىي]|[أا]بي|[أا]ريد|لي|عرض تقديمي|عرض|شرائح|عن|بعنوان|حول|يتكلم|يتحدث|تقديمي|بموضوع/gi, '').trim();
      return { intent: 'presentation', topic: cleaned };
    }
    // Report / تقرير
    if (/تقرير|تقارير|ريبورت|report/i.test(t)) {
      const cleaned = t.replace(/[أا]نش[ئيء]|نفذ|اعمل|سوي|سو|[أا]صنع|صمم|جهز|حضر|[أا]بني|ابغ[اىي]|[أا]بي|[أا]ريد|لي|تقرير|تقارير|عن|بعنوان|حول|بموضوع/gi, '').trim();
      return { intent: 'report', topic: cleaned };
    }
    // Dashboard / لوحة
    if (/لوحة|داشبورد|مؤشر|مؤشرات|dashboard|kpi|احصائ/i.test(t)) {
      const cleaned = t.replace(/[أا]نش[ئيء]|نفذ|اعمل|سوي|سو|[أا]صنع|صمم|جهز|حضر|[أا]بني|ابغ[اىي]|[أا]بي|[أا]ريد|لي|لوحة مؤشرات|لوحة|مؤشرات|داشبورد|عن|بعنوان|حول|بموضوع/gi, '').trim();
      return { intent: 'dashboard', topic: cleaned };
    }
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

      // ═══ PRESENTATION ENGINE — ALWAYS WIZARD + TOC + PROGRESSIVE ═══
      if (intent === 'presentation') {
        // Auto-detect language from user text
        const hasArabic = /[\u0600-\u06FF]/.test(userText);
        const detectedLang = hasArabic ? 'ar' : 'en';
        // If no wizard choices saved, ALWAYS open wizard (pre-fill topic if detected)
        if (!wizardChoicesRef.current) {
          setIsTyping(false);
          setPendingIntent({
            type: 'presentation',
            step: (topic && topic.length >= 3) ? 1 : 0, // skip topic step if already provided
            topic: topic || '',
            style: 'professional', contentSource: 'ai',
            slideCount: 8, brandId: 'ndmo', language: detectedLang, imageStyle: 'icons-only',
            colorScheme: '', fontFamily: '', templateId: '',
          });
          return;
        }

        // ─── Wizard choices are available — use them ───
        const wc = wizardChoicesRef.current;
        wizardChoicesRef.current = null; // consume
        const finalTopic = wc.topic || topic || userText;
        const apiBrand = (wc.brandId === 'creative' ? 'custom' : wc.brandId) as 'ndmo' | 'sdaia' | 'modern' | 'minimal' | 'custom';

        // ─── STEP 1: Generate TOC ───
        addAssistantMessage(`جاري تحليل الموضوع وإنشاء فهرس المحتويات... ⏳\n\n**${finalTopic}**`, {
          stages: [
            { name: 'تحليل الموضوع', status: 'running', progress: 0 },
            { name: 'إنشاء الفهرس', status: 'pending', progress: 0 },
            { name: 'توليد الشرائح', status: 'pending', progress: 0 },
          ],
        });

        // Animate progress realistically — stage 1 ticks while waiting for API
        const progressInterval = setInterval(() => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (!last?.stages || last.stages[0]?.status !== 'running') { clearInterval(progressInterval); return prev; }
            const updated = [...prev];
            const msg = { ...updated[updated.length - 1] };
            const stages = [...(msg.stages || [])];
            const s0 = { ...stages[0] };
            // Slowly increment: max 85% while waiting for API
            if (s0.progress < 85) s0.progress = Math.min(s0.progress + Math.floor(Math.random() * 8 + 3), 85);
            stages[0] = s0;
            msg.stages = stages;
            updated[updated.length - 1] = msg;
            return updated;
          });
        }, 600);

        const tocResult = await generateTOCMutation.mutateAsync({
          topic: finalTopic,
          slideCount: wc.slideCount,
          style: wc.style,
          language: wc.language,
        });

        clearInterval(progressInterval);

        const toc = tocResult.toc || [];
        if (toc.length === 0) {
          addAssistantMessage('فشل في إنشاء الفهرس. يرجى المحاولة مرة أخرى.');
          return;
        }

        // ─── STEP 2: Show TOC for approval ───
        setIsTyping(false);
        setPendingTOC({ toc, topic: finalTopic });
        setSlideThemeId(apiBrand);

        addAssistantMessage(
          `تم إنشاء فهرس المحتويات — **${toc.length} شريحة**\n\nراجع الفهرس أدناه ثم اضغط **ابدأ التوليد** للمتابعة.`,
          {
            stages: [
              { name: 'تحليل الموضوع', status: 'completed', progress: 100 },
              { name: 'إنشاء الفهرس', status: 'completed', progress: 100 },
              { name: 'توليد الشرائح', status: 'pending', progress: 0 },
            ],
          }
        );
        return;
      }

      // ═══ REPORT ENGINE ═══
      if (intent === 'report') {
        if (!topic || topic.length < 3) {
          setIsTyping(false);
          setPendingIntent({
            type: 'report', step: 0, topic: '', style: 'professional', contentSource: 'ai',
            slideCount: 8, brandId: 'ndmo', language: 'ar', imageStyle: 'none', colorScheme: '', fontFamily: '', templateId: '',
          });
          return;
        }
        addAssistantMessage(`جاري إنشاء تقرير عن **${topic}**... ⏳`, {
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
        try {
          if (sections.length > 0) {
            const saved = await createReport.mutateAsync({
              title: topic || 'تقرير جديد',
              description: topic,
              reportType: 'general',
              sections: sections,
            });
            savedId = saved?.id ? String(saved.id) : '';
          }
        } catch { /* save failed — show results anyway */ }

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
        if (!topic || topic.length < 3) {
          setIsTyping(false);
          setPendingIntent({
            type: 'dashboard', step: 0, topic: '', style: 'data-heavy', contentSource: 'ai',
            slideCount: 8, brandId: 'ndmo', language: 'ar', imageStyle: 'none', colorScheme: '', fontFamily: '', templateId: '',
          });
          return;
        }
        addAssistantMessage(`جاري إنشاء لوحة مؤشرات عن **${topic}**... ⏳`, {
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
        try {
          if (widgets.length > 0) {
            const saved = await createDashboard.mutateAsync({
              title: topic || 'لوحة مؤشرات جديدة',
              description: topic,
              widgets: widgets,
              layout: {},
            });
            savedId = saved?.id ? String(saved.id) : '';
          }
        } catch { /* save failed — show results anyway */ }

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
          from: 'auto',
          to: /\b(إنجليزي|english|en)\b/i.test(userText) ? 'en' : 'ar',
        });
        addAssistantMessage(`**الترجمة:**\n\n${translateResult.content || 'تمت الترجمة'}`, {
          actions: [{ id: 'translate-again', label: 'ترجمة أخرى', icon: 'translate', variant: 'secondary' }],
        });
        return;
      }

      // ═══ SUMMARIZE ═══
      if (intent === 'summarize') {
        const summaryResult = await summarizeMutation.mutateAsync({ text: topic });
        addAssistantMessage(`**الملخص:**\n\n${summaryResult.content || 'تم التلخيص'}`, {
          actions: [{ id: 'summarize-again', label: 'تلخيص آخر', icon: 'summarize', variant: 'secondary' }],
        });
        return;
      }

      // ═══ REPLICATE FROM IMAGE ═══
      if (intent === 'replicate-image') {
        if (!uploadedFile) {
          addAssistantMessage('📎 ارفع صورة أولاً ثم اطلب المطابقة.\n\nاضغط على زر 📎 أسفل المحادثة لرفع صورة (لوحة مؤشرات، عرض، تقرير، أو جدول).', {
            actions: [
              { id: 'upload-file', label: '📎 رفع صورة', icon: 'upload_file', variant: 'primary' },
            ],
          });
          return;
        }
        const targetGuess = /لوحة|داشبورد|dashboard/i.test(topic) ? 'dashboard' as const
          : /تقرير|report/i.test(topic) ? 'report' as const
          : /جدول|excel|spreadsheet/i.test(topic) ? 'spreadsheet' as const
          : 'presentation' as const;

        addAssistantMessage(`جاري تحليل الصورة ومطابقتها كـ **${targetGuess === 'dashboard' ? 'لوحة مؤشرات' : targetGuess === 'report' ? 'تقرير' : targetGuess === 'spreadsheet' ? 'جدول' : 'عرض تقديمي'}**... ⏳`, {
          stages: [
            { name: 'تحليل الصورة بالذكاء', status: 'running', progress: 30 },
            { name: 'استخراج العناصر', status: 'pending', progress: 0 },
            { name: 'بناء المخرج', status: 'pending', progress: 0 },
          ],
        });

        const repResult = await replicateFromImageMutation.mutateAsync({
          imageUrl: uploadedFile.url,
          targetType: targetGuess,
          language: 'ar',
          strictMode: true,
        });

        if (!repResult.success) {
          addAssistantMessage(`❌ ${repResult.error || 'فشل في تحليل الصورة'}`, {
            actions: [{ id: 'upload-file', label: 'حاول مرة أخرى', icon: 'refresh', variant: 'primary' }],
          });
          return;
        }

        // Save the artifact (optional — may fail if engine not running)
        try {
          if (targetGuess === 'presentation' && repResult.cdr?.slides) {
            await createPresentation.mutateAsync({ title: repResult.cdr.title || 'عرض مُطابَق', slides: repResult.cdr.slides, theme: 'ndmo' });
          } else if (targetGuess === 'report' && repResult.cdr?.sections) {
            await createReport.mutateAsync({ title: repResult.cdr.title || 'تقرير مُطابَق', sections: repResult.cdr.sections });
          } else if (targetGuess === 'dashboard' && repResult.cdr?.widgets) {
            await createDashboard.mutateAsync({ title: repResult.cdr.title || 'لوحة مُطابَقة', widgets: repResult.cdr.widgets, layout: {} });
          } else if (targetGuess === 'spreadsheet' && repResult.cdr?.sheets) {
            await createSpreadsheet.mutateAsync({ title: repResult.cdr.title || 'جدول مُطابَق', sheets: repResult.cdr.sheets });
          }
        } catch { /* save failed — show results anyway */ }

        addAssistantMessage(
          `✅ تمت المطابقة البصرية بنجاح!\n\n**${repResult.cdr?.title || 'المخرج'}**\n\nتم استخراج **${repResult.elementCount || 0} عنصر** وحفظها.`,
          {
            stages: [
              { name: 'تحليل الصورة بالذكاء', status: 'completed', progress: 100 },
              { name: 'استخراج العناصر', status: 'completed', progress: 100 },
              { name: 'بناء المخرج', status: 'completed', progress: 100 },
            ],
            artifacts: [{ id: 'rep-1', type: targetGuess as any, label: repResult.cdr?.title || 'مخرج مُطابَق', icon: targetGuess === 'dashboard' ? 'dashboard' : targetGuess === 'report' ? 'description' : targetGuess === 'spreadsheet' ? 'table_chart' : 'slideshow' }],
            actions: [
              { id: 'replicate-another', label: 'مطابقة أخرى', icon: 'compare', variant: 'secondary' },
            ],
          }
        );
        setUploadedFile(null);
        return;
      }

      // ═══ REPLICATE FROM PDF ═══
      if (intent === 'replicate-pdf') {
        if (!uploadedFile || !uploadedFile.name.toLowerCase().endsWith('.pdf')) {
          addAssistantMessage('📎 ارفع ملف PDF أولاً ثم اطلب التحويل.\n\nاضغط على زر 📎 أسفل المحادثة لرفع ملف PDF.', {
            actions: [{ id: 'upload-file', label: '📎 رفع PDF', icon: 'upload_file', variant: 'primary' }],
          });
          return;
        }
        const pdfTarget = /عرض|شرائح|presentation/i.test(topic) ? 'presentation' as const
          : /تقرير|report/i.test(topic) ? 'report' as const
          : 'presentation' as const;

        addAssistantMessage(`جاري تحويل PDF إلى **${pdfTarget === 'presentation' ? 'عرض تقديمي' : 'تقرير'}**... ⏳\n\nقد يستغرق هذا دقائق حسب عدد الصفحات.`, {
          stages: [
            { name: 'تحليل هيكل المستند', status: 'running', progress: 20 },
            { name: 'معالجة الصفحات', status: 'pending', progress: 0 },
            { name: 'بناء المخرج', status: 'pending', progress: 0 },
          ],
        });

        const pdfResult = await replicateFromPdfMutation.mutateAsync({
          filePath: uploadedFile.url,
          targetType: pdfTarget,
          language: 'ar',
          batchSize: 5,
        });

        if (!pdfResult.success) {
          addAssistantMessage(`❌ ${(pdfResult as any).error || 'فشل في تحويل PDF'}`, {
            actions: [{ id: 'upload-file', label: 'حاول مرة أخرى', icon: 'refresh', variant: 'primary' }],
          });
          return;
        }

        // Save (optional)
        try {
          if (pdfTarget === 'presentation') {
            await createPresentation.mutateAsync({ title: pdfResult.title || 'عرض من PDF', slides: pdfResult.artifact?.slides || [], theme: 'ndmo' });
          } else {
            await createReport.mutateAsync({ title: pdfResult.title || 'تقرير من PDF', sections: pdfResult.artifact?.sections || [] });
          }
        } catch { /* save failed — show results anyway */ }

        addAssistantMessage(
          `✅ تم تحويل PDF بنجاح!\n\n**${pdfResult.title}**\n\n📄 ${pdfResult.totalSourcePages} صفحة أصلية → 📊 ${pdfResult.processedPages} ${pdfTarget === 'presentation' ? 'شريحة' : 'قسم'}`,
          {
            stages: [
              { name: 'تحليل هيكل المستند', status: 'completed', progress: 100 },
              { name: 'معالجة الصفحات', status: 'completed', progress: 100 },
              { name: 'بناء المخرج', status: 'completed', progress: 100 },
            ],
            artifacts: [{ id: 'pdf-rep-1', type: pdfTarget as any, label: pdfResult.title || 'مخرج PDF', icon: pdfTarget === 'presentation' ? 'slideshow' : 'description' }],
            actions: [
              { id: 'replicate-another', label: 'تحويل PDF آخر', icon: 'picture_as_pdf', variant: 'secondary' },
            ],
          }
        );
        setUploadedFile(null);
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
          { id: 'upload-file', label: '📎 مطابقة بصرية', icon: 'compare', variant: 'secondary' },
        ],
      });
    } catch (error: any) {
      setIsTyping(false);
      const rawMsg = error?.message || error?.data?.message || '';
      const errorMsg = rawMsg.includes('OPENAI_API_KEY is not configured')
        ? 'عذراً، لم يتم تكوين مفتاح الذكاء الاصطناعي. يرجى إضافة OPENAI_API_KEY في إعدادات Railway.'
        : rawMsg.includes('fetch failed') || rawMsg.includes('ECONNREFUSED')
        ? 'عذراً، لا يمكن الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.'
        : `عذراً، حدث خطأ أثناء التنفيذ. يرجى المحاولة مرة أخرى.\n\n(${rawMsg || 'خطأ غير معروف'})`;
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg,
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
  }, [messages, chatMutation, generateSlidesMutation, generateReportMutation, analyzeDashboardMutation, translateMutation, summarizeMutation, createPresentation, createReport, createDashboard, addAssistantMessage]);

  // Keep ref in sync so pre-declared callbacks can call doSend
  doSendRef.current = doSend;

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    doSend(text);
  }, [input, doSend]);

  // Handle file upload for replication
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Convert to base64 data URI — works on Railway without local file storage
      const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      const fileUrl = await toBase64(file);
      setUploadedFile({ url: fileUrl, name: file.name, type: file.type });
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      addAssistantMessage(
        `✅ تم رفع الملف: **${file.name}**\n\nالآن اكتب ماذا تريد:\n${isPdf
          ? '• "حول PDF إلى عرض تقديمي"\n• "حول PDF إلى تقرير"'
          : '• "طابق الصورة كلوحة مؤشرات"\n• "طابق الصورة كعرض تقديمي"\n• "طابق الصورة كتقرير"\n• "طابق الصورة كجدول"'}`,
        {
          actions: isPdf
            ? [
                { id: 'pdf-to-pres', label: 'حول إلى عرض تقديمي', icon: 'slideshow', variant: 'primary' },
                { id: 'pdf-to-report', label: 'حول إلى تقرير', icon: 'description', variant: 'secondary' },
              ]
            : [
                { id: 'match-dashboard', label: 'طابق كلوحة مؤشرات', icon: 'dashboard', variant: 'primary' },
                { id: 'match-presentation', label: 'طابق كعرض', icon: 'slideshow', variant: 'secondary' },
                { id: 'match-report', label: 'طابق كتقرير', icon: 'description', variant: 'secondary' },
                { id: 'match-spreadsheet', label: 'طابق كجدول', icon: 'table_chart', variant: 'secondary' },
              ],
        }
      );
    } catch {
      addAssistantMessage('❌ فشل رفع الملف. يرجى المحاولة مرة أخرى.');
    }
    if (e.target) e.target.value = '';
  }, [addAssistantMessage]);

  // Handle action button clicks — route to correct engine
  const handleActionClick = useCallback((action: { id: string; label: string }) => {
    if (action.id === 'upload-file') {
      fileInputRef.current?.click();
    } else if (action.id === 'open-presentation' || action.id === 'presentation') {
      doSend('أنشئ عرض تقديمي');
    } else if (action.id === 'open-report' || action.id === 'report') {
      doSend('أنشئ تقرير');
    } else if (action.id === 'open-dashboard' || action.id === 'dashboard' || action.id === 'analyze') {
      doSend('أنشئ لوحة مؤشرات');
    } else if (action.id === 'new-presentation' || action.id === 'replicate-another') {
      fileInputRef.current?.click();
    } else if (action.id === 'new-report') {
      doSend('أنشئ تقرير آخر');
    } else if (action.id === 'new-dashboard') {
      doSend('أنشئ لوحة مؤشرات أخرى');
    } else if (action.id === 'pdf-to-pres') {
      doSend('حول PDF إلى عرض تقديمي');
    } else if (action.id === 'pdf-to-report') {
      doSend('حول PDF إلى تقرير');
    } else if (action.id === 'match-dashboard') {
      doSend('طابق الصورة كلوحة مؤشرات');
    } else if (action.id === 'match-presentation') {
      doSend('طابق الصورة كعرض تقديمي');
    } else if (action.id === 'match-report') {
      doSend('طابق الصورة كتقرير');
    } else if (action.id === 'match-spreadsheet') {
      doSend('طابق الصورة كجدول');
    } else if (action.id === 'export-pptx') {
      if (generatedSlides.length > 0) {
        toast.promise(
          exportToPptx(generatedSlides, slideThemeId, generatedSlides[0]?.title || 'عرض راصد'),
          { loading: 'جاري تصدير PPTX...', success: 'تم تصدير العرض بنجاح!', error: 'فشل في التصدير' }
        );
      } else {
        toast.error('لا يوجد عرض لتصديره');
      }
    } else if (action.id === 'export-pdf') {
      if (slideHtmls.length > 0) {
        toast.promise(
          exportToPdf(slideHtmls, generatedSlides[0]?.title || 'عرض راصد'),
          { loading: 'جاري تصدير PDF...', success: 'تم تصدير PDF بنجاح!', error: 'فشل في التصدير' }
        );
      } else {
        toast.error('لا يوجد عرض لتصديره');
      }
    } else if (action.id === 'save-library') {
      if (generatedSlides.length > 0) {
        toast.promise(
          createPresentation.mutateAsync({
            title: generatedSlides[0]?.title || 'عرض تقديمي',
            slides: generatedSlides,
            theme: slideThemeId,
          }),
          { loading: 'جاري الحفظ...', success: 'تم حفظ العرض في المكتبة!', error: 'فشل في الحفظ' }
        );
      }
    } else if (action.id === 'save-template') {
      toast.info('سيتم حفظ العرض كقالب قريباً');
    } else if (action.id === 'play-slideshow') {
      if (slideHtmls.length > 0) {
        setSlideshowIndex(0);
        setSlideshowMode(true);
      }
    } else {
      doSend(action.label);
    }
  }, [doSend, generatedSlides, slideHtmls, slideThemeId, createPresentation]);

  // ═══ APPROVE TOC & START PROGRESSIVE GENERATION ═══
  const approveTOC = useCallback(async () => {
    if (!pendingTOC) return;
    const { toc, topic } = pendingTOC;
    setPendingTOC(null);
    setIsGeneratingSlides(true);
    setGenerationProgress({ current: 0, total: toc.length });
    setGeneratedSlides([]);
    setSlideHtmls([]);
    setShowSlideViewer(true);

    addAssistantMessage(`جاري توليد **${toc.length} شريحة** — شريحة شريحة... ⏳`, {
      stages: [
        { name: 'توليد الشرائح', status: 'running', progress: 0 },
      ],
    });

    const allSlides: SlideData[] = [];
    const allHtmls: string[] = [];
    const themeId = slideThemeId || 'ndmo';

    for (let i = 0; i < toc.length; i++) {
      try {
        const result = await generateSingleSlideMutation.mutateAsync({
          topic,
          slideIndex: i,
          slideTitle: toc[i].title,
          slideLayout: toc[i].layout,
          slideDescription: toc[i].description,
          totalSlides: toc.length,
          style: wizardChoicesRef.current?.style || 'professional',
          language: wizardChoicesRef.current?.language || 'ar',
          previousSlides: allSlides.map(s => ({ title: s.title || '', layout: s.layout || '' })),
        });

        const slideData = { ...result.slide, layout: toc[i].layout } as SlideData;
        allSlides.push(slideData);
        const html = generateHtmlPresentation([slideData], themeId)[0];
        allHtmls.push(html);

        // Update state progressively — each slide appears immediately
        setGeneratedSlides([...allSlides]);
        setSlideHtmls([...allHtmls]);
        setGenerationProgress({ current: i + 1, total: toc.length });
        setCurrentSlideIndex(i);

        // Update progress bar in message — show current slide name with real percentage
        const realProgress = Math.round(((i + 1) / toc.length) * 100);
        const currentSlideName = toc[i].title || `شريحة ${i + 1}`;
        const nextSlideName = (i + 1 < toc.length) ? toc[i + 1].title : null;
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx]?.stages) {
            const msg = { ...updated[lastIdx] };
            const stages: Array<{ name: string; status: 'pending' | 'running' | 'completed' | 'failed'; progress: number }> = [];
            // Show completed slides
            for (let j = 0; j <= i; j++) {
              stages.push({ name: `${j + 1}. ${toc[j].title}`, status: 'completed', progress: 100 });
            }
            // Show next slide as running
            if (nextSlideName) {
              stages.push({ name: `${i + 2}. ${nextSlideName}`, status: 'running', progress: 0 });
            }
            // Show remaining as pending
            for (let j = i + 2; j < toc.length; j++) {
              stages.push({ name: `${j + 1}. ${toc[j].title}`, status: 'pending', progress: 0 });
            }
            msg.stages = stages;
            updated[lastIdx] = msg;
          }
          return updated;
        });

        // Auto-scroll to latest slide
        setTimeout(() => {
          const el = document.getElementById(`chatcanvas-slide-${i}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
      } catch (err) {
        console.error(`Failed to generate slide ${i + 1}:`, err);
        // Add placeholder slide on error
        const placeholder = { title: toc[i].title, layout: toc[i].layout, content: 'فشل في توليد هذه الشريحة' } as SlideData;
        allSlides.push(placeholder);
        const html = generateHtmlPresentation([placeholder], themeId)[0];
        allHtmls.push(html);
        setGeneratedSlides([...allSlides]);
        setSlideHtmls([...allHtmls]);
      }
    }

    setIsGeneratingSlides(false);

    // Save to library
    try {
      await createPresentation.mutateAsync({
        title: allSlides[0]?.title || topic || 'عرض تقديمي',
        description: topic,
        slides: allSlides,
        theme: themeId,
      });
    } catch { /* save failed */ }

    addAssistantMessage(
      `تم توليد العرض بنجاح! — **${allSlides.length} شريحة** بجودة Ultra Premium Infographic 400%`,
      {
        stages: allSlides.map((s, idx) => ({ name: `${idx + 1}. ${s.title || 'شريحة'}`, status: 'completed' as const, progress: 100 })),
        actions: [
          { id: 'export-pptx', label: 'تصدير PPTX', icon: 'download', variant: 'primary' },
          { id: 'export-pdf', label: 'تصدير PDF', icon: 'picture_as_pdf', variant: 'secondary' },
          { id: 'play-slideshow', label: 'تشغيل العرض', icon: 'play_arrow', variant: 'success' },
          { id: 'save-library', label: 'حفظ في المكتبة', icon: 'bookmark', variant: 'secondary' },
          { id: 'new-presentation', label: 'عرض آخر', icon: 'add', variant: 'secondary' },
        ],
      }
    );
  }, [pendingTOC, slideThemeId, generateSingleSlideMutation, createPresentation, addAssistantMessage]);

  // ═══ AI EDIT SLIDE ═══
  const handleAIEdit = useCallback(async (slideIndex: number, instruction: string) => {
    if (!instruction.trim() || aiEditLoading) return;
    setAiEditLoading(true);
    try {
      const result = await editSlideAIMutation.mutateAsync({
        currentSlide: generatedSlides[slideIndex] as any,
        instruction,
        slideIndex,
      });
      const updated = [...generatedSlides];
      updated[slideIndex] = { ...result.slide, layout: generatedSlides[slideIndex]?.layout } as SlideData;
      setGeneratedSlides(updated);
      setSlideHtmls(generateHtmlPresentation(updated, slideThemeId));
      setAiEditInstruction('');
      setEditingSlide(null);
      toast.success('تم تعديل الشريحة بنجاح!');
    } catch {
      toast.error('فشل في تعديل الشريحة');
    }
    setAiEditLoading(false);
  }, [generatedSlides, slideThemeId, editSlideAIMutation, aiEditLoading]);

  // Handle new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setChatMenuOpen(false);
    setPendingTOC(null);
    setShowSlideViewer(false);
    setGeneratedSlides([]);
    setSlideHtmls([]);
    setSlideshowMode(false);
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

      {/* ═══ TOC APPROVAL PANEL ═══ */}
      {pendingTOC && (
        <div className="px-2 md:px-4 pb-2 animate-slide-up">
          <div className="rounded-2xl border border-primary/20 bg-card overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="list_alt" size={16} className="text-primary" />
                <span className="text-[12px] font-bold text-foreground">فهرس المحتويات — {pendingTOC.toc.length} شريحة</span>
              </div>
              <button onClick={() => setPendingTOC(null)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center">
                <MaterialIcon icon="close" size={14} className="text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[40vh] overflow-y-auto p-3">
              <div className="flex flex-col gap-1.5">
                {pendingTOC.toc.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border/20 hover:border-primary/20 transition-all">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{item.index || i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">{item.title}</span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{item.layout}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/10">
              <span className="text-[10px] text-muted-foreground">راجع الفهرس ثم اضغط ابدأ التوليد</span>
              <div className="flex gap-1.5">
                <button onClick={() => setPendingTOC(null)} className="px-3 py-1.5 rounded-lg border border-border text-[10px] font-medium text-muted-foreground hover:bg-accent transition-all">
                  إلغاء
                </button>
                <button onClick={approveTOC} className="px-4 py-1.5 rounded-lg bg-primary text-white text-[10px] font-bold hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-1">
                  <MaterialIcon icon="play_arrow" size={14} />
                  ابدأ التوليد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Slide Viewer — COMPACT VERTICAL + PROGRESSIVE + AI EDIT + SLIDESHOW ═══ */}
      {showSlideViewer && (slideHtmls.length > 0 || isGeneratingSlides) && (
        <div className="px-2 md:px-4 pb-2">
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-lg">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="slideshow" size={16} className="text-primary" />
                <span className="text-[12px] font-bold text-foreground">
                  {isGeneratingSlides
                    ? `جاري التوليد... ${generationProgress.current}/${generationProgress.total}`
                    : `عرض تقديمي — ${generatedSlides.length} شريحة`
                  }
                </span>
                {isGeneratingSlides && (
                  <div className="w-20 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {/* Theme switcher */}
                <select
                  value={slideThemeId}
                  onChange={(e) => {
                    setSlideThemeId(e.target.value);
                    setSlideHtmls(generateHtmlPresentation(generatedSlides, e.target.value));
                  }}
                  className="text-[10px] bg-card border border-border rounded-lg px-2 py-1 outline-none"
                >
                  {Object.entries(THEMES).map(([id, t]) => (
                    <option key={id} value={id}>{t.name}</option>
                  ))}
                </select>
                {!isGeneratingSlides && slideHtmls.length > 0 && (
                  <button onClick={() => { setSlideshowIndex(0); setSlideshowMode(true); }} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center" title="تشغيل العرض">
                    <MaterialIcon icon="play_arrow" size={16} className="text-primary" />
                  </button>
                )}
                <button onClick={() => setShowSlideViewer(false)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center">
                  <MaterialIcon icon="close" size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* ─── ALL SLIDES VERTICALLY — COMPACT GRID ─── */}
            <div ref={slidesContainerRef} className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 md:p-3 max-h-[65vh] overflow-y-auto">
              {slideHtmls.map((html, i) => (
                <div
                  key={`vslide-${i}`}
                  id={`chatcanvas-slide-${i}`}
                  className={`rounded-xl border transition-all ${
                    currentSlideIndex === i
                      ? 'border-primary/40 shadow-md shadow-primary/5'
                      : 'border-border/30 hover:border-primary/20'
                  }`}
                  style={{ animation: `msg-slide-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.05}s both` }}
                >
                  {/* Slide header */}
                  <div className="flex items-center justify-between px-2.5 py-1 bg-muted/20 border-b border-border/20 rounded-t-xl">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{i + 1}</span>
                      <span className="text-[10px] font-medium text-foreground truncate max-w-[180px]">{generatedSlides[i]?.title || `شريحة ${i + 1}`}</span>
                      <span className="text-[8px] text-muted-foreground px-1 py-0.5 bg-accent/50 rounded">{generatedSlides[i]?.layout}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => {
                        setCurrentSlideIndex(i);
                        setEditingSlide(editingSlide === i ? null : i);
                        setAiEditInstruction('');
                        setEditField({ field: 'title', value: generatedSlides[i]?.title || '' });
                      }} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-border hover:border-primary/30 hover:bg-primary/[0.03] text-[8px] font-medium transition-all active:scale-95">
                        <MaterialIcon icon="edit" size={10} className="text-primary" />
                        تعديل
                      </button>
                    </div>
                  </div>

                  {/* Slide iframe — THUMBNAIL with click to open slideshow */}
                  <div
                    className="bg-neutral-900 flex items-center justify-center p-1 cursor-pointer group/slide relative"
                    onClick={() => { setSlideshowIndex(i); setSlideshowMode(true); }}
                  >
                    <div className="w-full relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        srcDoc={html}
                        className="border-0 shadow-md rounded-sm pointer-events-none absolute top-0 left-0"
                        style={{ width: '1280px', height: '720px', transform: 'scale(0.22)', transformOrigin: 'top left', background: '#fff' }}
                        title={`شريحة ${i + 1}`}
                      />
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover/slide:bg-black/20 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover/slide:opacity-100 transition-all w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg">
                        <MaterialIcon icon="play_arrow" size={20} className="text-primary" />
                      </div>
                    </div>
                  </div>

                  {/* Edit panel — MANUAL + AI EDIT */}
                  {editingSlide === i && (
                    <div className="border-t border-border/30 p-2.5 bg-card rounded-b-xl animate-fade-in">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-foreground">تعديل الشريحة {i + 1}</span>
                          <button onClick={() => setEditingSlide(null)} className="text-[9px] text-muted-foreground hover:text-foreground">إغلاق</button>
                        </div>

                        {/* Manual field edit */}
                        <div className="flex gap-1">
                          {['title', 'subtitle', 'content'].map(f => (
                            <button key={f} onClick={() => {
                              const slide = generatedSlides[i];
                              setEditField({ field: f, value: (slide as any)?.[f] || '' });
                            }} className={`px-2 py-0.5 rounded text-[9px] font-medium border transition-all ${editField.field === f ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground'}`}>
                              {f === 'title' ? 'العنوان' : f === 'subtitle' ? 'الفرعي' : 'المحتوى'}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={editField.value}
                          onChange={e => setEditField(prev => ({ ...prev, value: e.target.value }))}
                          rows={2}
                          className="w-full text-[11px] bg-muted/30 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary/40 resize-none"
                          placeholder="عدل الحقل يدوياً..."
                        />
                        <button onClick={() => {
                          const updated = [...generatedSlides];
                          if (editField.field === 'title') updated[i] = { ...updated[i], title: editField.value };
                          else if (editField.field === 'content') updated[i] = { ...updated[i], content: editField.value };
                          else if (editField.field === 'subtitle') updated[i] = { ...updated[i], subtitle: editField.value };
                          setGeneratedSlides(updated);
                          setSlideHtmls(generateHtmlPresentation(updated, slideThemeId));
                          toast.success('تم حفظ التعديل');
                        }} className="self-end px-3 py-1 rounded-lg bg-primary text-white text-[9px] font-bold hover:bg-primary/90 transition-all active:scale-95">
                          حفظ التعديل
                        </button>

                        {/* AI Edit */}
                        <div className="border-t border-border/20 pt-2 mt-1">
                          <div className="flex items-center gap-1 mb-1">
                            <MaterialIcon icon="auto_awesome" size={11} className="text-primary" />
                            <span className="text-[9px] font-bold text-primary">تعديل بالذكاء الاصطناعي</span>
                          </div>
                          <div className="flex gap-1">
                            <input
                              value={aiEditInstruction}
                              onChange={e => setAiEditInstruction(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleAIEdit(i, aiEditInstruction); }}
                              placeholder="مثل: أضف إحصائيات أكثر / غير العنوان / اجعلها إنفوجرافيك"
                              className="flex-1 text-[10px] bg-muted/30 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary/40"
                            />
                            <button
                              onClick={() => handleAIEdit(i, aiEditInstruction)}
                              disabled={aiEditLoading || !aiEditInstruction.trim()}
                              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 text-white text-[9px] font-bold hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                            >
                              {aiEditLoading ? <MaterialIcon icon="sync" size={11} className="animate-spin" /> : <MaterialIcon icon="auto_awesome" size={11} />}
                              عدل
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator for next slide */}
              {isGeneratingSlides && (
                <div className="flex items-center justify-center gap-2 py-4 animate-pulse">
                  <MaterialIcon icon="sync" size={16} className="text-primary animate-spin" />
                  <span className="text-[11px] text-muted-foreground">جاري توليد الشريحة {generationProgress.current + 1}...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SLIDESHOW MODE (FULLSCREEN) ═══ */}
      {slideshowMode && slideHtmls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
              e.preventDefault();
              setSlideshowIndex(prev => Math.min(prev + 1, slideHtmls.length - 1));
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              setSlideshowIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Escape') {
              setSlideshowMode(false);
            }
          }}
          ref={(el) => el?.focus()}
        >
          {/* Slideshow toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white">
            <span className="text-[12px] font-bold">{generatedSlides[slideshowIndex]?.title || `شريحة ${slideshowIndex + 1}`}</span>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400">{slideshowIndex + 1} / {slideHtmls.length}</span>
              <button onClick={() => setSlideshowMode(false)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <MaterialIcon icon="close" size={18} className="text-white" />
              </button>
            </div>
          </div>
          {/* Slide — proper 16:9 aspect ratio */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4">
            <div className="relative w-full" style={{ maxWidth: '90vw', maxHeight: '80vh', aspectRatio: '16/9' }}>
              <iframe
                srcDoc={slideHtmls[slideshowIndex]}
                className="border-0 rounded-lg shadow-2xl absolute inset-0 w-full h-full"
                style={{ background: '#fff' }}
                title={`عرض ${slideshowIndex + 1}`}
              />
            </div>
          </div>
          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 py-3 bg-black/80">
            <button onClick={() => setSlideshowIndex(prev => Math.max(prev - 1, 0))} disabled={slideshowIndex === 0} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30">
              <MaterialIcon icon="chevron_right" size={22} className="text-white" />
            </button>
            <div className="flex gap-1">
              {slideHtmls.map((_, i) => (
                <button key={i} onClick={() => setSlideshowIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === slideshowIndex ? 'bg-primary w-4' : 'bg-white/30 hover:bg-white/50'}`} />
              ))}
            </div>
            <button onClick={() => setSlideshowIndex(prev => Math.min(prev + 1, slideHtmls.length - 1))} disabled={slideshowIndex === slideHtmls.length - 1} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center disabled:opacity-30">
              <MaterialIcon icon="chevron_left" size={22} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ═══ Professional Creation Wizard ═══ */}
      {pendingIntent && (
        <div className="px-2.5 md:px-4 pb-1 animate-slide-up">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/[0.02] to-transparent p-3 sm:p-4 flex flex-col gap-3 shadow-sm">
            {/* Header with steps + close */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MaterialIcon icon={pendingIntent.type === 'presentation' ? 'slideshow' : pendingIntent.type === 'report' ? 'description' : 'dashboard'} size={16} className="text-primary" />
                </div>
                <div>
                  <span className="text-[12px] font-bold text-foreground">
                    {pendingIntent.type === 'presentation' ? 'عرض تقديمي جديد' : pendingIntent.type === 'report' ? 'تقرير جديد' : 'لوحة مؤشرات جديدة'}
                  </span>
                  <div className="flex gap-0.5 mt-0.5">
                    {[0,1,2,3,4,5,6].map(s => (
                      <div key={s} className={`h-[3px] rounded-full transition-all duration-300 ${s < pendingIntent.step ? 'w-4 bg-primary' : s === pendingIntent.step ? 'w-6 bg-primary animate-pulse' : 'w-2 bg-border'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setPendingIntent(null)} className="w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center transition-colors">
                <MaterialIcon icon="close" size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Step 0: Topic */}
            {pendingIntent.step === 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">ما الموضوع؟</span>
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleIntentTopicSubmit(); }}
                    placeholder="اكتب موضوع العرض..."
                    className="flex-1 text-[13px] bg-card border border-border/60 rounded-xl px-3.5 py-2.5 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all"
                  />
                  <button onClick={handleIntentTopicSubmit} disabled={!input.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary text-white text-[12px] font-bold disabled:opacity-30 hover:bg-primary/90 transition-all active:scale-95 shadow-sm">
                    التالي <MaterialIcon icon="arrow_back" size={14} className="inline-block mr-1" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Style */}
            {pendingIntent.step === 1 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">نمط العرض</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'professional', label: 'احترافي', desc: 'رسمي ومتزن', icon: 'business_center' },
                    { id: 'infographic', label: 'إنفوجرافيك', desc: 'بصري وغني', icon: 'palette' },
                    { id: 'executive', label: 'قيادي', desc: 'للقيادات العليا', icon: 'military_tech' },
                    { id: 'creative', label: 'إبداعي', desc: 'جريء ومبتكر', icon: 'auto_awesome' },
                    { id: 'minimal', label: 'بسيط', desc: 'نظيف ومركّز', icon: 'crop_square' },
                    { id: 'data-heavy', label: 'تحليلي', desc: 'كثيف بالبيانات', icon: 'analytics' },
                  ].map(s => (
                    <button key={s.id} onClick={() => handleIntentChip(s.id)}
                      className="flex items-start gap-2 p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.03] transition-all active:scale-[0.97] text-right">
                      <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                        <MaterialIcon icon={s.icon} size={16} className="text-primary" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-foreground">{s.label}</div>
                        <div className="text-[9px] text-muted-foreground">{s.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Content Source */}
            {pendingIntent.step === 2 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">مصدر المحتوى</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'ai', label: 'الذكاء الاصطناعي', desc: 'يولّد المحتوى تلقائيًا', icon: 'smart_toy' },
                    { id: 'user', label: 'محتوى خاص', desc: 'ألصق أو اكتب محتواك', icon: 'edit_note' },
                    { id: 'library', label: 'من المكتبة', desc: 'اختر من القوالب الجاهزة', icon: 'folder_open' },
                  ].map(s => (
                    <button key={s.id} onClick={() => handleIntentChip(s.id)}
                      className="flex items-center gap-2.5 p-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.03] transition-all active:scale-[0.97]">
                      <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                        <MaterialIcon icon={s.icon} size={18} className="text-primary" />
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-bold text-foreground">{s.label}</div>
                        <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Count */}
            {pendingIntent.step === 3 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">{pendingIntent.type === 'presentation' ? 'عدد الشرائح' : 'عدد الأقسام'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { n: '5', label: '5 — مختصر' },
                    { n: '8', label: '8 — متوسط' },
                    { n: '10', label: '10 — شامل' },
                    { n: '12', label: '12 — مفصّل' },
                    { n: '15', label: '15 — موسّع' },
                    { n: '20', label: '20 — كامل' },
                  ].map(c => (
                    <button key={c.n} onClick={() => handleIntentChip(c.n)}
                      className="px-3.5 py-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.03] text-[11px] font-bold transition-all active:scale-95">
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Brand */}
            {pendingIntent.step === 4 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">الهوية البصرية</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'ndmo', label: 'NDMO', desc: 'مكتب إدارة البيانات', colors: ['#0f2744','#d4af37','#1a73e8'] },
                    { id: 'sdaia', label: 'سدايا', desc: 'هيئة البيانات والذكاء', colors: ['#1a73e8','#374151','#0CAB8F'] },
                    { id: 'modern', label: 'عصري', desc: 'تصميم حديث وأنيق', colors: ['#6366f1','#8b5cf6','#ec4899'] },
                    { id: 'minimal', label: 'بسيط', desc: 'نظيف بدون زخرفة', colors: ['#1f2937','#6b7280','#3b82f6'] },
                    { id: 'creative', label: 'إبداعي', desc: 'ألوان جريئة ومبتكرة', colors: ['#dc2626','#f59e0b','#10b981'] },
                    { id: 'custom', label: 'مخصص', desc: 'اختر ألوانك', colors: ['#0f766e','#be185d','#7c3aed'] },
                  ].map(b => (
                    <button key={b.id} onClick={() => handleIntentChip(b.id)}
                      className="flex flex-col gap-1.5 p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.03] transition-all active:scale-[0.97]">
                      <div className="flex gap-1">
                        {b.colors.map((c,i) => <div key={i} className="w-4 h-4 rounded-full" style={{background:c}} />)}
                      </div>
                      <div className="text-[11px] font-bold text-foreground">{b.label}</div>
                      <div className="text-[9px] text-muted-foreground">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Language */}
            {pendingIntent.step === 5 && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-foreground">اللغة</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'ar', label: 'العربية', flag: '\u{1F1F8}\u{1F1E6}' },
                    { id: 'en', label: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
                    { id: 'both', label: 'ثنائي اللغة', flag: '\u{1F310}' },
                  ].map(l => (
                    <button key={l.id} onClick={() => handleIntentChip(l.id)}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-card hover:border-primary/30 hover:bg-primary/[0.03] text-[12px] font-bold transition-all active:scale-95">
                      <span className="text-[16px]">{l.flag}</span>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Confirm */}
            {pendingIntent.step === 6 && (
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-semibold text-foreground">ملخص الطلب</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-muted-foreground">الموضوع:</span><span className="font-bold text-foreground">{pendingIntent.topic}</span>
                  <span className="text-muted-foreground">النمط:</span><span className="font-bold text-foreground">{{'professional':'احترافي','infographic':'إنفوجرافيك','executive':'قيادي','creative':'إبداعي','minimal':'بسيط','data-heavy':'تحليلي'}[pendingIntent.style] || pendingIntent.style}</span>
                  <span className="text-muted-foreground">المحتوى:</span><span className="font-bold text-foreground">{{'ai':'ذكاء اصطناعي','user':'محتوى خاص','library':'من المكتبة'}[pendingIntent.contentSource] || pendingIntent.contentSource}</span>
                  <span className="text-muted-foreground">العدد:</span><span className="font-bold text-foreground">{pendingIntent.slideCount} {pendingIntent.type === 'presentation' ? 'شريحة' : 'قسم'}</span>
                  <span className="text-muted-foreground">الهوية:</span><span className="font-bold text-foreground">{{'ndmo':'NDMO','sdaia':'سدايا','modern':'عصري','minimal':'بسيط','creative':'إبداعي','custom':'مخصص'}[pendingIntent.brandId] || pendingIntent.brandId}</span>
                  <span className="text-muted-foreground">اللغة:</span><span className="font-bold text-foreground">{{'ar':'العربية','en':'English','both':'ثنائي'}[pendingIntent.language] || pendingIntent.language}</span>
                </div>
                <button onClick={() => handleIntentChip('execute')}
                  className="w-full py-3 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary/90 transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2">
                  <MaterialIcon icon="rocket_launch" size={18} />
                  ابدأ الإنشاء
                </button>
              </div>
            )}

            {/* Selections summary */}
            {pendingIntent.step > 0 && pendingIntent.step < 6 && (
              <div className="flex flex-wrap gap-1 pt-0.5 border-t border-border/20 mt-0.5 pt-1.5">
                {pendingIntent.topic && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{pendingIntent.topic}</span>}
                {pendingIntent.step > 1 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{'professional':'احترافي','infographic':'إنفوجرافيك','executive':'قيادي','creative':'إبداعي','minimal':'بسيط','data-heavy':'تحليلي'}[pendingIntent.style]}</span>}
                {pendingIntent.step > 2 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{'ai':'AI','user':'محتوى خاص','library':'مكتبة'}[pendingIntent.contentSource]}</span>}
                {pendingIntent.step > 3 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{pendingIntent.slideCount} شريحة</span>}
                {pendingIntent.step > 4 && <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{{'ndmo':'NDMO','sdaia':'سدايا','modern':'عصري','minimal':'بسيط','creative':'إبداعي','custom':'مخصص'}[pendingIntent.brandId]}</span>}

              </div>
            )}
          </div>
        </div>
      )}

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
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-95 group ${uploadedFile ? 'bg-primary/10' : ''} ${theme === 'dark' ? 'hover:bg-gray-200' : 'hover:bg-accent'}`}
              title={uploadedFile ? `ملف مرفق: ${uploadedFile.name}` : 'إرفاق ملف (صورة أو PDF) للمطابقة البصرية'}
            >
              <MaterialIcon icon={uploadedFile ? 'check_circle' : 'attach_file'} size={19} className={`transition-colors ${uploadedFile ? 'text-primary' : theme === 'dark' ? 'text-gray-500 group-hover:text-gray-800' : 'text-muted-foreground group-hover:text-primary'}`} />
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
