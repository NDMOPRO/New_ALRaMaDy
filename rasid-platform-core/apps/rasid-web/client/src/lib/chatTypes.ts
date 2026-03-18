/**
 * Chat Types — Shared types for RasidChat and related components
 */

import type { SlideData } from "./slideTemplates";

// ─── TOC Item (with description for Slides Outline) ───
export interface TOCItem {
  index: number;
  title: string;
  layout: string;
  description: string;
}

// ─── Rich Content Types ───
export interface SlideContent {
  kind: "slides";
  topic: string;
  toc: TOCItem[];           // Full TOC items with descriptions
  slides: SlideData[];
  themeId: string;
  status: "outline" | "generating" | "complete" | "error";
  currentIndex: number;
  presentationId?: number;  // DB id for saving
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

// ─── Welcome Actions (reduced) ───
export const WELCOME_ACTIONS = [
  {
    id: "presentation",
    label: "عرض تقديمي",
    icon: "slideshow",
    color: "#d4af37",
    prompt: "أنشئ عرض تقديمي",
  },
  {
    id: "report",
    label: "تقرير",
    icon: "description",
    color: "#3b82f6",
    prompt: "أنشئ تقرير",
  },
  {
    id: "dashboard",
    label: "لوحة مؤشرات",
    icon: "dashboard",
    color: "#059669",
    prompt: "أنشئ لوحة مؤشرات",
  },
  {
    id: "chat",
    label: "محادثة",
    icon: "chat",
    color: "#f59e0b",
    prompt: "مرحباً راصد",
  },
];
