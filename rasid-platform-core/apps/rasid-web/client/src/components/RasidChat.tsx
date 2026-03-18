/**
 * RasidChat — Unified single-canvas chat component
 * All engines work from the same conversation.
 * Presentations: dropdown -> TOC approval -> slide-by-slide real generation
 * Two modes: normal (simple) / advanced (full options)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MaterialIcon from "./MaterialIcon";
import { CHARACTERS, BACKGROUNDS } from "../lib/assets";
import { cn } from "../lib/utils";
import { trpc } from "../lib/trpc";
import { Streamdown } from "streamdown";
import { InlineSlide } from "./InlineSlide";
import type { ChatMessage, SlideContent } from "../lib/chatTypes";
import { WELCOME_ACTIONS } from "../lib/chatTypes";
import type { SlideData } from "../lib/slideTemplates";
import { THEMES } from "../lib/slideTemplates";
import { PRESENTATION_STYLES, SLIDE_COUNTS, BRAND_THEMES } from "../lib/assets";
import { useWorkspace } from "../contexts/WorkspaceContext";

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

// ─── Presentation Config ───
interface PresentationConfig {
  topic: string;
  themeId: string;
  slideCount: number;
  style: string;
  contentSource: "ai" | "custom" | "mixed";
  useBananaPro: boolean;
  customContent: string;
}

const DEFAULT_CONFIG: PresentationConfig = {
  topic: "",
  themeId: "ndmo",
  slideCount: 8,
  style: "professional",
  contentSource: "ai",
  useBananaPro: false,
  customContent: "",
};

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
  const [uiMode, setUiMode] = useState<"normal" | "advanced">("normal");
  const [showPresDropdown, setShowPresDropdown] = useState(false);
  const [presConfig, setPresConfig] = useState<PresentationConfig>({ ...DEFAULT_CONFIG });
  const [awaitingTocApproval, setAwaitingTocApproval] = useState<{
    msgId: string;
    toc: { index: number; title: string; layout: string; description: string }[];
    config: PresentationConfig;
  } | null>(null);

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

  // ─── Start Presentation Generation (from dropdown) ───
  const startPresentation = useCallback(async (config: PresentationConfig) => {
    setShowPresDropdown(false);
    setIsTyping(true);

    addMessage({
      id: newId(),
      role: "user",
      text: `أنشئ عرض تقديمي عن "${config.topic}" — ${config.slideCount} شريحة — هوية: ${BRAND_THEMES.find(b => b.id === config.themeId)?.label || config.themeId}`,
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
      // Generate TOC from OpenAI
      const tocResult = await generateTocMutation.mutateAsync({
        topic: config.topic,
        slideCount: config.slideCount,
        style: config.style,
        language: "ar",
        additionalInstructions: config.contentSource !== "ai" ? config.customContent : undefined,
      });

      const toc = tocResult.toc;

      // Show TOC and wait for approval
      updateMessage(presId, {
        text: `**فهرس المحتويات — ${config.topic}**`,
        isStreaming: false,
        richContent: {
          kind: "slides",
          topic: config.topic,
          toc: toc.map(t => t.title),
          slides: [],
          themeId: config.themeId,
          status: "generating",
          currentIndex: -1,
        },
      });

      setAwaitingTocApproval({
        msgId: presId,
        toc,
        config,
      });

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

    const tocTitles = toc.map(t => t.title);
    const generatedSlides: SlideData[] = [];

    try {
      for (let i = 0; i < toc.length; i++) {
        const tocItem = toc[i];

        updateMessage(msgId, {
          text: `**${config.topic}** — جاري إنشاء الشريحة ${i + 1} من ${toc.length}...`,
          richContent: {
            kind: "slides",
            topic: config.topic,
            toc: tocTitles,
            slides: [...generatedSlides],
            themeId: config.themeId,
            status: "generating",
            currentIndex: i,
          },
          isStreaming: true,
        });

        scrollToBottom();

        // Generate this slide from OpenAI
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

        updateMessage(msgId, {
          text: `**${config.topic}** — الشريحة ${i + 1} من ${toc.length}`,
          richContent: {
            kind: "slides",
            topic: config.topic,
            toc: tocTitles,
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
        text: `تم إنشاء العرض التقديمي **"${config.topic}"** بنجاح — ${generatedSlides.length} شريحة`,
        richContent: {
          kind: "slides",
          topic: config.topic,
          toc: tocTitles,
          slides: generatedSlides,
          themeId: config.themeId,
          status: "complete",
          currentIndex: generatedSlides.length,
        },
        isStreaming: false,
      });

      setChatHistory(prev => [
        ...prev,
        { role: "user", content: `أنشئ عرض تقديمي عن: ${config.topic}` },
        { role: "assistant", content: `تم إنشاء عرض "${config.topic}" — ${generatedSlides.length} شريحة` },
      ]);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "خطأ";
      updateMessage(msgId, {
        text: `عذراً، حدث خطأ أثناء إنشاء الشريحة ${generatedSlides.length + 1}:\n\n${errMsg}`,
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
          text: `عذراً، فشل تعديل الشريحة ${slideIndex + 1}: ${errMsg}`,
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
        text: `حسناً! سأنشئ عرض تقديمي عن **"${topic}"**. اختر الإعدادات من القائمة أدناه ثم اضغط "ابدأ التوليد".`,
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
              <p className="text-[#5a6f8f] text-xs sm:text-sm mb-4 sm:mb-8 max-w-md mx-auto leading-relaxed px-2">
                مساعدك الذكي لتحليل البيانات وإنشاء العروض التقديمية والتقارير ولوحات المؤشرات
              </p>
            </motion.div>

            {/* Mode Toggle */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-2 mb-4">
              <button
                onClick={() => setUiMode("normal")}
                className={cn("px-3 py-1 rounded-lg text-[11px] font-medium transition-all", uiMode === "normal" ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/20" : "text-[#4a5f7f] hover:text-white/60")}
              >
                وضع بسيط
              </button>
              <button
                onClick={() => setUiMode("advanced")}
                className={cn("px-3 py-1 rounded-lg text-[11px] font-medium transition-all", uiMode === "advanced" ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/20" : "text-[#4a5f7f] hover:text-white/60")}
              >
                وضع متقدم
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5 mb-4 sm:mb-8">
              {WELCOME_ACTIONS.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex flex-col items-center gap-1.5 sm:gap-2.5 p-3 sm:p-4 rounded-xl bg-[#0d1628]/60 border border-[#162040] hover:border-[#d4af37]/20 hover:bg-[#0f1a30] transition-all duration-300 group min-h-[60px] sm:min-h-[80px]"
                >
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300" style={{ backgroundColor: `${action.color}15` }}>
                    <MaterialIcon icon={action.icon} size={18} style={{ color: action.color }} />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-medium text-[#6a7f9f] group-hover:text-white/80 transition-colors leading-tight">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>

        <InputBar
          input={input} isTyping={isTyping} inputRef={inputRef}
          onChange={handleInputChange} onKeyDown={handleKeyDown} onSend={handleSend}
          uiMode={uiMode} onModeChange={setUiMode}
          showPresDropdown={showPresDropdown} onTogglePresDropdown={() => setShowPresDropdown(p => !p)}
          presConfig={presConfig} onPresConfigChange={setPresConfig}
          onStartPresentation={startPresentation}
          dropdownRef={dropdownRef}
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
              onSlideEdit={(idx, data) => handleSlideManualEdit(msg.id, idx, data)}
              onSlideAIEdit={(idx, instruction) => handleSlideAIEdit(msg.id, idx, instruction)}
              onThemeChange={(themeId) => handleThemeChange(msg.id, themeId)}
              onOpenInEditor={onOpenInEditor}
            />
          ))}
        </AnimatePresence>

        {/* TOC Approval Buttons */}
        {awaitingTocApproval && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#d4af37]/20 bg-[#d4af37]/[0.04]">
            <MaterialIcon icon="check_circle" size={18} className="text-[#d4af37]" />
            <span className="text-xs text-[#8899b8] flex-1">هل توافق على هذا الفهرس؟</span>
            <button onClick={approveToc} className="px-4 py-1.5 rounded-lg bg-[#d4af37]/15 text-[#d4af37] text-xs font-medium hover:bg-[#d4af37]/25 transition-all">
              موافق — ابدأ التوليد
            </button>
            <button onClick={rejectToc} className="px-3 py-1.5 rounded-lg text-[#5a6f8f] text-xs hover:bg-[#111d35] transition-all">
              إلغاء
            </button>
          </motion.div>
        )}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#c49b2a] flex items-center justify-center shrink-0">
              <MaterialIcon icon="smart_toy" size={16} className="text-[#0a0f1e]" />
            </div>
            <div className="bg-[#0f1a30]/80 border border-[#1a2744] rounded-2xl px-5 py-3 flex items-center gap-1.5">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#d4af37]/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#d4af37]/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#d4af37]/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[10px] text-[#4a5f7f] mr-2">يعمل...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <InputBar
        input={input} isTyping={isTyping} inputRef={inputRef}
        onChange={handleInputChange} onKeyDown={handleKeyDown} onSend={handleSend}
        uiMode={uiMode} onModeChange={setUiMode}
        showPresDropdown={showPresDropdown} onTogglePresDropdown={() => setShowPresDropdown(p => !p)}
        presConfig={presConfig} onPresConfigChange={setPresConfig}
        onStartPresentation={startPresentation}
        dropdownRef={dropdownRef}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MessageBubble
// ═══════════════════════════════════════════════════════════

interface MessageBubbleProps {
  msg: ChatMessage;
  onSlideEdit: (index: number, data: Partial<SlideData>) => void;
  onSlideAIEdit: (index: number, instruction: string) => void;
  onThemeChange: (themeId: string) => void;
  onOpenInEditor?: (slides: SlideData[], themeId: string, topic: string) => void;
}

function MessageBubble({ msg, onSlideEdit, onSlideAIEdit, onThemeChange, onOpenInEditor }: MessageBubbleProps) {
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
        </div>

        {/* Slides */}
        {slideContent && (
          <div className="mt-3 space-y-3">
            {/* TOC */}
            {slideContent.toc.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-[#1a2744] bg-[#0c1628]/80 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MaterialIcon icon="list" size={16} className="text-[#d4af37]" />
                  <span className="text-xs font-bold text-[#d4af37]">فهرس المحتويات</span>
                  <span className="text-[9px] text-[#3a4f6f] mr-auto">{slideContent.slides.length} / {slideContent.toc.length} شريحة</span>
                </div>
                <div className="space-y-1.5">
                  {slideContent.toc.map((title, i) => {
                    const isDone = i < slideContent.slides.length;
                    const isCurrent = i === slideContent.slides.length && slideContent.status === "generating";
                    return (
                      <div key={i} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all", isDone ? "text-[#8899b8]" : isCurrent ? "text-[#d4af37] bg-[#d4af37]/5" : "text-[#3a4f6f]")}>
                        <div className={cn("w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0", isDone ? "bg-[#059669]/15 text-[#059669]" : isCurrent ? "bg-[#d4af37]/15 text-[#d4af37]" : "bg-[#1a2744]/60 text-[#3a4f6f]")}>
                          {isDone ? <MaterialIcon icon="check" size={12} /> : isCurrent ? <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" /> : i + 1}
                        </div>
                        <span className={cn(isDone && "line-through opacity-60")}>{title}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Theme selector + Open in Editor (when complete) */}
            {slideContent.status === "complete" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#4a5f7f]">الثيم:</span>
                {Object.keys(THEMES).map(t => (
                  <button key={t} onClick={() => onThemeChange(t)} className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all", slideContent.themeId === t ? "bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/20" : "text-[#4a5f7f] hover:text-[#8899b8] hover:bg-[#111d35]")}>
                    {THEMES[t]?.name || t}
                  </button>
                ))}
                {onOpenInEditor && (
                  <button
                    onClick={() => onOpenInEditor(slideContent.slides, slideContent.themeId, slideContent.topic)}
                    className="mr-auto px-3 py-1 rounded-lg text-[10px] font-medium bg-[#059669]/15 text-[#059669] hover:bg-[#059669]/25 transition-all flex items-center gap-1"
                  >
                    <MaterialIcon icon="open_in_new" size={12} />
                    فتح في المحرر
                  </button>
                )}
              </motion.div>
            )}

            {/* Slides */}
            {slideContent.slides.map((slide, i) => (
              <InlineSlide
                key={`slide-${i}`}
                slide={slide} index={i} total={slideContent.toc.length}
                themeId={slideContent.themeId}
                isNew={i === slideContent.slides.length - 1 && slideContent.status === "generating"}
                onEdit={onSlideEdit} onRequestAIEdit={onSlideAIEdit}
              />
            ))}

            {/* Generating indicator */}
            {slideContent.status === "generating" && slideContent.slides.length < slideContent.toc.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#d4af37]/10 bg-[#d4af37]/[0.03]">
                <div className="w-6 h-6 rounded-md bg-[#d4af37]/10 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
                </div>
                <span className="text-xs text-[#d4af37]/80">جاري إنشاء الشريحة {slideContent.slides.length + 1} من {slideContent.toc.length}...</span>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// InputBar — with presentation dropdown
// ═══════════════════════════════════════════════════════════

interface InputBarProps {
  input: string;
  isTyping: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  uiMode: "normal" | "advanced";
  onModeChange: (mode: "normal" | "advanced") => void;
  showPresDropdown: boolean;
  onTogglePresDropdown: () => void;
  presConfig: PresentationConfig;
  onPresConfigChange: (config: PresentationConfig | ((prev: PresentationConfig) => PresentationConfig)) => void;
  onStartPresentation: (config: PresentationConfig) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
}

function InputBar({
  input, isTyping, inputRef, onChange, onKeyDown, onSend,
  uiMode, onModeChange,
  showPresDropdown, onTogglePresDropdown,
  presConfig, onPresConfigChange,
  onStartPresentation, dropdownRef,
}: InputBarProps) {
  return (
    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-[#1a2744]/60 bg-[#0a1020]/80 backdrop-blur-sm relative">
      {/* ─── Presentation Dropdown ─── */}
      <AnimatePresence>
        {showPresDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full left-3 right-3 sm:left-auto sm:right-4 sm:w-[380px] mb-2 rounded-xl border border-[#1a2744] bg-[#0c1628]/98 backdrop-blur-xl shadow-2xl shadow-black/40 z-50 overflow-hidden"
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

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Topic */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">الموضوع</label>
                <input
                  value={presConfig.topic}
                  onChange={e => onPresConfigChange(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="مثال: الذكاء الاصطناعي في القطاع الحكومي"
                  className="w-full px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white placeholder:text-[#3a4f6f] focus:border-[#d4af37]/30 focus:outline-none transition-colors"
                />
              </div>

              {/* Theme */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">الهوية البصرية</label>
                <div className="flex flex-wrap gap-1.5">
                  {BRAND_THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => onPresConfigChange(prev => ({ ...prev, themeId: theme.id }))}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border",
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

              {/* Slide Count */}
              <div>
                <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">عدد الشرائح</label>
                <div className="flex gap-1.5">
                  {SLIDE_COUNTS.map(count => (
                    <button
                      key={count}
                      onClick={() => onPresConfigChange(prev => ({ ...prev, slideCount: count }))}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
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

              {/* ─── Advanced Options ─── */}
              {uiMode === "advanced" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3 pt-2 border-t border-[#1a2744]/40">
                  {/* Style */}
                  <div>
                    <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">نمط العرض</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESENTATION_STYLES.map(style => (
                        <button
                          key={style.id}
                          onClick={() => onPresConfigChange(prev => ({ ...prev, style: style.id }))}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] transition-all border",
                            presConfig.style === style.id
                              ? "border-[#d4af37]/30 bg-[#d4af37]/10 text-[#d4af37]"
                              : "border-[#1a2744] text-[#5a6f8f] hover:border-[#253550]"
                          )}
                        >
                          <MaterialIcon icon={style.icon} size={12} />
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Content Source */}
                  <div>
                    <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">مصدر المحتوى</label>
                    <div className="flex gap-1.5">
                      {[
                        { id: "ai" as const, label: "ذكاء اصطناعي", icon: "smart_toy" },
                        { id: "custom" as const, label: "لدي محتوى خاص", icon: "edit" },
                        { id: "mixed" as const, label: "مزيج", icon: "merge" },
                      ].map(src => (
                        <button
                          key={src.id}
                          onClick={() => onPresConfigChange(prev => ({ ...prev, contentSource: src.id }))}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] transition-all border",
                            presConfig.contentSource === src.id
                              ? "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]"
                              : "border-[#1a2744] text-[#5a6f8f] hover:border-[#253550]"
                          )}
                        >
                          <MaterialIcon icon={src.icon} size={12} />
                          {src.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Content */}
                  {presConfig.contentSource !== "ai" && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <label className="text-[10px] text-[#5a6f8f] mb-1 block font-medium">المحتوى الخاص</label>
                      <textarea
                        value={presConfig.customContent}
                        onChange={e => onPresConfigChange(prev => ({ ...prev, customContent: e.target.value }))}
                        placeholder="الصق المحتوى هنا أو اكتب ملاحظاتك..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white placeholder:text-[#3a4f6f] focus:border-[#3b82f6]/30 focus:outline-none resize-none transition-colors"
                      />
                    </motion.div>
                  )}

                  {/* Banana Pro Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MaterialIcon icon="auto_awesome" size={14} className="text-[#ec4899]" />
                      <span className="text-[10px] text-[#5a6f8f]">توليد صور بـ Banana Pro</span>
                    </div>
                    <button
                      onClick={() => onPresConfigChange(prev => ({ ...prev, useBananaPro: !prev.useBananaPro }))}
                      className={cn(
                        "w-9 h-5 rounded-full transition-all relative",
                        presConfig.useBananaPro ? "bg-[#ec4899]/30" : "bg-[#1a2744]"
                      )}
                    >
                      <div className={cn(
                        "w-3.5 h-3.5 rounded-full absolute top-[3px] transition-all",
                        presConfig.useBananaPro ? "right-[3px] bg-[#ec4899]" : "right-[calc(100%-3px-14px)] bg-[#4a5f7f]"
                      )} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Mode toggle */}
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => onModeChange(uiMode === "normal" ? "advanced" : "normal")}
                  className="text-[9px] text-[#4a5f7f] hover:text-[#d4af37] transition-colors flex items-center gap-1"
                >
                  <MaterialIcon icon={uiMode === "normal" ? "tune" : "remove_circle_outline"} size={12} />
                  {uiMode === "normal" ? "خيارات متقدمة" : "إخفاء الخيارات المتقدمة"}
                </button>
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
        <div className="relative flex items-end gap-1.5 sm:gap-2 bg-[#0d1628]/80 border border-[#1a2744] rounded-xl sm:rounded-2xl p-1.5 sm:p-2 backdrop-blur-sm hover:border-[#d4af37]/15 focus-within:border-[#d4af37]/30 transition-all">
          <button className="p-2 rounded-lg text-[#4a5f7f] hover:text-[#d4af37] hover:bg-[#0f1a30] transition-all shrink-0">
            <MaterialIcon icon="attach_file" size={18} />
          </button>

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

          <textarea
            ref={inputRef}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="اكتب رسالتك هنا..."
            rows={1}
            className="flex-1 px-2 py-2 bg-transparent text-xs sm:text-sm text-white placeholder:text-[#3a4f6f] focus:outline-none resize-none max-h-[120px] min-h-[40px]"
          />

          <button
            onClick={onSend}
            disabled={!input.trim() || isTyping}
            className="p-2.5 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#c49b2a] flex items-center justify-center text-[#0a0f1e] hover:shadow-lg hover:shadow-[#d4af37]/20 disabled:opacity-20 transition-all shrink-0"
          >
            <MaterialIcon icon="send" size={16} className="rotate-180" />
          </button>
        </div>
        <p className="text-[9px] sm:text-[10px] text-[#3a4f6f] text-center mt-1.5 sm:mt-2">
          راصد الذكي — مدعوم بالذكاء الاصطناعي من OpenAI
        </p>
      </div>
    </div>
  );
}
