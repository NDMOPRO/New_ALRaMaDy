/**
 * AI Agent Router — الراصد الذكي كـ AI Agent مفتوح بالكامل
 * 
 * ██████████████████████████████████████████████████████████████
 * ██  لا Wizard  ·  لا خطوات يدوية  ·  AI مفتوح بالكامل    ██
 * ██  المستخدم يكتب → الراصد يفهم → ينفذ على المحرك مباشرة  ██
 * ██████████████████████████████████████████████████████████████
 * 
 * Flow:
 * 1. المستخدم يكتب أي طلب بالعربي
 * 2. الراصد الذكي يحلل النية (intent) عبر LLM
 * 3. يختار المحرك المناسب تلقائياً
 * 4. ينفذ العملية على المحرك مباشرة
 * 5. يرجع النتيجة بشكل جميل للمستخدم
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { callAI, isAIAvailable, SYSTEM_PROMPTS, type ChatMessage } from "./openai";
import * as engine from "./platformConnector";

// ═══════════════════════════════════════════════════════════════
// INTENT DETECTION — فهم نية المستخدم
// ═══════════════════════════════════════════════════════════════

interface DetectedIntent {
  engine: "report" | "presentation" | "dashboard" | "data" | "transcription" | "translation" | "analysis" | "chat" | "governance" | "spreadsheet";
  action: "create" | "list" | "get" | "update" | "delete" | "export" | "analyze" | "convert" | "chat";
  confidence: number;
  params: Record<string, any>;
  explanation: string;
}

const INTENT_SYSTEM_PROMPT = `أنت نظام تحليل نوايا (Intent Detection) للراصد الذكي — منصة إدارة البيانات الوطنية السعودية.

مهمتك: تحليل رسالة المستخدم وتحديد:
1. المحرك المناسب (engine)
2. العملية المطلوبة (action)
3. المعاملات (params)

المحركات المتاحة:
- report: إنشاء/تعديل/تصدير التقارير
- presentation: إنشاء/تعديل العروض التقديمية والشرائح
- dashboard: إنشاء/تعديل لوحات المؤشرات والودجات
- data: تسجيل/استيراد/إدارة مصادر البيانات
- transcription: تفريغ صوتي/مرئي
- translation: ترجمة نصوص ومستندات
- analysis: تحليل بيانات واستخراج رؤى
- governance: حوكمة البيانات والامتثال والأدوار
- spreadsheet: جداول بيانات وإكسل
- chat: محادثة عامة أو سؤال لا يحتاج محرك محدد

العمليات المتاحة:
- create: إنشاء جديد
- list: عرض القائمة
- get: عرض تفاصيل عنصر محدد
- update: تعديل/تحديث
- delete: حذف
- export: تصدير (PDF, DOCX, PPTX, HTML)
- analyze: تحليل بيانات
- convert: تحويل بين أنواع (تقرير → عرض، عرض → لوحة)
- chat: محادثة عامة

أمثلة:
- "أنشئ تقرير عن نضج البيانات" → engine: report, action: create, params: {title: "تقرير نضج البيانات"}
- "اعمل عرض تقديمي عن الحوكمة" → engine: presentation, action: create, params: {title: "عرض الحوكمة"}
- "وريني لوحات المؤشرات" → engine: dashboard, action: list
- "حلل البيانات المرفقة" → engine: analysis, action: analyze
- "فرّغ هذا الملف الصوتي" → engine: transcription, action: create
- "ترجم هذا النص للإنجليزي" → engine: translation, action: create
- "صدّر التقرير PDF" → engine: report, action: export, params: {format: "pdf"}
- "حول التقرير لعرض تقديمي" → engine: report, action: convert, params: {target: "presentation"}
- "كيف حالك" → engine: chat, action: chat

أجب بـ JSON فقط.`;

async function detectIntent(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<DetectedIntent> {
  try {
    const messages: ChatMessage[] = [
      { role: "system", content: INTENT_SYSTEM_PROMPT },
      ...conversationHistory.slice(-4), // Last 4 messages for context
      { role: "user", content: userMessage },
    ];

    const result = await callAI(messages, {
      temperature: 0.1,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "intent_detection",
          strict: true,
          schema: {
            type: "object",
            properties: {
              engine: {
                type: "string",
                enum: ["report", "presentation", "dashboard", "data", "transcription", "translation", "analysis", "chat", "governance", "spreadsheet"],
              },
              action: {
                type: "string",
                enum: ["create", "list", "get", "update", "delete", "export", "analyze", "convert", "chat"],
              },
              confidence: { type: "number" },
              params: {
                type: "object",
                additionalProperties: true,
                properties: {
                  title: { type: "string" },
                  format: { type: "string" },
                  target: { type: "string" },
                  content: { type: "string" },
                  id: { type: "string" },
                },
              },
              explanation: { type: "string" },
            },
            required: ["engine", "action", "confidence", "params", "explanation"],
            additionalProperties: false,
          },
        },
      },
    });

    return JSON.parse(result.content);
  } catch (error) {
    console.error("[AIAgent] Intent detection failed:", error);
    return {
      engine: "chat",
      action: "chat",
      confidence: 0.5,
      params: {},
      explanation: "فشل تحليل النية، سيتم الرد كمحادثة عامة",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGINE EXECUTORS — تنفيذ العمليات على المحركات
// ═══════════════════════════════════════════════════════════════

interface ExecutionResult {
  success: boolean;
  engine: string;
  action: string;
  data: any;
  message: string;
  artifacts?: Array<{
    id: string;
    type: string;
    label: string;
    icon: string;
    url?: string;
  }>;
  suggestedActions?: Array<{
    id: string;
    label: string;
    icon: string;
    engineAction: string;
  }>;
}

async function executeOnEngine(intent: DetectedIntent, userMessage: string): Promise<ExecutionResult> {
  const { engine: eng, action, params } = intent;

  try {
    switch (eng) {
      // ─── Report Engine ───
      case "report": {
        switch (action) {
          case "create": {
            // Use AI to generate report content first
            const reportContent = await generateReportContent(params.title || userMessage, userMessage);
            const result = await engine.createReport({
              title: reportContent.title,
              description: reportContent.description,
              report_type: reportContent.type,
              sections: reportContent.sections,
            });
            return {
              success: result.ok,
              engine: "report",
              action: "create",
              data: result.data,
              message: result.ok
                ? `✅ تم إنشاء التقرير "${reportContent.title}" بنجاح على محرك التقارير`
                : `❌ فشل إنشاء التقرير: ${result.error}`,
              artifacts: result.ok ? [{
                id: (result.data as any)?.id || (result.data as any)?.report_id || "new",
                type: "report",
                label: reportContent.title,
                icon: "description",
              }] : undefined,
              suggestedActions: result.ok ? [
                { id: "export-pdf", label: "تصدير PDF", icon: "picture_as_pdf", engineAction: "report.exportPdf" },
                { id: "export-docx", label: "تصدير Word", icon: "article", engineAction: "report.exportDocx" },
                { id: "convert-pres", label: "تحويل لعرض", icon: "slideshow", engineAction: "report.convertToPresentation" },
                { id: "convert-dash", label: "تحويل للوحة", icon: "dashboard", engineAction: "report.convertToDashboard" },
              ] : undefined,
            };
          }
          case "list": {
            const result = await engine.listReports();
            const reports = Array.isArray(result.data) ? result.data : ((result.data as any)?.reports || (result.data as any)?.data || []);
            return {
              success: result.ok,
              engine: "report",
              action: "list",
              data: reports,
              message: result.ok
                ? `📋 تم العثور على ${reports.length} تقرير`
                : "فشل جلب التقارير",
            };
          }
          case "export": {
            const format = params.format || "pdf";
            const id = params.id || "latest";
            let result;
            if (format === "pdf") result = await engine.exportReportPdf(id);
            else if (format === "docx") result = await engine.exportReportDocx(id);
            else result = await engine.exportReportHtml(id);
            return {
              success: result.ok,
              engine: "report",
              action: "export",
              data: result.data,
              message: result.ok
                ? `📥 تم تصدير التقرير بصيغة ${format.toUpperCase()}`
                : `فشل تصدير التقرير`,
            };
          }
          case "convert": {
            const id = params.id || "latest";
            const target = params.target || "presentation";
            let result;
            if (target === "presentation") result = await engine.convertReportToPresentation(id);
            else result = await engine.convertReportToDashboard(id);
            return {
              success: result.ok,
              engine: "report",
              action: "convert",
              data: result.data,
              message: result.ok
                ? `🔄 تم تحويل التقرير إلى ${target === "presentation" ? "عرض تقديمي" : "لوحة مؤشرات"}`
                : `فشل تحويل التقرير`,
            };
          }
          default: {
            const result = await engine.listReports();
            return { success: result.ok, engine: "report", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── Presentation Engine ───
      case "presentation": {
        switch (action) {
          case "create": {
            const presContent = await generatePresentationContent(params.title || userMessage, userMessage);
            const result = await engine.createPresentation({
              title: presContent.title,
              description: presContent.description,
              slides: presContent.slides,
              theme: presContent.theme,
            });
            return {
              success: result.ok,
              engine: "presentation",
              action: "create",
              data: result.data,
              message: result.ok
                ? `✅ تم إنشاء العرض التقديمي "${presContent.title}" بنجاح (${presContent.slides.length} شريحة)`
                : `❌ فشل إنشاء العرض: ${result.error}`,
              artifacts: result.ok ? [{
                id: (result.data as any)?.id || (result.data as any)?.deck_id || "new",
                type: "presentation",
                label: presContent.title,
                icon: "slideshow",
              }] : undefined,
              suggestedActions: result.ok ? [
                { id: "export-pptx", label: "تصدير PowerPoint", icon: "slideshow", engineAction: "presentation.exportPptx" },
                { id: "export-pdf", label: "تصدير PDF", icon: "picture_as_pdf", engineAction: "presentation.exportPdf" },
                { id: "convert-dash", label: "تحويل للوحة", icon: "dashboard", engineAction: "presentation.convertToDashboard" },
              ] : undefined,
            };
          }
          case "list": {
            const result = await engine.listPresentations();
            const decks = Array.isArray(result.data) ? result.data : ((result.data as any)?.decks || (result.data as any)?.data || []);
            return {
              success: result.ok,
              engine: "presentation",
              action: "list",
              data: decks,
              message: result.ok ? `📋 تم العثور على ${decks.length} عرض تقديمي` : "فشل جلب العروض",
            };
          }
          default: {
            const result = await engine.listPresentations();
            return { success: result.ok, engine: "presentation", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── Dashboard Engine ───
      case "dashboard": {
        switch (action) {
          case "create": {
            const dashContent = await generateDashboardContent(params.title || userMessage, userMessage);
            const result = await engine.createDashboard({
              title: dashContent.title,
              mode: "advanced",
              dataset_refs: [],
            });
            return {
              success: result.ok,
              engine: "dashboard",
              action: "create",
              data: result.data,
              message: result.ok
                ? `✅ تم إنشاء لوحة المؤشرات "${dashContent.title}" بنجاح`
                : `❌ فشل إنشاء اللوحة: ${result.error}`,
              artifacts: result.ok ? [{
                id: (result.data as any)?.id || (result.data as any)?.dashboard_id || "new",
                type: "dashboard",
                label: dashContent.title,
                icon: "dashboard",
              }] : undefined,
              suggestedActions: result.ok ? [
                { id: "add-widget", label: "إضافة ودجت", icon: "add_chart", engineAction: "dashboard.addWidget" },
                { id: "publish", label: "نشر اللوحة", icon: "publish", engineAction: "dashboard.publish" },
                { id: "share", label: "مشاركة", icon: "share", engineAction: "dashboard.share" },
              ] : undefined,
            };
          }
          case "list": {
            const result = await engine.getDashboardState();
            const dashboards = Array.isArray(result.data) ? result.data : ((result.data as any)?.dashboards || (result.data as any)?.data || []);
            return {
              success: result.ok,
              engine: "dashboard",
              action: "list",
              data: dashboards,
              message: result.ok ? `📋 تم العثور على ${dashboards.length} لوحة مؤشرات` : "فشل جلب اللوحات",
            };
          }
          default: {
            const result = await engine.getDashboardState();
            return { success: result.ok, engine: "dashboard", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── Data Engine ───
      case "data": {
        switch (action) {
          case "create": {
            const result = await engine.registerDataset({
              title: params.title || "مصدر بيانات جديد",
              source_kind: params.type || "file",
            });
            return {
              success: result.ok,
              engine: "data",
              action: "create",
              data: result.data,
              message: result.ok ? `✅ تم تسجيل مصدر البيانات` : `❌ فشل تسجيل المصدر`,
            };
          }
          case "list": {
            const result = await engine.listDatasets();
            const datasets = Array.isArray(result.data) ? result.data : ((result.data as any)?.datasets || (result.data as any)?.data || []);
            return {
              success: result.ok,
              engine: "data",
              action: "list",
              data: datasets,
              message: result.ok ? `📋 تم العثور على ${datasets.length} مصدر بيانات` : "فشل جلب البيانات",
            };
          }
          default: {
            const result = await engine.listDatasets();
            return { success: result.ok, engine: "data", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── Transcription Engine ───
      case "transcription": {
        switch (action) {
          case "create": {
            const result = await engine.startTranscriptionJob({
              file_url: params.fileUrl || "",
              file_name: params.fileName || "audio.mp3",
              language: params.language || "ar",
            });
            return {
              success: result.ok,
              engine: "transcription",
              action: "create",
              data: result.data,
              message: result.ok ? `🎙️ تم بدء التفريغ الصوتي` : `❌ فشل بدء التفريغ`,
            };
          }
          case "list": {
            const result = await engine.listTranscriptionJobs();
            const jobs = Array.isArray(result.data) ? result.data : ((result.data as any)?.jobs || []);
            return {
              success: result.ok,
              engine: "transcription",
              action: "list",
              data: jobs,
              message: result.ok ? `📋 تم العثور على ${jobs.length} عملية تفريغ` : "فشل جلب عمليات التفريغ",
            };
          }
          default: {
            const result = await engine.listTranscriptionJobs();
            return { success: result.ok, engine: "transcription", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── Translation Engine ───
      case "translation": {
        const text = params.content || userMessage;
        const sourceLang = params.sourceLang || "ar";
        const targetLang = params.targetLang || "en";
        const result = await engine.liveTranslation({
          source_locale: sourceLang,
          target_locale: targetLang,
          items: [{ node_id: `tr-${Date.now()}`, text }],
        });
        return {
          success: result.ok,
          engine: "translation",
          action: "create",
          data: result.data,
          message: result.ok ? `🌐 تمت الترجمة بنجاح` : `❌ فشلت الترجمة`,
        };
      }

      // ─── Analysis ───
      case "analysis": {
        // Use AI to analyze and provide insights
        const analysisResult = await performAnalysis(userMessage);
        return {
          success: true,
          engine: "analysis",
          action: "analyze",
          data: analysisResult,
          message: analysisResult.summary,
          suggestedActions: [
            { id: "create-report", label: "إنشاء تقرير", icon: "description", engineAction: "report.create" },
            { id: "create-dashboard", label: "إنشاء لوحة", icon: "dashboard", engineAction: "dashboard.create" },
          ],
        };
      }

      // ─── Governance ───
      case "governance": {
        const result = await engine.getGovernanceState();
        return {
          success: result.ok,
          engine: "governance",
          action: action,
          data: result.data,
          message: result.ok ? `🏛️ تم جلب حالة الحوكمة` : `فشل جلب حالة الحوكمة`,
        };
      }

      // ─── Spreadsheet ───
      case "spreadsheet": {
        switch (action) {
          case "create": {
            const result = await engine.registerDataset({
              title: params.title || "جدول بيانات جديد",
              source_kind: "spreadsheet",
            });
            return {
              success: result.ok,
              engine: "spreadsheet",
              action: "create",
              data: result.data,
              message: result.ok ? `✅ تم إنشاء جدول البيانات` : `❌ فشل إنشاء الجدول`,
            };
          }
          default: {
            const result = await engine.listDatasets();
            return { success: result.ok, engine: "spreadsheet", action, data: result.data, message: "تم تنفيذ العملية" };
          }
        }
      }

      // ─── General Chat ───
      case "chat":
      default: {
        return {
          success: true,
          engine: "chat",
          action: "chat",
          data: null,
          message: "", // Will be filled by AI response
        };
      }
    }
  } catch (error: any) {
    console.error(`[AIAgent] Engine execution failed:`, error);
    return {
      success: false,
      engine: eng,
      action,
      data: null,
      message: `❌ حدث خطأ أثناء التنفيذ: ${error.message}`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// AI CONTENT GENERATORS — توليد المحتوى عبر AI
// ═══════════════════════════════════════════════════════════════

async function generateReportContent(title: string, userRequest: string) {
  try {
    const result = await callAI([
      { role: "system", content: SYSTEM_PROMPTS.report },
      { role: "user", content: `أنشئ تقرير بعنوان "${title}" بناءً على الطلب التالي: ${userRequest}\n\nأعد JSON يحتوي: title, description, type, sections (array of {type, content})` },
    ], { temperature: 0.7, max_tokens: 4000, response_format: { type: "json_object" } });
    
    const parsed = JSON.parse(result.content);
    return {
      title: parsed.title || title,
      description: parsed.description || "",
      type: parsed.type || "general",
      sections: parsed.sections || [],
    };
  } catch {
    return {
      title,
      description: userRequest,
      type: "general",
      sections: [{ type: "paragraph", content: userRequest }],
    };
  }
}

async function generatePresentationContent(title: string, userRequest: string) {
  try {
    const result = await callAI([
      { role: "system", content: SYSTEM_PROMPTS.slides },
      { role: "user", content: `أنشئ عرض تقديمي بعنوان "${title}" بناءً على الطلب: ${userRequest}\n\nأعد JSON يحتوي: title, description, theme, slides (array of {title, subtitle, content, notes, layout})` },
    ], { temperature: 0.7, max_tokens: 4000, response_format: { type: "json_object" } });
    
    const parsed = JSON.parse(result.content);
    return {
      title: parsed.title || title,
      description: parsed.description || "",
      theme: parsed.theme || "default",
      slides: parsed.slides || [],
    };
  } catch {
    return {
      title,
      description: userRequest,
      theme: "default",
      slides: [{ title, content: userRequest, layout: "title" }],
    };
  }
}

async function generateDashboardContent(title: string, userRequest: string) {
  try {
    const result = await callAI([
      { role: "system", content: SYSTEM_PROMPTS.dashboard },
      { role: "user", content: `صمم لوحة مؤشرات بعنوان "${title}" بناءً على الطلب: ${userRequest}\n\nأعد JSON يحتوي: title, description, widgets (array of {type, title, data})` },
    ], { temperature: 0.7, max_tokens: 4000, response_format: { type: "json_object" } });
    
    const parsed = JSON.parse(result.content);
    return {
      title: parsed.title || title,
      description: parsed.description || "",
      widgets: parsed.widgets || [],
    };
  } catch {
    return {
      title,
      description: userRequest,
      widgets: [],
    };
  }
}

async function performAnalysis(userRequest: string) {
  try {
    const result = await callAI([
      { role: "system", content: SYSTEM_PROMPTS.analyze },
      { role: "user", content: userRequest },
    ], { temperature: 0.5, max_tokens: 3000 });
    
    return {
      summary: result.content,
      source: result.source,
    };
  } catch {
    return {
      summary: "عذراً، لم أتمكن من إجراء التحليل المطلوب.",
      source: "error",
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// AI AGENT RESPONSE — بناء الرد النهائي
// ═══════════════════════════════════════════════════════════════

async function buildAgentResponse(
  userMessage: string,
  intent: DetectedIntent,
  executionResult: ExecutionResult,
  conversationHistory: ChatMessage[]
): Promise<string> {
  // If it's a chat intent or execution failed, use AI to respond
  if ((intent.engine as string) === "chat" || (!executionResult.success && (intent.engine as string) !== "chat")) {
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `أنت "راصد الذكي"، مساعد ذكي متخصص في إدارة البيانات الوطنية السعودية.

أنت متصل بالمحركات التالية على Railway وتستطيع تنفيذ أي عملية مباشرة:
🔹 محرك التقارير — إنشاء وتصدير التقارير (PDF, Word, HTML)
🔹 محرك العروض التقديمية — إنشاء وتصدير العروض (PowerPoint, PDF)
🔹 محرك لوحات المؤشرات — إنشاء ونشر لوحات البيانات التفاعلية
🔹 محرك البيانات — تسجيل وإدارة مصادر البيانات
🔹 محرك التفريغ الصوتي — تحويل الصوت والفيديو لنص
🔹 محرك الترجمة — ترجمة فورية بين العربية والإنجليزية
🔹 محرك الحوكمة — إدارة الأدوار والصلاحيات والامتثال

عندما يطلب المستخدم إنشاء شيء، أخبره أنك ستنفذ ذلك مباشرة.
أجب باللغة العربية بأسلوب مهني ومختصر.
${executionResult.message ? `\n\nنتيجة التنفيذ الأخيرة: ${executionResult.message}` : ''}`,
      },
      ...conversationHistory.slice(-6),
      { role: "user", content: userMessage },
    ];

    const result = await callAI(messages, { temperature: 0.7, max_tokens: 2000 });
    return result.content;
  }

  // For successful engine operations, return the execution message
  return executionResult.message;
}

// ═══════════════════════════════════════════════════════════════
// tRPC ROUTER — الراصد الذكي Agent
// ═══════════════════════════════════════════════════════════════

export const aiAgentRouter = router({
  /** Check AI availability */
  status: publicProcedure.query(() => {
    return isAIAvailable();
  }),

  /** Main AI Agent chat — understands intent and executes on engines */
  chat: publicProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const userMessage = input.messages[input.messages.length - 1]?.content || "";
      const history: ChatMessage[] = input.messages.map(m => ({ role: m.role, content: m.content }));

      // Step 1: Detect intent
      const intent = await detectIntent(userMessage, history);
      console.log(`[AIAgent] Intent: ${intent.engine}.${intent.action} (${Math.round(intent.confidence * 100)}%) — ${intent.explanation}`);

      // Step 2: Execute on engine (if not chat)
      let executionResult: ExecutionResult;
      if (intent.engine !== "chat" && intent.confidence >= 0.6) {
        executionResult = await executeOnEngine(intent, userMessage);
      } else {
        executionResult = {
          success: true,
          engine: "chat",
          action: "chat",
          data: null,
          message: "",
        };
      }

      // Step 3: Build AI response
      const responseContent = await buildAgentResponse(userMessage, intent, executionResult, history);

      return {
        content: responseContent,
        intent: {
          engine: intent.engine,
          action: intent.action,
          confidence: intent.confidence,
          explanation: intent.explanation,
        },
        execution: executionResult.success ? {
          engine: executionResult.engine,
          action: executionResult.action,
          message: executionResult.message,
          artifacts: executionResult.artifacts,
          suggestedActions: executionResult.suggestedActions,
        } : undefined,
        source: "agent",
      };
    }),

  /** Execute a suggested action from a previous response */
  executeAction: protectedProcedure
    .input(z.object({
      engineAction: z.string(), // e.g., "report.exportPdf"
      params: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ input }) => {
      const [eng, act] = input.engineAction.split(".");
      const intent: DetectedIntent = {
        engine: eng as any,
        action: act as any,
        confidence: 1.0,
        params: input.params || {},
        explanation: "Direct action execution",
      };
      return executeOnEngine(intent, "");
    }),

  /** Direct engine health check */
  engineHealth: publicProcedure.query(async () => {
    return engine.platformHealthCheck();
  }),

  // ─── Legacy AI endpoints (kept for backward compatibility) ───

  /** Generate slides content */
  generateSlides: publicProcedure
    .input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const userMessage = input.messages[input.messages.length - 1]?.content || "";
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.slides },
        { role: "user", content: userMessage },
      ], { temperature: 0.7, max_tokens: 8000 });
      return { content: result.content, source: result.source };
    }),

  /** Generate report content */
  generateReport: publicProcedure
    .input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const userMessage = input.messages[input.messages.length - 1]?.content || "";
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.report },
        { role: "user", content: userMessage },
      ], { temperature: 0.7, max_tokens: 8000 });
      return { content: result.content, source: result.source };
    }),

  /** Generate dashboard widgets */
  generateDashboard: publicProcedure
    .input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const userMessage = input.messages[input.messages.length - 1]?.content || "";
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.dashboard },
        { role: "user", content: userMessage },
      ], { temperature: 0.7, max_tokens: 8000 });
      return { content: result.content, source: result.source };
    }),

  /** Analyze data */
  analyze: publicProcedure
    .input(z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const userMessage = input.messages[input.messages.length - 1]?.content || "";
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.analyze },
        { role: "user", content: userMessage },
      ], { temperature: 0.5, max_tokens: 4000 });
      return { content: result.content, source: result.source };
    }),

  /** Translate text */
  translate: publicProcedure
    .input(z.object({
      text: z.string(),
      sourceLang: z.string().optional(),
      targetLang: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.translate },
        { role: "user", content: `ترجم النص التالي من ${input.sourceLang || 'العربية'} إلى ${input.targetLang || 'الإنجليزية'}:\n\n${input.text}` },
      ], { temperature: 0.3, max_tokens: 4000 });
      return { content: result.content, source: result.source };
    }),

  /** Summarize text */
  summarize: publicProcedure
    .input(z.object({
      text: z.string(),
      type: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await callAI([
        { role: "system", content: SYSTEM_PROMPTS.summarize },
        { role: "user", content: `لخّص النص التالي:\n\n${input.text}` },
      ], { temperature: 0.3, max_tokens: 2000 });
      return { content: result.content, source: result.source };
    }),

  /** Extract from image (OCR) */
  extractFromImage: publicProcedure
    .input(z.object({ imageUrl: z.string(), prompt: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { callVision } = await import("./openai");
      const result = await callVision([
        { role: "system", content: "أنت متخصص في استخراج النصوص والبيانات من الصور. استخرج كل المحتوى المرئي بدقة." },
        { role: "user", content: [
          { type: "text", text: input.prompt || "استخرج كل النصوص والبيانات من هذه الصورة" },
          { type: "image_url", image_url: { url: input.imageUrl, detail: "high" } },
        ] },
      ]);
      return { content: result.content, source: result.source };
    }),
});

export type AIAgentRouter = typeof aiAgentRouter;
