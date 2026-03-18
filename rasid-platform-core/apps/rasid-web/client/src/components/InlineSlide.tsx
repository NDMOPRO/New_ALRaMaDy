/**
 * InlineSlide — Single slide rendered inline in chat
 * Shows: slide number + HTML preview + code toggle + inline edit
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
  onEdit: (index: number, data: Partial<SlideData>) => void;
  onRequestAIEdit: (index: number, instruction: string) => void;
}

export function InlineSlide({
  slide,
  index,
  total,
  themeId,
  isNew,
  onEdit,
  onRequestAIEdit,
}: InlineSlideProps) {
  const [showCode, setShowCode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(slide.title);
  const [editContent, setEditContent] = useState(slide.content || "");
  const [aiInstruction, setAiInstruction] = useState("");
  const [showAiInput, setShowAiInput] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  const handleSaveEdit = useCallback(() => {
    onEdit(index, {
      title: editTitle,
      content: editContent,
    });
    setIsEditing(false);
  }, [index, editTitle, editContent, onEdit]);

  const handleAiEdit = useCallback(() => {
    if (aiInstruction.trim()) {
      onRequestAIEdit(index, aiInstruction.trim());
      setAiInstruction("");
      setShowAiInput(false);
    }
  }, [index, aiInstruction, onRequestAIEdit]);

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
          <div className="w-6 h-6 rounded-md bg-[#d4af37]/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#d4af37]">{index + 1}</span>
          </div>
          <span className="text-xs text-[#8899b8] font-medium">{slide.title}</span>
          <span className="text-[9px] text-[#3a4f6f]">({slide.layout})</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover/slide:opacity-100 transition-opacity">
          <button
            onClick={() => setShowCode(!showCode)}
            className={cn(
              "p-1 rounded text-[10px] transition-all",
              showCode ? "bg-[#d4af37]/15 text-[#d4af37]" : "text-[#4a5f7f] hover:text-[#8899b8]"
            )}
            title="عرض الكود"
          >
            <MaterialIcon icon="code" size={14} />
          </button>
          <button
            onClick={() => { setIsEditing(!isEditing); setEditTitle(slide.title); setEditContent(slide.content || ""); }}
            className={cn(
              "p-1 rounded text-[10px] transition-all",
              isEditing ? "bg-[#3b82f6]/15 text-[#3b82f6]" : "text-[#4a5f7f] hover:text-[#8899b8]"
            )}
            title="تعديل مباشر"
          >
            <MaterialIcon icon="edit" size={14} />
          </button>
          <button
            onClick={() => setShowAiInput(!showAiInput)}
            className={cn(
              "p-1 rounded text-[10px] transition-all",
              showAiInput ? "bg-[#059669]/15 text-[#059669]" : "text-[#4a5f7f] hover:text-[#8899b8]"
            )}
            title="طلب تعديل من راصد"
          >
            <MaterialIcon icon="auto_fix_high" size={14} />
          </button>
        </div>
      </div>

      {/* ─── Slide Preview (iframe) ─── */}
      <div className="relative bg-white">
        <iframe
          ref={iframeRef}
          className="w-full border-0"
          style={{ height: "280px", pointerEvents: isEditing ? "none" : "auto" }}
          sandbox="allow-same-origin"
          title={`شريحة ${index + 1}`}
        />
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-medium backdrop-blur-sm">
          {index + 1} / {total}
        </div>
      </div>

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

      {/* ─── Inline Edit ─── */}
      {isEditing && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-[#1a2744]/60 p-3 space-y-2 bg-[#0a1020]/60"
        >
          <div>
            <label className="text-[10px] text-[#4a5f7f] mb-1 block">العنوان</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-sm text-white focus:border-[#d4af37]/30 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#4a5f7f] mb-1 block">المحتوى</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg bg-[#0d1628] border border-[#1a2744] text-sm text-white focus:border-[#d4af37]/30 focus:outline-none resize-none transition-colors"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 rounded-lg text-[10px] text-[#5a6f8f] hover:bg-[#111d35] transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1 rounded-lg text-[10px] bg-[#d4af37]/15 text-[#d4af37] hover:bg-[#d4af37]/25 transition-all"
            >
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
            <span className="text-[10px] text-[#059669] font-medium">اطلب من راصد الذكي تعديل هذه الشريحة</span>
          </div>
          <div className="flex gap-2">
            <input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAiEdit()}
              placeholder="مثال: غيّر الألوان إلى أزرق، أضف رسم بياني..."
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
    </motion.div>
  );
}
