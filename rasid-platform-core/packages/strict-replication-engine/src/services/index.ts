/**
 * خدمات محرك النسخ الدقيق - المنطق الحقيقي المنقول من الحزمة المرجعية
 * جميع الخدمات مكيفة للعمل مع sql.js عبر prisma-adapter
 */

// محول قاعدة البيانات
export { PrismaClient, Prisma } from './prisma-adapter';

// خدمة حلقة التحقق البصري - قلب المطابقة البصرية (1,344 سطر)
export { PixelValidationLoopService } from './pixel-validation-loop.service';

// خدمة النسخ البصري - إنتاج النسخ المتطابقة (1,458 سطر)
export { VisualReplicationService } from './visual-replication.service';

// خدمة ذكاء PDF - تحليل واستخراج بيانات PDF (1,292 سطر)
export { PdfIntelligenceService } from './pdf-intelligence.service';

// خدمة التوطين العربي - معالجة النصوص العربية (1,250 سطر)
export { ArabicLocalizationService } from './arabic-localization.service';

// خدمة تحسين الطباعة العربية (545 سطر)
export { ArabicTypographyOptimizer } from './arabic-typography-optimizer.service';

// خدمة محرك المقارنة - مقارنة المستندات (861 سطر)
export { ComparisonEngineService } from './comparison-engine.service';

// خدمة منسق الأنبوب الأساسي (841 سطر)
export { CanonicalPipelineOrchestrator } from './canonical-pipeline-orchestrator.service';

// خدمة التحكم بتوليد التخطيط (822 سطر)
export { LayoutGenerationController } from './layout-generation-controller.service';

// خدمة بناء النسخ (733 سطر)
export { ReplicaBuilderService } from './replica-builder.service';

// خدمة استخراج الأنماط (680 سطر)
export { StyleExtractorService } from './style-extractor.service';

// خدمة التحقق من الجودة (576 سطر)
export { QualityValidationService } from './quality-validation.service';

// خدمة ربط البيانات (572 سطر)
export { DataBindingService } from './data-binding.service';

// خدمة التحليل البصري (559 سطر)
export { VisualAnalyzerService } from './visual-analyzer.service';

// خدمة استخراج البيانات (505 سطر)
export { DataExtractionService } from './data-extraction.service';

// خدمة التعرف على الخطوط (366 سطر)
export { FontRecognitionService } from './font-recognition.service';
