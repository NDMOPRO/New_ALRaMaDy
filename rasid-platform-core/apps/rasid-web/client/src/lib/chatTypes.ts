/**
 * Chat Types — Shared types for RasidChat and related components
 */

import type { SlideData } from "./slideTemplates";

// ─── Rich Content Types ───
export interface SlideContent {
  kind: "slides";
  topic: string;
  toc: string[];
  slides: SlideData[];
  themeId: string;
  status: "generating" | "complete" | "error";
  currentIndex: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  intent?: string;
  isError?: boolean;
  isStreaming?: boolean;
  richContent?: SlideContent;
}

// ─── Welcome Actions ───
export const WELCOME_ACTIONS = [
  {
    id: "presentation",
    label: "عرض تقديمي",
    icon: "slideshow",
    color: "#d4af37",
    prompt: "أنشئ عرض تقديمي عن الذكاء الاصطناعي",
  },
  {
    id: "report",
    label: "تقرير",
    icon: "description",
    color: "#3b82f6",
    prompt: "أنشئ تقرير عن التحول الرقمي",
  },
  {
    id: "dashboard",
    label: "لوحة مؤشرات",
    icon: "dashboard",
    color: "#059669",
    prompt: "أنشئ لوحة مؤشرات أداء",
  },
  {
    id: "analysis",
    label: "تحليل بيانات",
    icon: "analytics",
    color: "#8b5cf6",
    prompt: "حلل بيانات المبيعات",
  },
  {
    id: "translate",
    label: "ترجمة",
    icon: "translate",
    color: "#ec4899",
    prompt: "ترجم النص التالي إلى الإنجليزية",
  },
  {
    id: "chat",
    label: "محادثة عامة",
    icon: "chat",
    color: "#f59e0b",
    prompt: "مرحباً راصد",
  },
];
