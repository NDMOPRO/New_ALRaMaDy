/**
 * useAI - Shared React hook for AI capabilities across all engines
 * Connects to the backend tRPC AI router
 */
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────
export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIStatus {
  available: boolean;
  source: "openai" | "forge" | "none";
}

// ─── AI Status Hook ──────────────────────────────────────────────
export function useAIStatus() {
  const { data, isLoading, error } = trpc.ai.status.useQuery(undefined, {
    staleTime: 30000,
    retry: 1,
  });

  return {
    status: data || { available: false, source: "none" as const },
    isLoading,
    error,
  };
}

// ─── Chat Hook (راصد الذكي) ──────────────────────────────────────
export function useAIChat() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
      setIsStreaming(false);
    },
    onError: () => {
      setIsStreaming(false);
    },
  });

  const sendMessage = useCallback(
    (content: string, context?: string) => {
      const newMessages = [...messages, { role: "user" as const, content }];
      setMessages(newMessages);
      setIsStreaming(true);

      chatMutation.mutate({
        messages: newMessages,
        context,
      });
    },
    [messages, chatMutation]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isStreaming,
    error: chatMutation.error,
    source: chatMutation.data?.source,
  };
}

// ─── Slides Generation Hook ─────────────────────────────────────
export function useAISlides() {
  const mutation = trpc.ai.generateSlides.useMutation();

  const generateSlides = useCallback(
    (prompt: string, slideCount?: number, style?: string) => {
      return mutation.mutateAsync({ prompt, slideCount, style });
    },
    [mutation]
  );

  return {
    generateSlides,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── Report Generation Hook ─────────────────────────────────────
export function useAIReport() {
  const mutation = trpc.ai.generateReport.useMutation();

  const generateReport = useCallback(
    (prompt: string, reportType?: string) => {
      return mutation.mutateAsync({ prompt, reportType });
    },
    [mutation]
  );

  return {
    generateReport,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── Dashboard Analysis Hook ────────────────────────────────────
export function useAIDashboard() {
  const mutation = trpc.ai.analyzeDashboard.useMutation();

  const analyzeDashboard = useCallback(
    (prompt: string, currentWidgets?: string) => {
      return mutation.mutateAsync({ prompt, currentWidgets });
    },
    [mutation]
  );

  return {
    analyzeDashboard,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── Data Analysis Hook ─────────────────────────────────────────
export function useAIAnalyze() {
  const mutation = trpc.ai.analyzeData.useMutation();

  const analyzeData = useCallback(
    (prompt: string, data?: string, columns?: string[]) => {
      return mutation.mutateAsync({ prompt, data, columns });
    },
    [mutation]
  );

  return {
    analyzeData,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── CDR Matching Hook ──────────────────────────────────────────
export function useAIMatch() {
  const mutation = trpc.ai.matchSuggest.useMutation();

  const matchSuggest = useCallback(
    (prompt: string, sourceData?: string, targetData?: string) => {
      return mutation.mutateAsync({ prompt, sourceData, targetData });
    },
    [mutation]
  );

  return {
    matchSuggest,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── Translation Hook ───────────────────────────────────────────
export function useAITranslate() {
  const mutation = trpc.ai.translate.useMutation();

  const translate = useCallback(
    (text: string, from?: string, to?: string) => {
      return mutation.mutateAsync({ text, from, to });
    },
    [mutation]
  );

  return {
    translate,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

// ─── Summarize Hook ─────────────────────────────────────────────
export function useAISummarize() {
  const mutation = trpc.ai.summarize.useMutation();

  const summarize = useCallback(
    (text: string, maxLength?: number) => {
      return mutation.mutateAsync({ text, maxLength });
    },
    [mutation]
  );

  return {
    summarize,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}
