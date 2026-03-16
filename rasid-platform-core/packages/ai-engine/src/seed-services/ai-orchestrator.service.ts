/**
 * AI Orchestrator Service — Adapted from Seed
 *
 * Orchestrates AI operations: prompt management, model routing,
 * response processing, and Arabic NLP capabilities.
 *
 * Adapted: PrismaClient → prismaAdapter (sql.js), Express → tRPC
 * Uses @rasid/contracts types
 */

import { randomUUID, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const LOG = "[AIOrchestrator]";
const log = {
  info: (msg: string, m?: any) => console.log(`${LOG} ${msg}`, m || ""),
  warn: (msg: string, m?: any) => console.warn(`${LOG} ${msg}`, m || ""),
  error: (msg: string, m?: any) => console.error(`${LOG} ${msg}`, m || ""),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AIModelProvider = "openai" | "anthropic" | "google" | "local";
export type AITaskType = "chat" | "completion" | "embedding" | "classification" | "extraction" | "translation" | "summarization" | "analysis";

export interface AIRequest {
  taskType: AITaskType;
  prompt: string;
  systemPrompt?: string;
  model?: string;
  provider?: AIModelProvider;
  temperature?: number;
  maxTokens?: number;
  context?: AIContext;
  options?: AIRequestOptions;
}

export interface AIContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
  documents?: DocumentContext[];
  language?: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface DocumentContext {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
}

export interface AIRequestOptions {
  stream?: boolean;
  cacheKey?: string;
  timeout?: number;
  retries?: number;
  validateOutput?: boolean;
  outputFormat?: "text" | "json" | "markdown";
}

export interface AIResponse {
  id: string;
  taskType: AITaskType;
  content: string;
  model: string;
  provider: AIModelProvider;
  usage: TokenUsage;
  metadata: AIResponseMetadata;
  cached: boolean;
  duration: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface AIResponseMetadata {
  finishReason: "stop" | "length" | "content_filter" | "error";
  language: string;
  confidence: number;
  sources: string[];
}

export interface PromptTemplate {
  id: string;
  name: string;
  taskType: AITaskType;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  language: string;
  version: number;
}

export interface ModelConfig {
  provider: AIModelProvider;
  model: string;
  maxTokens: number;
  temperature: number;
  costPer1kTokens: number;
  capabilities: AITaskType[];
  languages: string[];
  priority: number;
}

export interface ArabicNLPResult {
  language: "ar" | "en" | "mixed";
  dialect?: "msa" | "gulf" | "egyptian" | "levantine" | "maghreb";
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  entities: NamedEntity[];
  keywords: string[];
  summary?: string;
  topics: string[];
}

export interface NamedEntity {
  text: string;
  type: "person" | "organization" | "location" | "date" | "money" | "percentage" | "product";
  start: number;
  end: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

const promptTemplateStore = new Map<string, PromptTemplate>();
const responseCache = new Map<string, { response: AIResponse; expiresAt: number }>();

// Default model configs
const MODEL_CONFIGS: ModelConfig[] = [
  {
    provider: "openai",
    model: "gpt-4.1-mini",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kTokens: 0.01,
    capabilities: ["chat", "completion", "classification", "extraction", "translation", "summarization", "analysis"],
    languages: ["ar", "en"],
    priority: 1,
  },
  {
    provider: "openai",
    model: "gpt-4.1-nano",
    maxTokens: 4096,
    temperature: 0.5,
    costPer1kTokens: 0.002,
    capabilities: ["chat", "completion", "classification", "translation"],
    languages: ["ar", "en"],
    priority: 2,
  },
  {
    provider: "google",
    model: "gemini-2.5-flash",
    maxTokens: 8192,
    temperature: 0.7,
    costPer1kTokens: 0.005,
    capabilities: ["chat", "completion", "classification", "extraction", "translation", "summarization", "analysis"],
    languages: ["ar", "en"],
    priority: 3,
  },
];

// Default Arabic prompt templates
const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: "arabic-summarize",
    name: "تلخيص نص عربي",
    taskType: "summarization",
    systemPrompt: "أنت مساعد متخصص في تلخيص النصوص العربية. قم بتلخيص النص التالي بشكل موجز ودقيق مع الحفاظ على المعنى الأساسي.",
    userPromptTemplate: "قم بتلخيص النص التالي:\n\n{{text}}\n\nالتلخيص:",
    variables: ["text"],
    language: "ar",
    version: 1,
  },
  {
    id: "arabic-classify",
    name: "تصنيف مستند عربي",
    taskType: "classification",
    systemPrompt: "أنت مساعد متخصص في تصنيف المستندات العربية. صنف المستند إلى إحدى الفئات المحددة.",
    userPromptTemplate: "صنف المستند التالي إلى إحدى الفئات: {{categories}}\n\nالمستند:\n{{document}}\n\nالتصنيف:",
    variables: ["categories", "document"],
    language: "ar",
    version: 1,
  },
  {
    id: "arabic-extract",
    name: "استخراج بيانات من نص عربي",
    taskType: "extraction",
    systemPrompt: "أنت مساعد متخصص في استخراج البيانات المنظمة من النصوص العربية. استخرج المعلومات المطلوبة بدقة.",
    userPromptTemplate: "استخرج المعلومات التالية من النص: {{fields}}\n\nالنص:\n{{text}}\n\nالنتيجة بصيغة JSON:",
    variables: ["fields", "text"],
    language: "ar",
    version: 1,
  },
  {
    id: "arabic-analyze",
    name: "تحليل بيانات عربية",
    taskType: "analysis",
    systemPrompt: "أنت محلل بيانات متخصص. قم بتحليل البيانات المقدمة وتقديم رؤى واضحة باللغة العربية.",
    userPromptTemplate: "حلل البيانات التالية وقدم رؤى وتوصيات:\n\n{{data}}\n\nالتحليل:",
    variables: ["data"],
    language: "ar",
    version: 1,
  },
];

for (const t of DEFAULT_TEMPLATES) promptTemplateStore.set(t.id, t);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AIOrchestatorService {
  private db: any;

  constructor(dbAdapter?: any) {
    this.db = dbAdapter;
  }

  /**
   * Execute an AI request.
   */
  async execute(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const requestId = randomUUID();

    // Check cache
    if (request.options?.cacheKey) {
      const cached = responseCache.get(request.options.cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.response, cached: true, duration: Date.now() - startTime };
      }
    }

    // Select model
    const modelConfig = this.selectModel(request);

    // Build messages
    const messages = this.buildMessages(request);

    // Call AI
    let content: string;
    let usage: TokenUsage;

    try {
      const result = await this.callModel(modelConfig, messages, request);
      content = result.content;
      usage = result.usage;
    } catch (error) {
      log.error(`AI request failed: ${error}`);
      throw error;
    }

    // Detect language
    const language = this.detectLanguage(content);

    const response: AIResponse = {
      id: requestId,
      taskType: request.taskType,
      content,
      model: modelConfig.model,
      provider: modelConfig.provider,
      usage,
      metadata: {
        finishReason: "stop",
        language,
        confidence: 0.9,
        sources: [],
      },
      cached: false,
      duration: Date.now() - startTime,
    };

    // Cache response
    if (request.options?.cacheKey) {
      responseCache.set(request.options.cacheKey, {
        response,
        expiresAt: Date.now() + 3600000, // 1 hour
      });
    }

    // Log to DB
    if (this.db?.aiLog) {
      await this.db.aiLog.create({
        data: {
          requestId,
          taskType: request.taskType,
          model: modelConfig.model,
          provider: modelConfig.provider,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          cost: usage.estimatedCost,
          duration: response.duration,
          userId: request.context?.userId,
          tenantId: request.context?.tenantId,
        },
      });
    }

    log.info(`AI request completed`, {
      id: requestId,
      model: modelConfig.model,
      tokens: usage.totalTokens,
      duration: response.duration,
    });

    return response;
  }

  /**
   * Render a prompt template with variables.
   */
  renderPromptTemplate(templateId: string, variables: Record<string, string>): { systemPrompt: string; userPrompt: string } {
    const template = promptTemplateStore.get(templateId);
    if (!template) throw new Error(`Prompt template ${templateId} not found`);

    let userPrompt = template.userPromptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    return { systemPrompt: template.systemPrompt, userPrompt };
  }

  /**
   * Analyze Arabic text (NLP).
   */
  async analyzeArabicText(text: string): Promise<ArabicNLPResult> {
    const isArabic = /[\u0600-\u06FF]/.test(text);
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, "").length;
    const arabicPct = totalChars > 0 ? arabicChars / totalChars : 0;

    const language: "ar" | "en" | "mixed" = arabicPct > 0.7 ? "ar" : arabicPct > 0.2 ? "mixed" : "en";

    // Simple sentiment analysis
    const positiveWords = ["ممتاز", "جيد", "رائع", "نجاح", "تحسن", "إيجابي", "مبدع", "متميز"];
    const negativeWords = ["سيء", "فشل", "مشكلة", "خطأ", "سلبي", "ضعيف", "تراجع", "خسارة"];

    let sentimentScore = 0;
    for (const word of positiveWords) {
      if (text.includes(word)) sentimentScore += 0.1;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) sentimentScore -= 0.1;
    }
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore));

    // Entity extraction
    const entities = this.extractEntities(text);

    // Keyword extraction
    const keywords = this.extractKeywords(text);

    // Topic detection
    const topics = this.detectTopics(text);

    return {
      language,
      dialect: language === "ar" ? "msa" : undefined,
      sentiment: sentimentScore > 0.1 ? "positive" : sentimentScore < -0.1 ? "negative" : "neutral",
      sentimentScore,
      entities,
      keywords,
      topics,
    };
  }

  /**
   * List available prompt templates.
   */
  listPromptTemplates(taskType?: AITaskType): PromptTemplate[] {
    return Array.from(promptTemplateStore.values())
      .filter((t) => !taskType || t.taskType === taskType);
  }

  /**
   * Create a new prompt template.
   */
  createPromptTemplate(template: Omit<PromptTemplate, "id" | "version">): PromptTemplate {
    const full: PromptTemplate = { ...template, id: randomUUID(), version: 1 };
    promptTemplateStore.set(full.id, full);
    return full;
  }

  /**
   * Get model configurations.
   */
  getModelConfigs(): ModelConfig[] {
    return MODEL_CONFIGS;
  }

  // ─── Private methods ────────────────────────────────────────

  private selectModel(request: AIRequest): ModelConfig {
    if (request.model && request.provider) {
      const config = MODEL_CONFIGS.find((m) => m.model === request.model && m.provider === request.provider);
      if (config) return config;
    }

    // Auto-select based on task type and language
    const language = request.context?.language || this.detectLanguage(request.prompt);
    const candidates = MODEL_CONFIGS
      .filter((m) => m.capabilities.includes(request.taskType))
      .filter((m) => m.languages.includes(language === "ar" ? "ar" : "en"))
      .sort((a, b) => a.priority - b.priority);

    return candidates[0] || MODEL_CONFIGS[0];
  }

  private buildMessages(request: AIRequest): ConversationMessage[] {
    const messages: ConversationMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt, timestamp: new Date().toISOString() });
    }

    if (request.context?.conversationHistory) {
      messages.push(...request.context.conversationHistory);
    }

    // Add document context
    if (request.context?.documents && request.context.documents.length > 0) {
      const docContext = request.context.documents
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5)
        .map((d) => `[${d.title}]: ${d.content}`)
        .join("\n\n");

      messages.push({
        role: "system",
        content: `Context documents:\n${docContext}`,
        timestamp: new Date().toISOString(),
      });
    }

    messages.push({ role: "user", content: request.prompt, timestamp: new Date().toISOString() });

    return messages;
  }

  private async callModel(
    config: ModelConfig,
    messages: ConversationMessage[],
    request: AIRequest
  ): Promise<{ content: string; usage: TokenUsage }> {
    try {
      const { OpenAI } = await import("openai");
      const client = new OpenAI();

      const response = await client.chat.completions.create({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: request.temperature ?? config.temperature,
        max_tokens: request.maxTokens ?? config.maxTokens,
      });

      const content = response.choices[0]?.message?.content || "";
      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        estimatedCost: ((response.usage?.total_tokens || 0) / 1000) * config.costPer1kTokens,
      };

      return { content, usage };
    } catch (error) {
      log.error(`Model call failed: ${error}`);
      // Fallback response
      return {
        content: `[AI response unavailable - ${config.model}]`,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
      };
    }
  }

  private detectLanguage(text: string): string {
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, "").length;
    return totalChars > 0 && arabicChars / totalChars > 0.3 ? "ar" : "en";
  }

  private extractEntities(text: string): NamedEntity[] {
    const entities: NamedEntity[] = [];

    // Date patterns
    const dateRegex = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/g;
    let match;
    while ((match = dateRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: "date", start: match.index, end: match.index + match[0].length, confidence: 0.9 });
    }

    // Money patterns
    const moneyRegex = /[\d,]+\.?\d*\s*(ريال|دولار|جنيه|يورو|SAR|USD|EUR)/g;
    while ((match = moneyRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: "money", start: match.index, end: match.index + match[0].length, confidence: 0.85 });
    }

    // Percentage patterns
    const pctRegex = /\d+\.?\d*\s*%/g;
    while ((match = pctRegex.exec(text)) !== null) {
      entities.push({ text: match[0], type: "percentage", start: match.index, end: match.index + match[0].length, confidence: 0.95 });
    }

    return entities;
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: split, filter stop words, count frequency
    const stopWords = new Set(["في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "هو", "هي", "أن", "كان", "لا", "لم", "قد", "ما", "و", "أو"]);
    const words = text.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
  }

  private detectTopics(text: string): string[] {
    const topicKeywords: Record<string, string[]> = {
      "مالي": ["ميزانية", "إيرادات", "مصروفات", "ربح", "خسارة", "استثمار", "تمويل"],
      "تقني": ["برمجة", "نظام", "تطبيق", "بيانات", "خوارزمية", "ذكاء", "اصطناعي"],
      "إداري": ["إدارة", "موظف", "أداء", "تقييم", "تخطيط", "استراتيجية"],
      "قانوني": ["قانون", "نظام", "لائحة", "عقد", "اتفاقية", "حقوق"],
      "صحي": ["صحة", "مريض", "علاج", "طبي", "مستشفى", "دواء"],
    };

    const topics: string[] = [];
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((k) => text.includes(k))) topics.push(topic);
    }
    return topics.length > 0 ? topics : ["عام"];
  }
}

export default AIOrchestatorService;
