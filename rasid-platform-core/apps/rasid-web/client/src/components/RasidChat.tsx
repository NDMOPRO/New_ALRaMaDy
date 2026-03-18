/**
 * RasidChat — Unified AI chat with professional presentation generation
 * Flow: Topic → Simple Config → Slides Outline (P1,P2...) → Approve → Generate one-by-one → View + Edit + Save
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MaterialIcon from "./MaterialIcon";
import { CHARACTERS, BACKGROUNDS } from "../lib/assets";
import { cn } from "../lib/utils";
import { trpc } from "../lib/trpc";
import { Streamdown } from "streamdown";
import { InlineSlide } from "./InlineSlide";
import type { ChatMessage, SlideContent, TOCItem } from "../lib/chatTypes";
import { WELCOME_ACTIONS } from "../lib/chatTypes";
import type { SlideData } from "../lib/slideTemplates";
import { THEMES } from "../lib/slideTemplates";
import { BRAND_THEMES } from "../lib/assets";
import { useWorkspace } from "../contexts/WorkspaceContext";

// ─── Rased Character Images & Motivational Messages ───
const RASED_POSES = [
  '/ndmo-assets/rased-character/rased-waving.webp',
  '/ndmo-assets/rased-character/rased-pose1.webp',
  '/ndmo-assets/rased-character/rased-pose2.webp',
  '/ndmo-assets/rased-character/rased-pose3.webp',
  '/ndmo-assets/rased-character/rased-pose4.webp',
  '/ndmo-assets/rased-character/rased-pose5.webp',
  '/ndmo-assets/rased-character/rased-pose6.webp',
  '/ndmo-assets/rased-character/rased-pose7.webp',
  '/ndmo-assets/rased-character/rased-shmagh.webp',
  '/ndmo-assets/rased-character/rased-standing.webp',
  '/ndmo-assets/rased-character/rased-sunglasses.webp',
  '/ndmo-assets/rased-character/rased-arms-crossed.webp',
  '/ndmo-assets/rased-character/rased-dark1.webp',
  '/ndmo-assets/rased-character/rased-dark2.webp',
  '/ndmo-assets/rased-character/rased-pose1b.webp',
  '/ndmo-assets/rased-character/rased-pose3b.webp',
  '/ndmo-assets/rased-character/rased-pose4b.webp',
];

const RASED_MESSAGES_GENERATING = [
  { text: 'جاري تحليل البيانات وبناء الشريحة...', icon: 'analytics' },
  { text: 'أصمم لك شريحة احترافية بأعلى جودة!', icon: 'auto_awesome' },
  { text: 'أضيف التفاصيل والبيانات الدقيقة...', icon: 'data_usage' },
  { text: 'أعمل على تنسيق المحتوى بشكل مثالي!', icon: 'palette' },
  { text: 'أبدع في التصميم... انتظر النتيجة!', icon: 'brush' },
  { text: 'أحلل المعلومات وأرتبها بذكاء...', icon: 'psychology' },
  { text: 'شريحة جديدة قادمة... ستعجبك!', icon: 'rocket_launch' },
  { text: 'أضيف الرسوم والأرقام الحقيقية...', icon: 'bar_chart' },
  { text: 'التصميم يأخذ شكله النهائي...', icon: 'design_services' },
  { text: 'أعمل بأقصى طاقتي لإبهارك!', icon: 'bolt' },
  { text: 'جاري صياغة المحتوى الاحترافي...', icon: 'edit_note' },
  { text: 'أضيف اللمسات الأخيرة على الشريحة...', icon: 'tune' },
];

const RASED_MESSAGES_COMPLETE = [
  'تم الانتهاء! عرض احترافي بمستوى عالمي!',
  'العرض جاهز! أتمنى يعجبك!',
  'انتهيت! عرض يليق بمكتب إدارة البيانات الوطنية!',
  'تفضل! عرض تقديمي Ultra Premium!',
];

function getRasedPose(index: number) {
  return RASED_POSES[index % RASED_POSES.length];
}

function getGeneratingMessage(index: number) {
  return RASED_MESSAGES_GENERATING[index % RASED_MESSAGES_GENERATING.length];
}

// ─── Helpers ───
let msgCounter = 0;
function newId() { return `msg_${Date.now()}_${++msgCounter}`; }

function castSlide(raw: Record<string, unknown>): SlideData {
  return {
    layout: (raw.layout as SlideData["layout"]) || "content",
    title: (raw.title as string) || "",
    subtitle: raw.subtitle as string | undefined,
    content: raw.content as string | undefined,
    bulletPoints: raw.bulletPoints as string[] | undefined,
    kpiItems: raw.kpiItems as SlideData["kpiItems"],
    chartType: raw.chartType as SlideData["chartType"],
    chartData: raw.chartData as number[] | undefined,
    chartLabels: raw.chartLabels as string[] | undefined,
    chartColors: raw.chartColors as string[] | undefined,
    tableHeaders: raw.tableHeaders as string[] | undefined,
    tableRows: raw.tableRows as string[][] | undefined,
    timelineItems: raw.timelineItems as SlideData["timelineItems"],
    pillarItems: raw.pillarItems as SlideData["pillarItems"],
    infographicItems: raw.infographicItems as SlideData["infographicItems"],
  };
}

// ─── Simple Config ───
interface PresentationConfig {
  topic: string;
  themeId: string;
  slideCount: number;
  style: string;
  customContent: string;
}

const DEFAULT_CONFIG: PresentationConfig = {
  topic: "",
  themeId: "ndmo",
  slideCount: 8,
  style: "professional",
  customContent: "",
};

const SIMPLE_SLIDE_COUNTS = [6, 8, 10, 15] as const;

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export function RasidChat() {
  const { navigateTo } = useWorkspace();
  const onOpenInEditor = (slides: SlideData[], themeId: string, topic: string) => {
    navigateTo({
      targetView: 'presentations',
      data: { slides, themeId, topic },
      label: topic || 'عرض تقديمي',
    });
  };

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [showPresDropdown, setShowPresDropdown] = useState(false);
  const [presConfig, setPresConfig] = useState<PresentationConfig>({ ...DEFAULT_CONFIG });
  const [awaitingTocApproval, setAwaitingTocApproval] = useState<{
    msgId: string;
    toc: TOCItem[];
    config: PresentationConfig;
  } | null>(null);

  // Slide viewer state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // tRPC mutations
  const chatMutation = trpc.ai.chat.useMutation();
  const generateTocMutation = trpc.ai.generateTOC.useMutation();
  const generateSlideMutation = trpc.ai.generateSingleSlide.useMutation();
  const editSlideAIMutation = trpc.ai.editSlideAI.useMutation();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPresDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const updateMessage = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...update } : m));
  }, []);

  // ─── Start Presentation: Generate TOC → Show Outline ───
  const startPresentation = useCallback(async (config: PresentationConfig) => {
    setShowPresDropdown(false);
    setIsTyping(true);

    const brandLabel = BRAND_THEMES.find(b => b.id === config.themeId)?.label || config.themeId;
    addMessage({
      id: newId(),
      role: "user",
      text: `أنشئ عرض تقديمي عن "${config.topic}" — ${config.slideCount} شريحة — ${brandLabel}`,
      timestamp: Date.now(),
    });

    const presId = newId();
    addMessage({
      id: presId,
      role: "assistant",
      text: `جاري تحليل الموضوع وإنشاء فهرس المحتويات...`,
      timestamp: Date.now(),
      isStreaming: true,
    });

    try {
      const tocResult = await generateTocMutation.mutateAsync({
        topic: config.topic,
        slideCount: config.slideCount,
        style: config.style,
        language: "ar",
        additionalInstructions: config.customContent || undefined,
      });

      const toc: TOCItem[] = (tocResult.toc || []).map((t: any, i: number) => ({
        index: t.index || i + 1,
        title: t.title || `شريحة ${i + 1}`,
        layout: t.layout || "content",
        description: t.description || "",
      }));

      // Show Slides Outline for approval
      updateMessage(presId, {
        text: `**Slides Outline — ${config.topic}**`,
        isStreaming: false,
        richContent: {
          kind: "slides",
          topic: config.topic,
          toc,
          slides: [],
          themeId: config.themeId,
          status: "outline",
          currentIndex: -1,
        },
      });

      setAwaitingTocApproval({ msgId: presId, toc, config });
      setIsTyping(false);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "خطأ غير متوقع";
      updateMessage(presId, {
        text: `عذراً، حدث خطأ أثناء إنشاء فهرس المحتويات:\n\n${errMsg}`,
        isError: true,
        isStreaming: false,
        richContent: undefined,
      });
      setIsTyping(false);
    }
  }, [addMessage, updateMessage, generateTocMutation]);

  // ─── Approve TOC → Generate slides one by one ───
  const approveToc = useCallback(async () => {
    if (!awaitingTocApproval) return;
    const { msgId, toc, config } = awaitingTocApproval;
    setAwaitingTocApproval(null);
    setIsTyping(true);
    setActiveSlideIndex(0);

    const generatedSlides: SlideData[] = [];

    try {
      for (let i = 0; i < toc.length; i++) {
        const tocItem = toc[i];

        updateMessage(msgId, {
          text: `**${config.topic}** — جاري إنشاء الشريحة P${i + 1} من ${toc.length}...`,
          richContent: {
            kind: "slides",
            topic: config.topic,
            toc,
            slides: [...generatedSlides],
            themeId: config.themeId,
            status: "generating",
            currentIndex: i,
          },
          isStreaming: true,
        });

        scrollToBottom();

        const slideResult = await generateSlideMutation.mutateAsync({
          topic: config.topic,
          slideIndex: i,
          slideTitle: tocItem.title,
          slideLayout: tocItem.layout,
          slideDescription: tocItem.description,
          totalSlides: toc.length,
          style: config.style,
          language: "ar",
          previousSlides: generatedSlides.map(s => ({ title: s.title, layout: s.layout })),
        });

        const newSlide = castSlide(slideResult.slide as Record<string, unknown>);
        generatedSlides.push(newSlide);

        setActiveSlideIndex(i);

        updateMessage(msgId, {
          text: `**${config.topic}** — تم إنشاء P${i + 1} من ${toc.length}`,
          richContent: {
            kind: "slides",
            topic: config.topic,
            toc,
            slides: [...generatedSlides],
            themeId: config.themeId,
            status: "generating",
            currentIndex: i + 1,
          },
        });

        scrollToBottom();
      }

      // Complete
      updateMessage(msgId, {
        text: `تم إنشاء العرض التقديمي **"${config.topic}"** — ${generatedSlides.length} شريحة`,
        richContent: {
          kind: "slides",
          topic: config.topic,
          toc,
          slides: generatedSlides,
          themeId: config.themeId,
          status: "complete",
          currentIndex: generatedSlides.length,
        },
        isStreaming: false,
      });

      setActiveSlideIndex(0);

      setChatHistory(prev => [
        ...prev,
        { role: "user", content: `أنشئ عرض تقديمي عن: ${config.topic}` },
        { role: "assistant", content: `تم إنشاء عرض "${config.topic}" — ${generatedSlides.length} شريحة` },
      ]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "خطأ";
      updateMessage(msgId, {
        text: `عذراً، حدث خطأ أثناء إنشاء الشريحة P${generatedSlides.length + 1}:\n\n${errMsg}`,
        isError: true,
        isStreaming: false,
      });
    } finally {
      setIsTyping(false);
    }
  }, [awaitingTocApproval, updateMessage, generateSlideMutation, scrollToBottom]);

  // ─── Reject TOC ───
  const rejectToc = useCallback(() => {
    if (!awaitingTocApproval) return;
    const { msgId } = awaitingTocApproval;
    setAwaitingTocApproval(null);
    updateMessage(msgId, {
      text: "تم إلغاء إنشاء العرض التقديمي. يمكنك المحاولة مرة أخرى.",
      richContent: undefined,
      isStreaming: false,
    });
  }, [awaitingTocApproval, updateMessage]);

  // ─── Handle slide edit from AI ───
  const handleSlideAIEdit = useCallback(
    async (msgId: string, slideIndex: number, instruction: string) => {
      const msg = messages.find(m => m.id === msgId);
      if (!msg?.richContent || msg.richContent.kind !== "slides") return;
      const slideContent = msg.richContent as SlideContent;
      const currentSlide = slideContent.slides[slideIndex];
      if (!currentSlide) return;

      setIsTyping(true);
      try {
        const result = await editSlideAIMutation.mutateAsync({
          currentSlide: currentSlide as unknown as Record<string, unknown>,
          instruction,
          slideIndex,
        });
        const newSlide = castSlide(result.slide as Record<string, unknown>);
        const newSlides = [...slideContent.slides];
        newSlides[slideIndex] = newSlide;
        updateMessage(msgId, { richContent: { ...slideContent, slides: newSlides } });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : "خطأ";
        addMessage({
          id: newId(), role: "assistant",
          text: `عذراً، فشل تعديل الشريحة P${slideIndex + 1}: ${errMsg}`,
          timestamp: Date.now(), isError: true,
        });
      } finally {
        setIsTyping(false);
      }
    },
    [messages, editSlideAIMutation, updateMessage, addMessage]
  );

  // ─── Handle manual slide edit ───
  const handleSlideManualEdit = useCallback(
    (msgId: string, slideIndex: number, data: Partial<SlideData>) => {
      const msg = messages.find(m => m.id === msgId);
      if (!msg?.richContent || msg.richContent.kind !== "slides") return;
      const slideContent = msg.richContent as SlideContent;
      const newSlides = [...slideContent.slides];
      newSlides[slideIndex] = { ...newSlides[slideIndex], ...data };
      updateMessage(msgId, { richContent: { ...slideContent, slides: newSlides } });
    },
    [messages, updateMessage]
  );

  // ─── Handle theme change ───
  const handleThemeChange = useCallback(
    (msgId: string, themeId: string) => {
      const msg = messages.find(m => m.id === msgId);
      if (!msg?.richContent || msg.richContent.kind !== "slides") return;
      updateMessage(msgId, { richContent: { ...(msg.richContent as SlideContent), themeId } });
    },
    [messages, updateMessage]
  );

  // ─── File Upload Handler ───
  const handleFileUpload = useCallback(async (files: FileList) => {
    const fileNames = Array.from(files).map(f => f.name).join(', ');
    addMessage({ id: newId(), role: 'user', text: `تم إرفاق: ${fileNames}`, timestamp: Date.now() });
    // Upload via /api/upload
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        addMessage({ id: newId(), role: 'assistant', text: `تم رفع ${data.files?.length || files.length} ملف بنجاح! يمكنك الآن طلب تحليلها أو إنشاء عرض منها.`, timestamp: Date.now() });
      } else {
        addMessage({ id: newId(), role: 'assistant', text: 'عذراً، حدث خطأ أثناء رفع الملفات.', timestamp: Date.now(), isError: true });
      }
    } catch {
      addMessage({ id: newId(), role: 'assistant', text: 'عذراً، حدث خطأ أثناء رفع الملفات.', timestamp: Date.now(), isError: true });
    }
  }, [addMessage]);

  // ─── Text-to-Speech (TTS) ───
  const ttsMutation = trpc.ai.textToSpeech.useMutation();
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTTS = useCallback(async (text: string, msgId: string) => {
    if (playingTtsId === msgId) {
      // Stop playing
      audioRef.current?.pause();
      setPlayingTtsId(null);
      return;
    }
    try {
      setPlayingTtsId(msgId);
      const result = await ttsMutation.mutateAsync({ text: text.slice(0, 4000), voice: 'alloy' });
      const audio = new Audio(`data:audio/mpeg;base64,${result.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setPlayingTtsId(null);
      audio.play();
    } catch {
      setPlayingTtsId(null);
    }
  }, [ttsMutation, playingTtsId]);

  // ─── Send message ───
  const handleSend = useCallback(async () => {
    if (!input.trim() || isTyping) return;
    const userText = input.trim();

    addMessage({ id: newId(), role: "user", text: userText, timestamp: Date.now() });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // Detect presentation intent
    const lower = userText.toLowerCase();
    const isPresentation =
      lower.includes("عرض") || lower.includes("تقديمي") || lower.includes("شرائح") ||
      lower.includes("بريزنتيشن") || lower.includes("presentation") || lower.includes("slides");

    if (isPresentation) {
      const topic = userText
        .replace(/أنشئ|اعمل|سوي|صمم|اصنع|عرض تقديمي|عرض|تقديمي|شرائح|بريزنتيشن|عن|حول|بخصوص|presentation|slides|create|make/gi, "")
        .trim() || userText;

      setPresConfig(prev => ({ ...prev, topic }));
      setShowPresDropdown(true);

      addMessage({
        id: newId(), role: "assistant",
        text: `حسناً! سأنشئ عرض تقديمي عن **"${topic}"**.\n\nاختر الإعدادات ثم اضغط **ابدأ التوليد**.`,
        timestamp: Date.now(),
      });
      return;
    }

    // Regular chat
    setIsTyping(true);
    try {
      const result = await chatMutation.mutateAsync({
        messages: [
          ...chatHistory.slice(-10),
          { role: "user" as const, content: userText },
        ],
      });
      setChatHistory(prev => [
        ...prev,
        { role: "user", content: userText },
        { role: "assistant", content: result.content },
      ]);
      addMessage({
        id: newId(), role: "assistant", text: result.content,
        timestamp: Date.now(), intent: result.intent,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "خطأ غير متوقع";
      addMessage({
        id: newId(), role: "assistant",
        text: `عذراً، حدث خطأ:\n\n${errMsg}`,
        timestamp: Date.now(), isError: true,
      });
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, chatMutation, chatHistory, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Welcome Screen
  // ═══════════════════════════════════════════════════════════
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: `url(${BACKGROUNDS.pattern})`, backgroundSize: "cover" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(212,175,55,0.04) 0%, transparent 60%)" }} />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pb-4 sm:pb-8">
          <div className="max-w-2xl w-full text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 rounded-full bg-[#d4af37]/5 blur-[60px]" />
              </div>
              <img src={CHARACTERS.char2_shmagh} alt="راصد" className="h-24 sm:h-32 md:h-40 mx-auto animate-float drop-shadow-2xl relative z-10" />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2">
                أهلاً بك في <span className="text-gold-gradient">راصد الذكي</span>
              </h2>
              <p className="text-[#5a6f8f] text-xs sm:text-sm mb-6 max-w-md mx-auto leading-relaxed px-2">
                مساعدك الذكي لإنشاء العروض التقديمية والتقارير ولوحات المؤشرات
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
              {WELCOME_ACTIONS.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-[#0d1628]/60 border border-[#162040] hover:border-[#d4af37]/20 hover:bg-[#0f1a30] transition-all duration-300 group"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300" style={{ backgroundColor: `${action.color}15` }}>
                    <MaterialIcon icon={action.icon} size={20} style={{ color: action.color }} />
                  </div>
                  <span className="text-[11px] font-medium text-[#6a7f9f] group-hover:text-white/80 transition-colors">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>

        <InputBar
          input={input} isTyping={isTyping} inputRef={inputRef}
          onChange={handleInputChange} onKeyDown={handleKeyDown} onSend={handleSend} onSetInput={setInput}
          showPresDropdown={showPresDropdown} onTogglePresDropdown={() => setShowPresDropdown(p => !p)}
          presConfig={presConfig} onPresConfigChange={setPresConfig}
          onStartPresentation={startPresentation}
          dropdownRef={dropdownRef}
          onFileUpload={handleFileUpload}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Chat View
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
        <AnimatePresence>
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              activeSlideIndex={activeSlideIndex}
              onActiveSlideChange={setActiveSlideIndex}
              onSlideEdit={(idx, data) => handleSlideManualEdit(msg.id, idx, data)}
              onSlideAIEdit={(idx, instruction) => handleSlideAIEdit(msg.id, idx, instruction)}
              onThemeChange={(themeId) => handleThemeChange(msg.id, themeId)}
              onOpenInEditor={onOpenInEditor}
              onPlayTTS={playTTS}
              playingTtsId={playingTtsId}
            />
          ))}
        </AnimatePresence>

        {/* TOC Approval Buttons */}
        {awaitingTocApproval && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/[0.04]">
            <MaterialIcon icon="check_circle" size={18} className="text-[#d4af37]" />
            <span className="text-xs text-[#8899b8] flex-1">هل توافق على هذا الفهرس؟ يمكنك تعديله أو الموافقة لبدء التوليد.</span>
            <button onClick={approveToc} className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c49b2a] text-[#0a0f1e] text-xs font-bold hover:shadow-lg hover:shadow-[#d4af37]/20 transition-all flex items-center gap-1.5">
              <MaterialIcon icon="play_arrow" size={14} />
              موافق — ابدأ التوليد
            </button>
            <button onClick={rejectToc} className="px-3 py-2 rounded-xl text-[#5a6f8f] text-xs hover:bg-[#111d35] transition-all border border-[#1a2744]">
              إلغاء
            </button>
          </motion.div>
        )}

        {/* Typing indicator with Rased character */}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-end">
            <motion.div
              className="shrink-0 relative"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <img
                src={getRasedPose(Math.floor(Date.now() / 3000) % RASED_POSES.length)}
                alt="راصد"
                className="w-12 h-12 object-contain drop-shadow-lg"
              />
              <motion.div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#d4af37] flex items-center justify-center"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <MaterialIcon icon="auto_awesome" size={10} className="text-[#0a0f1e]" />
              </motion.div>
            </motion.div>
            <div className="bg-[#0f1a30]/80 border border-[#d4af37]/15 rounded-2xl px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-[#d4af37]" />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-[#00B388]" />
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-[#2B5EA7]" />
                </div>
                <span className="text-[10px] text-[#8899b8] mr-1">راصد يعمل بجد...</span>
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <InputBar
        input={input} isTyping={isTyping} inputRef={inputRef}
        onChange={handleInputChange} onKeyDown={handleKeyDown} onSend={handleSend} onSetInput={setInput}
        showPresDropdown={showPresDropdown} onTogglePresDropdown={() => setShowPresDropdown(p => !p)}
        presConfig={presConfig} onPresConfigChange={setPresConfig}
        onStartPresentation={startPresentation}
        dropdownRef={dropdownRef}
        onFileUpload={handleFileUpload}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MessageBubble
// ═══════════════════════════════════════════════════════════

interface MessageBubbleProps {
  msg: ChatMessage;
  activeSlideIndex: number;
  onActiveSlideChange: (index: number) => void;
  onSlideEdit: (index: number, data: Partial<SlideData>) => void;
  onSlideAIEdit: (index: number, instruction: string) => void;
  onThemeChange: (themeId: string) => void;
  onOpenInEditor?: (slides: SlideData[], themeId: string, topic: string) => void;
  onPlayTTS?: (text: string, msgId: string) => void;
  playingTtsId?: string | null;
}

function MessageBubble({ msg, activeSlideIndex, onActiveSlideChange, onSlideEdit, onSlideAIEdit, onThemeChange, onOpenInEditor, onPlayTTS, playingTtsId }: MessageBubbleProps) {
  const isUser = msg.role === "user";
  const hasSlides = msg.richContent?.kind === "slides";
  const slideContent = hasSlides ? (msg.richContent as SlideContent) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "")}
    >
      {!isUser ? (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#c49b2a] flex items-center justify-center shrink-0 shadow-lg shadow-[#d4af37]/10 self-start sticky top-4">
          <MaterialIcon icon="smart_toy" size={16} className="text-[#0a0f1e]" />
        </div>
      ) : (
        <div className="w-8 h-8 rounded-xl bg-[#1a2744] flex items-center justify-center shrink-0 border border-[#253550] self-start">
          <MaterialIcon icon="person" size={16} className="text-[#5a6f8f]" />
        </div>
      )}

      <div className={cn("flex-1 min-w-0", isUser ? "max-w-[85%] sm:max-w-[80%]" : "max-w-[95%] sm:max-w-[90%]")}>
        {/* Text bubble */}
        <div className={cn(
          "rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed",
          isUser ? "bg-[#d4af37]/[0.08] text-white/90 border border-[#d4af37]/15"
            : msg.isError ? "bg-red-900/20 text-red-300 border border-red-800/30"
            : "bg-[#0f1a30]/80 text-[#b8c8e0] border border-[#1a2744]"
        )}>
          {!isUser ? (
            <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-[#d4af37]">
              <Streamdown>{msg.text}</Streamdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{msg.text}</p>
          )}
          {/* TTS Button for assistant messages */}
          {!isUser && !msg.isError && msg.text.length > 10 && onPlayTTS && (
            <button
              onClick={() => onPlayTTS(msg.text, msg.id)}
              className={cn(
                "mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all",
                playingTtsId === msg.id
                  ? "text-[#d4af37] bg-[#d4af37]/10 animate-pulse"
                  : "text-[#4a5f7f] hover:text-[#d4af37] hover:bg-[#0f1a30]"
              )}
              title={playingTtsId === msg.id ? "إيقاف الصوت" : "استمع بالصوت"}
            >
              <MaterialIcon icon={playingTtsId === msg.id ? "stop" : "volume_up"} size={14} />
              {playingTtsId === msg.id ? "جاري التشغيل..." : "استمع"}
            </button>
          )}
        </div>

        {/* ─── Slides Outline (TOC with P1, P2...) ─── */}
        {slideContent && slideContent.status === "outline" && (
          <SlidesOutline toc={slideContent.toc} topic={slideContent.topic} />
        )}

        {/* ─── Slide Viewer (generating + complete) ─── */}
        {slideContent && (slideContent.status === "generating" || slideContent.status === "complete") && (
          <SlideViewer
            slideContent={slideContent}
            activeSlideIndex={activeSlideIndex}
            onActiveSlideChange={onActiveSlideChange}
            onSlideEdit={onSlideEdit}
            onSlideAIEdit={onSlideAIEdit}
            onThemeChange={onThemeChange}
            onOpenInEditor={onOpenInEditor}
          />
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Slides Outline — P1, P2... with title + description
// ═══════════════════════════════════════════════════════════

function SlidesOutline({ toc, topic }: { toc: TOCItem[]; topic: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 rounded-xl border border-[#1a2744] bg-[#0c1628]/90 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a2744]/60 bg-[#0a1020]/60">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="list_alt" size={18} className="text-[#d4af37]" />
          <span className="text-sm font-bold text-white">Slides Outline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#4a5f7f]">{toc.length} شريحة</span>
        </div>
      </div>

      {/* TOC Items */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
        {toc.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3"
          >
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-[#d4af37]/60" />
              <div className="px-2 py-0.5 rounded-md bg-[#1a2744]/80 text-[11px] font-bold text-[#8899b8] min-w-[32px] text-center">
                P{item.index}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-[#c8d8f0] leading-relaxed">{item.title}</div>
              {item.description && (
                <div className="text-[11px] text-[#5a6f8f] mt-0.5 leading-relaxed">.{item.description}</div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// Slide Viewer — Main slide + thumbnails + navigation
// ═══════════════════════════════════════════════════════════

interface SlideViewerProps {
  slideContent: SlideContent;
  activeSlideIndex: number;
  onActiveSlideChange: (index: number) => void;
  onSlideEdit: (index: number, data: Partial<SlideData>) => void;
  onSlideAIEdit: (index: number, instruction: string) => void;
  onThemeChange: (themeId: string) => void;
  onOpenInEditor?: (slides: SlideData[], themeId: string, topic: string) => void;
}

function SlideViewer({
  slideContent,
  activeSlideIndex,
  onActiveSlideChange,
  onSlideEdit,
  onSlideAIEdit,
  onThemeChange,
  onOpenInEditor,
}: SlideViewerProps) {
  const { slides, toc, themeId, status, topic } = slideContent;
  const lastSlideRef = useRef<HTMLDivElement>(null);
  const prevSlidesCount = useRef(0);

  // Auto-scroll to the newest slide when a new one is added
  useEffect(() => {
    if (slides.length > prevSlidesCount.current && lastSlideRef.current) {
      setTimeout(() => {
        lastSlideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
    prevSlidesCount.current = slides.length;
  }, [slides.length]);

  if (slides.length === 0) {
    // Still generating first slide — Rased animated waiting
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-2xl border border-[#d4af37]/15 bg-gradient-to-br from-[#0c1628] to-[#0a1020] p-5 overflow-hidden relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-[#d4af37]/20"
              style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 25}%` }}
              animate={{ y: [-10, 10, -10], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <motion.div
            animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="relative"
          >
            <img src={getRasedPose(0)} alt="راصد" className="w-16 h-16 object-contain drop-shadow-2xl" />
            <motion.div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-[#d4af37] to-[#E8A838] flex items-center justify-center shadow-lg shadow-[#d4af37]/30"
              animate={{ scale: [1, 1.4, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <MaterialIcon icon="auto_awesome" size={12} className="text-[#0a0f1e]" />
            </motion.div>
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#d4af37] font-bold">{getGeneratingMessage(0).text}</span>
              <MaterialIcon icon={getGeneratingMessage(0).icon} size={16} className="text-[#d4af37]/60" />
            </div>
            <div className="text-[11px] text-[#5a6f8f] mt-1">الشريحة P1 من {toc.length} • {topic}</div>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#1a2744] overflow-hidden relative">
          <motion.div
            className="h-full bg-gradient-to-r from-[#d4af37] via-[#E8A838] to-[#00B388] rounded-full relative"
            initial={{ width: "0%" }}
            animate={{ width: "8%" }}
            transition={{ duration: 0.8 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Rased animated progress bar (during generation) */}
      {status === "generating" && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-[#d4af37]/10 bg-[#0c1628]/80 p-3 overflow-hidden relative sticky top-0 z-20"
        >
          <div className="flex items-center gap-3">
            <motion.img
              key={`rased-gen-${slides.length}`}
              src={getRasedPose(slides.length)}
              alt="راصد"
              className="w-10 h-10 object-contain drop-shadow-lg"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0, y: [0, -4, 0] }}
              transition={{ scale: { duration: 0.3 }, y: { duration: 1.5, repeat: Infinity } }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <MaterialIcon icon={getGeneratingMessage(slides.length).icon} size={14} className="text-[#d4af37]" />
                <motion.span
                  key={`msg-${slides.length}`}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[11px] text-[#b8c8e0] font-medium truncate"
                >
                  {getGeneratingMessage(slides.length).text}
                </motion.span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-[#1a2744] overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#d4af37] via-[#E8A838] to-[#00B388] rounded-full"
                    animate={{ width: `${(slides.length / toc.length) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
                <span className="text-[10px] text-[#d4af37] font-bold shrink-0">P{slides.length}/{toc.length}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Rased celebration (when complete) */}
      {status === "complete" && slides.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-[#00B388]/20 bg-[#00B388]/[0.04] p-3 flex items-center gap-3 relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full"
                style={{
                  left: `${10 + i * 12}%`,
                  backgroundColor: ['#d4af37', '#00B388', '#2B5EA7', '#E8A838'][i % 4],
                }}
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: -20, opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, delay: i * 0.1, ease: 'easeOut' }}
              />
            ))}
          </div>
          <motion.img
            src={getRasedPose(2)}
            alt="راصد"
            className="w-12 h-12 object-contain drop-shadow-lg"
            animate={{ y: [0, -5, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 1.5, repeat: 2 }}
          />
          <div className="flex-1">
            <div className="text-sm font-bold text-[#00B388]">
              {RASED_MESSAGES_COMPLETE[Math.floor(Math.random() * RASED_MESSAGES_COMPLETE.length)]}
            </div>
            <div className="text-[10px] text-[#5a6f8f] mt-0.5">{slides.length} شريحة احترافية • {topic}</div>
          </div>
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 2, repeat: 1 }}
          >
            <MaterialIcon icon="celebration" size={24} className="text-[#d4af37]" />
          </motion.div>
        </motion.div>
      )}

      {/* ─── ALL SLIDES VERTICALLY ─── */}
      <div className="space-y-4">
        <AnimatePresence>
          {slides.map((slide, i) => (
            <motion.div
              key={`vslide-${i}`}
              ref={i === slides.length - 1 ? lastSlideRef : undefined}
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.05 }}
            >
              <InlineSlide
                slide={slide}
                index={i}
                total={toc.length}
                themeId={themeId}
                isNew={i === slides.length - 1 && status === "generating"}
                onEdit={onSlideEdit}
                onRequestAIEdit={onSlideAIEdit}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Actions bar (when complete) */}
      {status === "complete" && (
        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-[10px] text-[#4a5f7f]">الثيم:</span>
          {Object.keys(THEMES).slice(0, 4).map(t => (
            <button key={t} onClick={() => onThemeChange(t)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all", themeId === t ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/20" : "text-[#4a5f7f] hover:text-[#8899b8] hover:bg-[#111d35]")}>
              {THEMES[t]?.name || t}
            </button>
          ))}
          {onOpenInEditor && (
            <button
              onClick={() => onOpenInEditor(slides, themeId, topic)}
              className="mr-auto px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#059669]/15 text-[#059669] hover:bg-[#059669]/25 transition-all flex items-center gap-1"
            >
              <MaterialIcon icon="open_in_new" size={12} />
              فتح في المحرر
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// InputBar — simplified presentation dropdown
// ═══════════════════════════════════════════════════════════

interface InputBarProps {
  input: string;
  isTyping: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onSetInput: (text: string) => void;
  showPresDropdown: boolean;
  onTogglePresDropdown: () => void;
  presConfig: PresentationConfig;
  onPresConfigChange: (config: PresentationConfig | ((prev: PresentationConfig) => PresentationConfig)) => void;
  onStartPresentation: (config: PresentationConfig) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  onFileUpload?: (files: FileList) => void;
}

function InputBar({
  input, isTyping, inputRef, onChange, onKeyDown, onSend, onSetInput,
  showPresDropdown, onTogglePresDropdown,
  presConfig, onPresConfigChange,
  onStartPresentation, dropdownRef, onFileUpload,
}: InputBarProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sttMutation = trpc.ai.speechToText.useMutation();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        // Convert to base64 and send to STT
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          try {
            const result = await sttMutation.mutateAsync({ audioBase64: base64, mimeType: 'audio/webm' });
            if (result.text) onSetInput(result.text);
          } catch (err) {
            console.error('STT error:', err);
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  }, [sttMutation, onSetInput]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleFileClick = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(e.target.files);
      e.target.value = '';
    }
  }, [onFileUpload]);
  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-[#1a2744]/60 bg-[#0a1020]/80 backdrop-blur-sm relative">
      {/* ─── Simplified Presentation Dropdown ─── */}
      <AnimatePresence>
        {showPresDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-3 right-3 sm:left-auto sm:right-4 sm:w-[360px] mb-2 rounded-xl border border-[#1a2744] bg-[#0c1628]/98 backdrop-blur-xl shadow-2xl shadow-black/40 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2744]/60 bg-[#0a1020]/60">
              <div className="flex items-center gap-2">
                <MaterialIcon icon="slideshow" size={16} className="text-[#d4af37]" />
                <span className="text-xs font-bold text-white">عرض تقديمي جديد</span>
              </div>
              <button onClick={onTogglePresDropdown} className="p-1 rounded text-[#4a5f7f] hover:text-white transition-colors">
                <MaterialIcon icon="close" size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Topic */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">الموضوع</label>
                <input
                  value={presConfig.topic}
                  onChange={e => onPresConfigChange(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="مثال: التحول الرقمي في المملكة"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white placeholder:text-[#3a4f6f] focus:border-[#d4af37]/30 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Theme — simplified to 3 */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">الهوية البصرية</label>
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_THEMES.slice(0, 3).map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => onPresConfigChange(prev => ({ ...prev, themeId: theme.id }))}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all border",
                        presConfig.themeId === theme.id
                          ? "border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]"
                          : "border-[#1a2744] text-[#5a6f8f] hover:border-[#253550] hover:text-white/70"
                      )}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ background: theme.primary }} />
                      {theme.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide Count — simplified */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">عدد الشرائح</label>
                <div className="flex gap-1.5">
                  {SIMPLE_SLIDE_COUNTS.map(count => (
                    <button
                      key={count}
                      onClick={() => onPresConfigChange(prev => ({ ...prev, slideCount: count }))}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                        presConfig.slideCount === count
                          ? "border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]"
                          : "border-[#1a2744] text-[#5a6f8f] hover:border-[#253550]"
                      )}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom content (optional) */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">محتوى إضافي <span className="text-[#3a4f6f]">(اختياري)</span></label>
                <textarea
                  value={presConfig.customContent}
                  onChange={e => onPresConfigChange(prev => ({ ...prev, customContent: e.target.value }))}
                  placeholder="أضف ملاحظات أو محتوى خاص تريد تضمينه..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white placeholder:text-[#3a4f6f] focus:border-[#d4af37]/30 focus:outline-none resize-none transition-colors"
                />
              </div>
            </div>

            {/* Start Button */}
            <div className="px-4 py-3 border-t border-[#1a2744]/60 bg-[#0a1020]/60">
              <button
                onClick={() => presConfig.topic.trim() && onStartPresentation(presConfig)}
                disabled={!presConfig.topic.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#c49b2a] text-[#0a0f1e] text-xs font-bold hover:shadow-lg hover:shadow-[#d4af37]/20 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
              >
                <MaterialIcon icon="play_arrow" size={16} />
                ابدأ التوليد
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Input Area ─── */}
      <div className="max-w-3xl mx-auto relative">
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt" className="hidden" onChange={handleFileChange} />

        {/* Recording indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -top-12 left-0 right-0 flex items-center justify-center gap-3 py-2 px-4 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm"
            >
              <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-red-400 font-medium">جاري التسجيل... {recordingTime}ث</span>
              <button onClick={stopRecording} className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-colors">إيقاف</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex items-end gap-1.5 sm:gap-2 bg-[#0d1628]/80 border border-[#1a2744] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 backdrop-blur-sm hover:border-[#d4af37]/15 focus-within:border-[#d4af37]/30 transition-all">
          {/* Presentation button */}
          <button
            onClick={onTogglePresDropdown}
            className={cn(
              "p-2 rounded-lg transition-all shrink-0",
              showPresDropdown ? "text-[#d4af37] bg-[#d4af37]/10" : "text-[#4a5f7f] hover:text-[#d4af37] hover:bg-[#0f1a30]"
            )}
            title="عرض تقديمي"
          >
            <MaterialIcon icon="slideshow" size={18} />
          </button>

          {/* File upload button */}
          <button
            onClick={handleFileClick}
            className="p-2 rounded-lg text-[#4a5f7f] hover:text-[#d4af37] hover:bg-[#0f1a30] transition-all shrink-0"
            title="إرفاق ملف"
          >
            <MaterialIcon icon="attach_file" size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            className="flex-1 px-2 py-2 bg-transparent text-xs sm:text-sm text-white placeholder:text-[#3a4f6f] focus:outline-none resize-none max-h-[120px] min-h-[40px]"
          />

          {/* Voice recording button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "p-2 rounded-lg transition-all shrink-0",
              isRecording ? "text-red-400 bg-red-500/10 animate-pulse" : "text-[#4a5f7f] hover:text-[#d4af37] hover:bg-[#0f1a30]"
            )}
            title={isRecording ? "إيقاف التسجيل" : "تسجيل صوتي"}
          >
            <MaterialIcon icon={isRecording ? "stop" : "mic"} size={18} />
          </button>

          {/* Send button */}
          <button
            onClick={onSend}
            disabled={!input.trim() || isTyping}
            className="p-2.5 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#c49b2a] flex items-center justify-center text-[#0a0f1e] hover:shadow-lg hover:shadow-[#d4af37]/20 disabled:opacity-20 transition-all shrink-0"
          >
            <MaterialIcon icon="send" size={16} className="rotate-180" />
          </button>
        </div>
        <p className="text-[9px] sm:text-[10px] text-[#3a4f6f] text-center mt-1.5 sm:mt-2">
          راصد الذكي — مدعوم بالذكاء الاصطناعي
        </p>
      </div>
    </div>
  );
}
