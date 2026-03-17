/**
 * Guided Questions module:
 * When the AI cannot confidently route or execute a request,
 * it generates targeted clarification questions instead of guessing.
 *
 * Plan → Guided questions (when needed) → Execute → Deliver
 */

type RowData = Record<string, unknown>;

export type GuidedQuestion = {
  question_id: string;
  question_text: string;
  question_text_ar: string;
  category: "intent_clarification" | "scope_selection" | "parameter_missing" | "ambiguity_resolution" | "confirmation";
  options?: Array<{ value: string; label: string; label_ar: string }>;
  required: boolean;
  default_value?: string;
};

export type GuidedQuestionSet = {
  set_id: string;
  trigger_reason: string;
  confidence_before: number;
  questions: GuidedQuestion[];
  context: {
    page_path: string;
    detected_intent: string;
    ambiguous_elements: string[];
  };
  created_at: string;
};

export type GuidedAnswers = {
  set_id: string;
  answers: Record<string, string>;
};

export type GuidedResolution = {
  set_id: string;
  resolved_intent: string;
  resolved_params: Record<string, unknown>;
  confidence_after: number;
  ready_to_execute: boolean;
};

let questionSetCounter = 0;
const nextSetId = (): string => `gq-set-${++questionSetCounter}-${Date.now()}`;
let questionCounter = 0;
const nextQuestionId = (): string => `gq-${++questionCounter}`;

export class GuidedQuestionEngine {
  /**
   * Determine if guided questions are needed before execution.
   * Returns null if the request is clear enough to proceed directly.
   */
  evaluateNeedForQuestions(params: {
    user_prompt: string;
    page_path: string;
    columns?: string[];
    rows?: RowData[];
    detected_intent?: string;
    confidence?: number;
  }): GuidedQuestionSet | null {
    const prompt = params.user_prompt.trim().toLowerCase();
    const confidence = params.confidence ?? 0.5;

    // High confidence — no questions needed
    if (confidence >= 0.8 && prompt.length > 10) {
      return null;
    }

    const questions: GuidedQuestion[] = [];
    const ambiguous: string[] = [];

    // Check for vague prompts
    if (prompt.length < 8 || /^(analyze|help|show|أظهر|ساعد|حلل)$/i.test(prompt)) {
      ambiguous.push("prompt_too_vague");
      questions.push({
        question_id: nextQuestionId(),
        question_text: "What specific analysis or action would you like to perform?",
        question_text_ar: "ما التحليل أو الإجراء المحدد الذي تريد تنفيذه؟",
        category: "intent_clarification",
        options: [
          { value: "summarize", label: "Summarize data", label_ar: "تلخيص البيانات" },
          { value: "visualize", label: "Create visualization", label_ar: "إنشاء تمثيل بصري" },
          { value: "clean", label: "Clean/prepare data", label_ar: "تنظيف/تحضير البيانات" },
          { value: "forecast", label: "Forecast trends", label_ar: "توقع الاتجاهات" },
          { value: "compare", label: "Compare datasets", label_ar: "مقارنة مجموعات البيانات" },
          { value: "report", label: "Generate report", label_ar: "إنشاء تقرير" }
        ],
        required: true
      });
    }

    // Multiple possible targets detected
    const multiTargetPatterns = [
      { pattern: /dashboard.*report|report.*dashboard/i, targets: ["dashboard", "report"] },
      { pattern: /chart.*table|table.*chart/i, targets: ["chart", "table"] },
      { pattern: /excel.*presentation|presentation.*excel/i, targets: ["excel", "presentation"] }
    ];
    for (const mtp of multiTargetPatterns) {
      if (mtp.pattern.test(prompt)) {
        ambiguous.push("multiple_targets");
        questions.push({
          question_id: nextQuestionId(),
          question_text: `Your request mentions multiple output types. Which should be the primary output?`,
          question_text_ar: `طلبك يتضمن عدة أنواع مخرجات. أيهم يكون المخرج الأساسي؟`,
          category: "scope_selection",
          options: mtp.targets.map((t) => ({ value: t, label: t, label_ar: t })),
          required: true
        });
        break;
      }
    }

    // Column ambiguity — prompt references data but no specific columns
    if (params.columns && params.columns.length > 5) {
      const referencedCols = params.columns.filter((c) => prompt.includes(c.toLowerCase()));
      if (referencedCols.length === 0 && /metric|column|field|حقل|عمود|مقياس/i.test(prompt)) {
        ambiguous.push("column_ambiguity");
        questions.push({
          question_id: nextQuestionId(),
          question_text: "Which columns should be used for this operation?",
          question_text_ar: "أي الأعمدة يجب استخدامها لهذه العملية؟",
          category: "parameter_missing",
          options: params.columns.slice(0, 15).map((c) => ({ value: c, label: c, label_ar: c })),
          required: true
        });
      }
    }

    // Time period ambiguity
    if (/trend|over time|monthly|yearly|forecast|اتجاه|شهري|سنوي|توقع/i.test(prompt)) {
      const timeCols = (params.columns ?? []).filter((c) => /date|time|year|month|period|تاريخ|سنة|شهر/i.test(c));
      if (timeCols.length > 1) {
        ambiguous.push("time_dimension_ambiguity");
        questions.push({
          question_id: nextQuestionId(),
          question_text: "Multiple time columns detected. Which one should define the time axis?",
          question_text_ar: "تم العثور على عدة أعمدة زمنية. أيهم يحدد المحور الزمني؟",
          category: "ambiguity_resolution",
          options: timeCols.map((c) => ({ value: c, label: c, label_ar: c })),
          required: true
        });
      }
    }

    // Mutating action confirmation
    if (/create|build|generate|apply|publish|delete|remove|أنشئ|ابنِ|طبّق|احذف|انشر/i.test(prompt)) {
      if (confidence < 0.7) {
        ambiguous.push("mutating_action_confirmation");
        questions.push({
          question_id: nextQuestionId(),
          question_text: "This action will create or modify data. Do you want to proceed?",
          question_text_ar: "هذا الإجراء سيُنشئ أو يعدّل بيانات. هل تريد المتابعة؟",
          category: "confirmation",
          options: [
            { value: "yes", label: "Yes, proceed", label_ar: "نعم، تابع" },
            { value: "preview", label: "Show preview first", label_ar: "أظهر المعاينة أولاً" },
            { value: "no", label: "Cancel", label_ar: "إلغاء" }
          ],
          required: true,
          default_value: "preview"
        });
      }
    }

    // Scope: entire dataset or filtered subset?
    if (params.rows && params.rows.length > 100 && !/all|entire|كل|جميع/i.test(prompt)) {
      if (/some|specific|filter|certain|بعض|محدد/i.test(prompt)) {
        ambiguous.push("scope_unclear");
        questions.push({
          question_id: nextQuestionId(),
          question_text: `The dataset has ${params.rows.length} rows. Should the operation apply to all rows or a filtered subset?`,
          question_text_ar: `مجموعة البيانات تحتوي ${params.rows.length} صف. هل يُطبّق الإجراء على جميع الصفوف أم مجموعة فرعية مفلترة؟`,
          category: "scope_selection",
          options: [
            { value: "all", label: "All rows", label_ar: "جميع الصفوف" },
            { value: "filtered", label: "Filtered subset", label_ar: "مجموعة فرعية مفلترة" }
          ],
          required: true,
          default_value: "all"
        });
      }
    }

    if (questions.length === 0) {
      return null;
    }

    return {
      set_id: nextSetId(),
      trigger_reason: `Confidence ${confidence} below threshold. Ambiguities: ${ambiguous.join(", ")}.`,
      confidence_before: confidence,
      questions,
      context: {
        page_path: params.page_path,
        detected_intent: params.detected_intent ?? "unknown",
        ambiguous_elements: ambiguous
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Resolve guided answers into actionable parameters.
   */
  resolveAnswers(questionSet: GuidedQuestionSet, answers: GuidedAnswers): GuidedResolution {
    const resolvedParams: Record<string, unknown> = {};
    let confidenceBoost = 0;

    for (const question of questionSet.questions) {
      const answer = answers.answers[question.question_id];
      if (!answer && question.required) {
        return {
          set_id: questionSet.set_id,
          resolved_intent: questionSet.context.detected_intent,
          resolved_params: resolvedParams,
          confidence_after: questionSet.confidence_before,
          ready_to_execute: false
        };
      }

      const value = answer ?? question.default_value ?? "";
      resolvedParams[question.category] = value;

      switch (question.category) {
        case "intent_clarification":
          resolvedParams["resolved_intent"] = value;
          confidenceBoost += 0.25;
          break;
        case "scope_selection":
          resolvedParams["resolved_scope"] = value;
          confidenceBoost += 0.15;
          break;
        case "parameter_missing":
          resolvedParams["resolved_columns"] = value.split(",").map((v) => v.trim());
          confidenceBoost += 0.2;
          break;
        case "ambiguity_resolution":
          resolvedParams["resolved_disambiguation"] = value;
          confidenceBoost += 0.15;
          break;
        case "confirmation":
          resolvedParams["user_confirmed"] = value === "yes";
          resolvedParams["preview_requested"] = value === "preview";
          if (value === "no") {
            return {
              set_id: questionSet.set_id,
              resolved_intent: "cancelled",
              resolved_params: resolvedParams,
              confidence_after: 0,
              ready_to_execute: false
            };
          }
          confidenceBoost += 0.1;
          break;
      }
    }

    const confidenceAfter = Math.min(0.95, questionSet.confidence_before + confidenceBoost);

    return {
      set_id: questionSet.set_id,
      resolved_intent: (resolvedParams["resolved_intent"] as string) ?? questionSet.context.detected_intent,
      resolved_params: resolvedParams,
      confidence_after: Math.round(confidenceAfter * 100) / 100,
      ready_to_execute: confidenceAfter >= 0.6
    };
  }
}
