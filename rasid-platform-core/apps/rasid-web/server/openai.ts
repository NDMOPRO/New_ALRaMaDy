/**
 * OpenAI Service Layer for Rasid Data Platform
 * Provides AI capabilities using the user's OpenAI API key
 * Falls back to built-in Forge LLM if no OpenAI key is configured
 */
import { ENV } from "./_core/env";
import { invokeLLM, type Message, type InvokeResult } from "./_core/llm";

const OPENAI_BASE = "https://api.openai.com/v1";

// ─── Types ───────────────────────────────────────────────────────
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  source: "openai" | "forge";
}

// ─── OpenAI Direct Call ──────────────────────────────────────────
async function callOpenAI(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string; json_schema?: any };
  }
): Promise<AIResponse> {
  const apiKey = ENV.openaiApiKey;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const payload: Record<string, unknown> = {
    model: options?.model || "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.max_tokens ?? 4096,
  };

  if (options?.response_format) {
    payload.response_format = options.response_format;
  }

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} – ${errorText}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: data.usage,
    model: data.model,
    source: "openai",
  };
}

// ─── Forge Fallback Call ─────────────────────────────────────────
async function callForge(
  messages: ChatMessage[],
  options?: {
    response_format?: { type: string; json_schema?: any };
  }
): Promise<AIResponse> {
  const forgeMessages: Message[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const invokeParams: any = { messages: forgeMessages };
  if (options?.response_format) {
    invokeParams.response_format = options.response_format;
  }

  const result: InvokeResult = await invokeLLM(invokeParams);

  const content = result.choices?.[0]?.message?.content;
  const textContent = typeof content === "string" ? content : 
    Array.isArray(content) ? content.map(c => 'text' in c ? c.text : '').join('') : "";

  return {
    content: textContent,
    usage: result.usage,
    model: result.model,
    source: "forge",
  };
}

// ─── Vision API Call (for OCR / Image Analysis) ────────────────
export interface VisionMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }>;
}

export async function callVision(
  messages: VisionMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }
): Promise<AIResponse> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for Vision");
  }

  const payload = {
    model: options?.model || "gpt-4o-mini",
    messages,
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.max_tokens ?? 4096,
  };

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Vision API error: ${response.status} – ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    usage: data.usage,
    model: data.model,
    source: "openai",
  };
}

// ─── Unified AI Call ─────────────────────────────────────────────
export async function callAI(
  messages: ChatMessage[],
  options?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string; json_schema?: any };
  }
): Promise<AIResponse> {
  // Prefer OpenAI if key is configured
  if (ENV.openaiApiKey) {
    return callOpenAI(messages, options);
  }
  // Fallback to built-in Forge LLM
  return callForge(messages, options ? { response_format: options.response_format } : undefined);
}

// ─── Check if AI is available ────────────────────────────────────
export function isAIAvailable(): { available: boolean; source: "openai" | "forge" | "none" } {
  if (ENV.openaiApiKey) {
    return { available: true, source: "openai" };
  }
  if (ENV.forgeApiKey) {
    return { available: true, source: "forge" };
  }
  return { available: false, source: "none" };
}

// ─── System Prompts ──────────────────────────────────────────────
export const SYSTEM_PROMPTS = {
  chat: `أنت "راصد الذكي"، مساعد ذكي متخصص في إدارة البيانات الوطنية السعودية. تتحدث باللغة العربية الفصحى بأسلوب مهني ودقيق.
مهامك الرئيسية:
- تحليل البيانات وتقديم رؤى ذكية
- المساعدة في إنشاء التقارير ولوحات المؤشرات
- الإجابة على الأسئلة المتعلقة بحوكمة البيانات ونضجها
- تقديم توصيات لتحسين جودة البيانات
- المساعدة في مطابقة البيانات وتنظيفها
أجب دائماً باللغة العربية بشكل مختصر ومفيد.`,

  slides: `أنت مساعد متخصص في إنشاء العروض التقديمية باللغة العربية. عند الطلب، أنشئ محتوى شرائح بتنسيق JSON.
كل شريحة يجب أن تحتوي على:
- title: عنوان الشريحة
- subtitle: عنوان فرعي (اختياري)
- content: محتوى نصي
- notes: ملاحظات المتحدث
- layout: نوع التخطيط (title, content, two-column, image, chart, quote)
أجب بتنسيق JSON فقط.`,

  report: `أنت مساعد متخصص في إنشاء التقارير الرسمية باللغة العربية. عند الطلب، أنشئ أقسام تقرير بتنسيق JSON.
كل قسم يجب أن يحتوي على:
- type: نوع القسم (cover, heading, paragraph, kpi, chart, table, recommendation, quote, divider)
- content: المحتوى المناسب لنوع القسم
أنشئ محتوى مهني ودقيق مناسب للتقارير الحكومية السعودية.
أجب بتنسيق JSON فقط.`,

  dashboard: `أنت مساعد متخصص في تصميم لوحات المؤشرات (Dashboards) باللغة العربية. عند الطلب، اقترح ودجات ومؤشرات بتنسيق JSON.
أنواع الودجات المتاحة:
- kpi: بطاقة مؤشر أداء رئيسي
- bar: رسم بياني شريطي
- line: رسم بياني خطي
- pie: رسم بياني دائري
- radar: رسم بياني رادار
- table: جدول بيانات
- progress: شريط تقدم
- area: رسم بياني مساحي
أجب بتنسيق JSON فقط.`,

  analyze: `أنت محلل بيانات متخصص. قم بتحليل البيانات المقدمة وقدم:
1. ملخص إحصائي
2. أنماط ورؤى رئيسية
3. توصيات قابلة للتنفيذ
4. تحذيرات بشأن جودة البيانات
أجب باللغة العربية بشكل مهني ودقيق.`,

  match: `أنت متخصص في مطابقة البيانات الحرفية (CDR). ساعد في:
1. تحديد أفضل استراتيجية للمطابقة
2. اقتراح قواعد التنظيف والتطبيع
3. تقييم نتائج المطابقة
4. تحسين دقة المطابقة
أجب باللغة العربية.`,

  translate: `أنت مترجم محترف متخصص في المصطلحات التقنية والحكومية. قم بالترجمة مع الحفاظ على:
1. الدقة في المصطلحات التقنية
2. السياق المهني المناسب
3. الأسلوب الرسمي
أجب باللغة العربية.`,

  summarize: `أنت متخصص في تلخيص المستندات والتقارير. قدم ملخصاً يتضمن:
1. النقاط الرئيسية
2. الأرقام والإحصائيات المهمة
3. التوصيات الرئيسية
أجب باللغة العربية بشكل مختصر ومركز.`,
};

// ═══════════════════════════════════════════════════════════
// Direct OpenAI helpers — used by AI router & Presentations router
// ═══════════════════════════════════════════════════════════

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAIChatOptions {
  messages: OpenAIMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: "json_object" | "text";
  };
}

export interface OpenAIChatResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenAI Chat Completions API directly (low-level)
 */
export async function openaiChat(
  options: OpenAIChatOptions
): Promise<OpenAIChatResponse> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const {
    messages,
    model = "gpt-4o-mini",
    temperature = 0.7,
    max_tokens = 4096,
    response_format,
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
  };

  if (response_format) {
    body.response_format = response_format;
  }

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  return (await response.json()) as OpenAIChatResponse;
}

/**
 * Simple helper: get a text response from OpenAI
 */
export async function openaiText(
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<OpenAIChatOptions>
): Promise<string> {
  const result = await openaiChat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    ...options,
  });

  return result.choices[0]?.message?.content || "";
}

/**
 * Get structured JSON response from OpenAI
 */
export async function openaiJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<OpenAIChatOptions>
): Promise<T> {
  const result = await openaiChat({
    messages: [
      {
        role: "system",
        content: systemPrompt + "\n\nYou MUST respond with valid JSON only.",
      },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    ...options,
  });

  const content = result.choices[0]?.message?.content || "{}";
  return JSON.parse(content) as T;
}

/**
 * Stream OpenAI response (returns ReadableStream)
 */
export async function openaiStream(
  options: OpenAIChatOptions
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const {
    messages,
    model = "gpt-4o-mini",
    temperature = 0.7,
    max_tokens = 4096,
  } = options;

  const response = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  return response.body!;
}

/**
 * Validate that the OpenAI API key works
 */
export async function validateOpenAIKey(): Promise<boolean> {
  try {
    const apiKey = ENV.openaiApiKey;
    if (!apiKey) return false;
    // Try direct OpenAI API first, then proxy
    const endpoints = [
      { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
      { url: `${OPENAI_BASE}/chat/completions`, model: "gpt-4.1-nano" },
    ];
    for (const ep of endpoints) {
      try {
        const response = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: ep.model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
          }),
        });
        if (response.ok) return true;
      } catch { /* try next */ }
    }
    return false;
  } catch {
    return false;
  }
}
