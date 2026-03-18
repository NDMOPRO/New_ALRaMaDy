/**
 * InlineSlide — Single slide rendered inline in chat
 * Features: visual preview, inline editing on the slide itself, AI edit, code toggle
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import MaterialIcon from "./MaterialIcon";
import { generateHtmlPresentation, type SlideData, THEMES } from "../lib/slideTemplates";
import { cn } from "../lib/utils";

interface InlineSlideProps {
  slide: SlideData;
  index: number;
  total: number;
  themeId: string;
  isNew?: boolean;
  isActive?: boolean;
  compact?: boolean;
  onEdit: (index: number, data: Partial<SlideData>) => void;
  onRequestAIEdit: (index: number, instruction: string) => void;
  onClick?: () => void;
}

export function InlineSlide({
  slide,
  index,
  total,
  themeId,
  isNew,
  isActive,
  compact,
  onEdit,
  onRequestAIEdit,
  onClick,
}: InlineSlideProps) {
  const [showCode, setShowCode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(slide.title);
  const [editSubtitle, setEditSubtitle] = useState(slide.subtitle || "");
  const [editContent, setEditContent] = useState(slide.content || "");
  const [editBullets, setEditBullets] = useState((slide.bulletPoints || []).join("\n"));
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiInput, setShowAiInput] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [slideScale, setSlideScale] = useState(0.5);

  // Calculate scale based on container width
  useEffect(() => {
    if (compact || !containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setSlideScale(w / 1280);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [compact]);

  // Generate HTML for this single slide
  const slideHtmlArr = generateHtmlPresentation([slide], themeId);
  const slideHtml = slideHtmlArr[0] || "";

  // Update iframe content
  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(slideHtml);
        doc.close();
      }
    }
  }, [slideHtml]);

  // Sync edit fields when slide changes
  useEffect(() => {
    setEditTitle(slide.title);
    setEditSubtitle(slide.subtitle || "");
    setEditContent(slide.content || "");
    setEditBullets((slide.bulletPoints || []).join("\n"));
  }, [slide]);

  const handleSaveEdit = useCallback(() => {
    const bullets = editBullets.split("\n").filter(b => b.trim());
    onEdit(index, {
      title: editTitle,
      subtitle: editSubtitle || undefined,
      content: editContent || undefined,
      bulletPoints: bullets.length > 0 ? bullets : undefined,
    });
    setIsEditing(false);
  }, [index, editTitle, editSubtitle, editContent, editBullets, onEdit]);

  const handleAiEdit = useCallback(() => {
    if (aiInstruction.trim()) {
      onRequestAIEdit(index, aiInstruction.trim());
      setAiInstruction("");
      setShowAiInput(false);
    }
  }, [index, aiInstruction, onRequestAIEdit]);

  // Compact mode — thumbnail only
  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "relative rounded-lg overflow-hidden cursor-pointer transition-all border-2 group/thumb",
          isActive
            ? "border-[#d4af37] shadow-lg shadow-[#d4af37]/20"
            : "border-[#1a2744] hover:border-[#d4af37]/40"
        )}
        style={{ width: 120, height: 68 }}
      >
        <iframe
          ref={compact ? undefined : iframeRef}
          srcDoc={slideHtml}
          className="w-[1280px] h-[720px] border-0 pointer-events-none"
          style={{ transform: "scale(0.09375)", transformOrigin: "top right", direction: "rtl" }}
          sandbox="allow-same-origin"
          title={`مصغرة ${index + 1}`}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
          <span className="text-[8px] text-white font-bold">P{index + 1}</span>
        </div>
        {isActive && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#d4af37]" />
        )}
      </div>
    );
  }

  // Full mode — main slide view
  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 20, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-xl border border-[#1a2744] bg-[#0c1628]/80 overflow-hidden group/slide"
    >
      {/* ─── Slide Header ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2744]/60 bg-[#0a1020]/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#d4af37]/10 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#d4af37]">P{index + 1}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#8899b8] font-medium leading-tight">{slide.title}</span>
            <span className="text-[9px] text-[#3a4f6f]">{slide.layout}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCode(!showCode)}
            className={cn(
              "p-1.5 rounded-lg text-[10px] transition-all",
              showCode ? "bg-[#d4af37]/15 text-[#d4af37]" : "text-[#4a5f7f] hover:text-[#8899b8] hover:bg-[#111d35]"
            )}
            title="عرض الكود"
          >
            <MaterialIcon icon="code" size={14} />
          </button>
          <button
            onClick={() => { setIsEditing(!isEditing); }}
            className={cn(
              "p-1.5 rounded-lg text-[10px] transition-all",
              isEditing ? "bg-[#3b82f6]/15 text-[#3b82f6]" : "text-[#4a5f7f] hover:text-[#8899b8] hover:bg-[#111d35]"
            )}
            title="تعديل الشريحة"
          >
            <MaterialIcon icon="edit" size={14} />
          </button>
          <button
            onClick={() => setShowAiInput(!showAiInput)}
            className={cn(
              "p-1.5 rounded-lg text-[10px] transition-all",
              showAiInput ? "bg-[#059669]/15 text-[#059669]" : "text-[#4a5f7f] hover:text-[#8899b8] hover:bg-[#111d35]"
            )}
            title="تعديل بالذكاء الاصطناعي"
          >
            <MaterialIcon icon="auto_fix_high" size={14} />
          </button>
        </div>
      </div>

      {/* ─── Slide Preview (iframe with proper scaling) ─── */}
      <div ref={containerRef} className="relative bg-white overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        <iframe
          ref={iframeRef}
          className="absolute top-0 right-0 border-0"
          sandbox="allow-same-origin"
          title={`شريحة ${index + 1}`}
          style={{
            width: '1280px',
            height: '720px',
            transform: `scale(${slideScale})`,
            transformOrigin: 'top right',
            pointerEvents: isEditing ? 'none' : 'auto',
          }}
        />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-medium backdrop-blur-sm z-10">
          P{index + 1} / {total}
        </div>
      </div>

      {/* ─── Inline Edit Panel ─── */}
      {isEditing && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-[#1a2744]/60 p-3 space-y-2.5 bg-[#0a1020]/60"
        >
          <div className="flex items-center gap-2 mb-1">
            <MaterialIcon icon="edit_note" size={16} className="text-[#3b82f6]" />
            <span className="text-[11px] text-[#3b82f6] font-bold">تعديل محتوى الشريحة</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-[#4a5f7f] mb-0.5 block">العنوان</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white focus:border-[#3b82f6]/40 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-[#4a5f7f] mb-0.5 block">العنوان الفرعي</label>
              <input
                value={editSubtitle}
                onChange={(e) => setEditSubtitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white focus:border-[#3b82f6]/40 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {(slide.layout === "content" || slide.layout === "executive-summary" || slide.layout === "two-column" || slide.layout === "quote") && (
            <div>
              <label className="text-[10px] text-[#4a5f7f] mb-0.5 block">المحتوى</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white focus:border-[#3b82f6]/40 focus:outline-none resize-none transition-colors"
              />
            </div>
          )}

          {slide.bulletPoints && slide.bulletPoints.length > 0 && (
            <div>
              <label className="text-[10px] text-[#4a5f7f] mb-0.5 block">النقاط (سطر لكل نقطة)</label>
              <textarea
                value={editBullets}
                onChange={(e) => setEditBullets(e.target.value)}
                rows={3}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white focus:border-[#3b82f6]/40 focus:outline-none resize-none transition-colors font-mono"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded-lg text-[10px] text-[#5a6f8f] hover:bg-[#111d35] transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-1.5 rounded-lg text-[10px] font-bold bg-[#3b82f6]/15 text-[#3b82f6] hover:bg-[#3b82f6]/25 transition-all flex items-center gap-1"
            >
              <MaterialIcon icon="check" size={12} />
              حفظ التعديل
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── AI Edit Request ─── */}
      {showAiInput && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-[#1a2744]/60 p-3 bg-[#0a1020]/60"
        >
          <div className="flex items-center gap-2 mb-2">
            <MaterialIcon icon="auto_fix_high" size={14} className="text-[#059669]" />
            <span className="text-[10px] text-[#059669] font-medium">اطلب من راصد تعديل هذه الشريحة</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiEdit()}
              placeholder="مثال: أضف رسم بياني، غيّر العنوان، أضف بيانات..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-xs text-white placeholder:text-[#3a4f6f] focus:border-[#059669]/30 focus:outline-none transition-colors"
            />
            <button
              onClick={handleAiEdit}
              disabled={!aiInstruction.trim()}
              className="px-3 py-1.5 rounded-lg bg-[#059669]/15 text-[#059669] text-[10px] font-medium hover:bg-[#059669]/25 disabled:opacity-30 transition-all"
            >
              تنفيذ
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Code View (toggle) ─── */}
      {showCode && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-[#1a2744]/60"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a1020]/80">
            <span className="text-[9px] text-[#4a5f7f] font-mono">HTML</span>
            <button
              onClick={() => navigator.clipboard.writeText(slideHtml)}
              className="text-[9px] text-[#4a5f7f] hover:text-[#d4af37] transition-colors flex items-center gap-1"
            >
              <MaterialIcon icon="content_copy" size={12} />
              نسخ
            </button>
          </div>
          <pre className="p-3 text-[10px] text-[#6a7f9f] font-mono leading-relaxed overflow-x-auto max-h-[200px] custom-scrollbar bg-[#060c1a]">
            {slideHtml.slice(0, 2000)}{slideHtml.length > 2000 ? "\n..." : ""}
          </pre>
        </motion.div>
      )}
    </motion.div>
  );
}
