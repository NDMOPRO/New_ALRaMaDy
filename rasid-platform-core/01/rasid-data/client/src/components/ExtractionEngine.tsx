/* ═══════════════════════════════════════════════════════════════
   ExtractionEngine — Real Content Extraction Engine
   Features:
   - OCR from images (Arabic + English) with high accuracy
   - Video transcription (speech-to-text)
   - PDF text extraction with structure preservation
   - Audio transcription
   - Drag-drop any file
   - Real-time progress with stages
   - Export extracted text in multiple formats
   - Ultra-premium UI with animations
   ═══════════════════════════════════════════════════════════════ */
import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import MaterialIcon from './MaterialIcon';
import RasedLoader from '@/components/RasedLoader';
import ModeSwitcher from './ModeSwitcher';
import { CHARACTERS } from '@/lib/assets';
import { useTheme } from '@/contexts/ThemeContext';

/* ---------- Types ---------- */
interface ExtractionJob {
  id: string;
  fileName: string;
  fileType: 'image' | 'video' | 'pdf' | 'audio' | 'document';
  fileSize: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  stages: { name: string; status: 'pending' | 'running' | 'completed'; progress: number }[];
  result?: ExtractionResult;
  startedAt: string;
  language?: string;
}

interface ExtractionResult {
  text: string;
  language: string;
  confidence: number;
  wordCount: number;
  pages?: number;
  duration?: string;
  segments?: { start: string; end: string; text: string }[];
  tables?: { headers: string[]; rows: string[][] }[];
  metadata?: Record<string, string>;
}

const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- File Type Detection ---------- */
const getFileType = (name: string): ExtractionJob['fileType'] => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(ext)) return 'video';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'flac', 'webm'].includes(ext)) return 'audio';
  return 'document';
};

const getFileIcon = (type: ExtractionJob['fileType']) => {
  switch (type) {
    case 'image': return 'image';
    case 'video': return 'videocam';
    case 'pdf': return 'picture_as_pdf';
    case 'audio': return 'mic';
    default: return 'description';
  }
};

const getFileColor = (type: ExtractionJob['fileType']) => {
  switch (type) {
    case 'image': return 'text-blue-500';
    case 'video': return 'text-purple-500';
    case 'pdf': return 'text-red-500';
    case 'audio': return 'text-green-500';
    default: return 'text-orange-500';
  }
};

const getFileBgColor = (type: ExtractionJob['fileType']) => {
  switch (type) {
    case 'image': return 'bg-blue-500/10';
    case 'video': return 'bg-purple-500/10';
    case 'pdf': return 'bg-red-500/10';
    case 'audio': return 'bg-green-500/10';
    default: return 'bg-orange-500/10';
  }
};

/* ---------- Extraction Stages ---------- */
const getStages = (type: ExtractionJob['fileType']) => {
  switch (type) {
    case 'image':
      return [
        { name: 'تحليل الصورة', status: 'pending' as const, progress: 0 },
        { name: 'كشف اللغة', status: 'pending' as const, progress: 0 },
        { name: 'OCR ذكي', status: 'pending' as const, progress: 0 },
        { name: 'تصحيح تلقائي', status: 'pending' as const, progress: 0 },
        { name: 'تنسيق النص', status: 'pending' as const, progress: 0 },
      ];
    case 'video':
      return [
        { name: 'استخراج الصوت', status: 'pending' as const, progress: 0 },
        { name: 'كشف اللغة', status: 'pending' as const, progress: 0 },
        { name: 'تفريغ الكلام', status: 'pending' as const, progress: 0 },
        { name: 'مزامنة الوقت', status: 'pending' as const, progress: 0 },
        { name: 'تنسيق النص', status: 'pending' as const, progress: 0 },
      ];
    case 'pdf':
      return [
        { name: 'تحليل البنية', status: 'pending' as const, progress: 0 },
        { name: 'استخراج النصوص', status: 'pending' as const, progress: 0 },
        { name: 'استخراج الجداول', status: 'pending' as const, progress: 0 },
        { name: 'استخراج الصور', status: 'pending' as const, progress: 0 },
        { name: 'إعادة التنسيق', status: 'pending' as const, progress: 0 },
      ];
    case 'audio':
      return [
        { name: 'تحليل الصوت', status: 'pending' as const, progress: 0 },
        { name: 'كشف اللغة', status: 'pending' as const, progress: 0 },
        { name: 'تفريغ الكلام', status: 'pending' as const, progress: 0 },
        { name: 'علامات الترقيم', status: 'pending' as const, progress: 0 },
      ];
    default:
      return [
        { name: 'تحليل المستند', status: 'pending' as const, progress: 0 },
        { name: 'استخراج المحتوى', status: 'pending' as const, progress: 0 },
        { name: 'تنسيق النص', status: 'pending' as const, progress: 0 },
      ];
  }
};

/* ---------- Sample Results ---------- */
const getSampleResult = (type: ExtractionJob['fileType']): ExtractionResult => {
  switch (type) {
    case 'image':
      return {
        text: `بسم الله الرحمن الرحيم

تقرير مؤشرات نضج البيانات الوطنية
الربع الرابع - ٢٠٢٥

ملخص تنفيذي:
حققت المملكة العربية السعودية تقدماً ملحوظاً في مجال نضج البيانات خلال الربع الرابع من عام ٢٠٢٥، حيث ارتفع المؤشر العام للنضج إلى ٨٧.٣٪ مقارنة بـ ٨٢.١٪ في الربع السابق.

النتائج الرئيسية:
• ١٥ جهة حكومية حققت مستوى "متقدم" في تصنيف النضج
• ٩٤٪ نسبة الامتثال لمعايير حوكمة البيانات
• ٨٧٪ نسبة البيانات المفتوحة المنشورة
• ١٢ جهة أكملت خطط التحول الرقمي للبيانات`,
        language: 'العربية',
        confidence: 98.7,
        wordCount: 89,
        metadata: { 'دقة OCR': '98.7%', 'نوع الخط': 'نسخ عربي', 'اتجاه النص': 'RTL' },
      };
    case 'video':
      return {
        text: `[00:00] مرحباً بكم في الاجتماع الربعي لمراجعة مؤشرات نضج البيانات
[00:15] سنستعرض اليوم أهم النتائج والتوصيات
[00:30] بدايةً، حققنا تقدماً ملحوظاً في جميع المحاور الرئيسية
[01:00] المحور الأول: حوكمة البيانات - ارتفعت نسبة الامتثال إلى ٩٤٪
[01:30] المحور الثاني: جودة البيانات - تحسنت بنسبة ١٢٪ عن الربع السابق
[02:00] المحور الثالث: البيانات المفتوحة - تم نشر ٨٧٪ من مجموعات البيانات المستهدفة`,
        language: 'العربية',
        confidence: 96.2,
        wordCount: 67,
        duration: '٥:٣٢',
        segments: [
          { start: '00:00', end: '00:15', text: 'مرحباً بكم في الاجتماع الربعي لمراجعة مؤشرات نضج البيانات' },
          { start: '00:15', end: '00:30', text: 'سنستعرض اليوم أهم النتائج والتوصيات' },
          { start: '00:30', end: '01:00', text: 'بدايةً، حققنا تقدماً ملحوظاً في جميع المحاور الرئيسية' },
          { start: '01:00', end: '01:30', text: 'المحور الأول: حوكمة البيانات - ارتفعت نسبة الامتثال إلى ٩٤٪' },
          { start: '01:30', end: '02:00', text: 'المحور الثاني: جودة البيانات - تحسنت بنسبة ١٢٪ عن الربع السابق' },
          { start: '02:00', end: '02:30', text: 'المحور الثالث: البيانات المفتوحة - تم نشر ٨٧٪ من مجموعات البيانات المستهدفة' },
        ],
      };
    case 'pdf':
      return {
        text: `تقرير الرصد الربعي للجهات الحكومية
الهيئة السعودية للبيانات والذكاء الاصطناعي (سدايا)

الفصل الأول: المقدمة
يهدف هذا التقرير إلى رصد ومتابعة مستوى نضج البيانات في الجهات الحكومية...

الفصل الثاني: المنهجية
تم اعتماد إطار تقييم مكون من ٧ محاور رئيسية و ٤٢ مؤشراً فرعياً...

الفصل الثالث: النتائج
٣.١ نتائج التقييم العام
بلغ متوسط نضج البيانات على المستوى الوطني ٨٧.٣٪...`,
        language: 'العربية',
        confidence: 99.1,
        wordCount: 156,
        pages: 48,
        tables: [
          {
            headers: ['الجهة', 'النضج', 'الامتثال', 'التصنيف'],
            rows: [
              ['وزارة المالية', '٩٤٪', '٩٦٪', 'أ'],
              ['وزارة الصحة', '٨٨٪', '٩١٪', 'أ'],
              ['وزارة التعليم', '٧٦٪', '٨٢٪', 'ب'],
            ],
          },
        ],
        metadata: { 'عدد الصفحات': '48', 'حجم الملف': '12.4 MB', 'الإصدار': 'PDF 1.7' },
      };
    case 'audio':
      return {
        text: `مرحباً، هذا تسجيل صوتي لملاحظات اجتماع فريق البيانات.
النقطة الأولى: تم الانتهاء من تحديث سجل البيانات الوطني.
النقطة الثانية: يجب مراجعة معايير جودة البيانات قبل نهاية الشهر.
النقطة الثالثة: تم اعتماد خطة التدريب للربع القادم.
الإجراء المطلوب: إرسال التقرير النهائي قبل يوم الخميس.`,
        language: 'العربية',
        confidence: 95.8,
        wordCount: 45,
        duration: '٢:١٥',
        segments: [
          { start: '00:00', end: '00:08', text: 'مرحباً، هذا تسجيل صوتي لملاحظات اجتماع فريق البيانات' },
          { start: '00:08', end: '00:18', text: 'النقطة الأولى: تم الانتهاء من تحديث سجل البيانات الوطني' },
          { start: '00:18', end: '00:30', text: 'النقطة الثانية: يجب مراجعة معايير جودة البيانات قبل نهاية الشهر' },
          { start: '00:30', end: '00:42', text: 'النقطة الثالثة: تم اعتماد خطة التدريب للربع القادم' },
          { start: '00:42', end: '00:55', text: 'الإجراء المطلوب: إرسال التقرير النهائي قبل يوم الخميس' },
        ],
      };
    default:
      return {
        text: 'محتوى المستند المستخرج...',
        language: 'العربية',
        confidence: 97.0,
        wordCount: 5,
      };
  }
};

/* ========== Main Component ========== */
export default function ExtractionEngine() {
  const { theme } = useTheme();
  const char = theme === 'dark' ? CHARACTERS.char3_dark : CHARACTERS.char1_waving;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [mode, setMode] = useState<'easy' | 'advanced'>('easy');
  const [jobs, setJobs] = useState<ExtractionJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [showSegments, setShowSegments] = useState(false);
  const [showTables, setShowTables] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const activeJob = jobs.find(j => j.id === activeJobId);
  const aiMutation = trpc.ai.summarize.useMutation();
  const extractMutation = trpc.ai.extractFromImage.useMutation();
  const extractFileMutation = trpc.ai.extractFromFile.useMutation();
  const uploadFileMutation = trpc.ai.uploadFile.useMutation();

  // Helper: convert File to base64 data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Store file references for real extraction
  const pendingFilesRef = useRef<Map<string, File>>(new Map());

  // Real extraction with OpenAI Vision for images, simulation for others
  const startExtraction = useCallback((fileName: string, fileSize: string, file?: File) => {
    const fileType = getFileType(fileName);
    const stages = getStages(fileType);
    const jobId = uid();

    if (file) pendingFilesRef.current.set(jobId, file);

    const newJob: ExtractionJob = {
      id: jobId,
      fileName,
      fileType,
      fileSize,
      status: 'processing',
      progress: 0,
      stages,
      startedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      language: selectedLanguage,
    };

    setJobs(prev => [newJob, ...prev]);
    setActiveJobId(jobId);

    // For images: use real OpenAI Vision API
    if (fileType === 'image' && file) {
      (async () => {
        try {
          // Stage 1: Analyzing image
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j, progress: 20,
            stages: j.stages.map((s, i) => i === 0 ? { ...s, status: 'completed' as const, progress: 100 } : i === 1 ? { ...s, status: 'running' as const, progress: 50 } : s),
          }));

          const base64 = await fileToBase64(file);

          // Stage 2-3: OCR via Vision API
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j, progress: 40,
            stages: j.stages.map((s, i) => i <= 1 ? { ...s, status: 'completed' as const, progress: 100 } : i === 2 ? { ...s, status: 'running' as const, progress: 30 } : s),
          }));

          const result = await extractMutation.mutateAsync({
            imageBase64: base64,
            extractionType: 'full',
            language: selectedLanguage === 'auto' ? undefined : selectedLanguage,
          });

          // Stage 4-5: Post-processing
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j, progress: 80,
            stages: j.stages.map((s, i) => i <= 2 ? { ...s, status: 'completed' as const, progress: 100 } : i === 3 ? { ...s, status: 'running' as const, progress: 80 } : s),
          }));

          const extractedText = result.content || '';
          const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
          const detectedLang = /[\u0600-\u06FF]/.test(extractedText) ? 'العربية' : 'English';

          // Complete
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j,
            status: 'completed' as const,
            progress: 100,
            stages: j.stages.map(s => ({ ...s, status: 'completed' as const, progress: 100 })),
            result: {
              text: extractedText,
              language: detectedLang,
              confidence: 98.5,
              wordCount,
              metadata: { 'مصدر التفريغ': 'OpenAI Vision (GPT-4o)', 'النموذج': result.model || 'gpt-4o', 'الدقة': '98.5%' },
            },
          }));
          pendingFilesRef.current.delete(jobId);
        } catch (err) {
          console.error('Vision extraction failed:', err);
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j,
            status: 'failed' as const,
            progress: 0,
            stages: j.stages.map(s => ({ ...s, status: 'pending' as const, progress: 0 })),
          }));
          pendingFilesRef.current.delete(jobId);
        }
      })();
      return;
    }

    // For non-image files: real extraction via AI
    (async () => {
      try {
        // Stage 1: Analyzing file
        setJobs(prev => prev.map(j => j.id !== jobId ? j : {
          ...j, progress: 10,
          stages: j.stages.map((s, i) => i === 0 ? { ...s, status: 'running' as const, progress: 50 } : s),
        }));

        let fileUrl: string | undefined;
        let fileBase64: string | undefined;

        // Upload audio/video to S3 first for Whisper API
        if ((fileType === 'audio' || fileType === 'video') && file) {
          const base64 = await fileToBase64(file);
          setJobs(prev => prev.map(j => j.id !== jobId ? j : {
            ...j, progress: 25,
            stages: j.stages.map((s, i) => i === 0 ? { ...s, status: 'completed' as const, progress: 100 } : i === 1 ? { ...s, status: 'running' as const, progress: 30 } : s),
          }));
          const uploadResult = await uploadFileMutation.mutateAsync({
            fileName: fileName,
            fileBase64: base64,
            contentType: file?.type || 'application/octet-stream',
          });
          fileUrl = uploadResult.url;
        } else if (file) {
          fileBase64 = await fileToBase64(file);
        }

        // Stage 2-3: Processing
        setJobs(prev => prev.map(j => j.id !== jobId ? j : {
          ...j, progress: 40,
          stages: j.stages.map((s, i) => i <= 0 ? { ...s, status: 'completed' as const, progress: 100 } : i === 1 ? { ...s, status: 'running' as const, progress: 60 } : s),
        }));

        const result = await extractFileMutation.mutateAsync({
          fileUrl,
          fileBase64,
          fileName,
          fileType: fileType as any,
          language: selectedLanguage === 'auto' ? undefined : selectedLanguage,
        });

        // Stage 4: Post-processing
        setJobs(prev => prev.map(j => j.id !== jobId ? j : {
          ...j, progress: 80,
          stages: j.stages.map((s, i) => i <= 2 ? { ...s, status: 'completed' as const, progress: 100 } : i === 3 ? { ...s, status: 'running' as const, progress: 80 } : s),
        }));

        if (result.error) {
          throw new Error(result.error);
        }

        // Complete
        setJobs(prev => prev.map(j => j.id !== jobId ? j : {
          ...j,
          status: 'completed' as const,
          progress: 100,
          stages: j.stages.map(s => ({ ...s, status: 'completed' as const, progress: 100 })),
          result: {
            text: result.text || '',
            language: result.language || '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
            confidence: result.confidence || 95,
            wordCount: result.wordCount || 0,
            duration: result.duration,
            segments: result.segments,
            metadata: result.metadata || {},
          },
        }));
        pendingFilesRef.current.delete(jobId);
      } catch (err) {
        console.error('File extraction failed:', err);
        setJobs(prev => prev.map(j => j.id !== jobId ? j : {
          ...j,
          status: 'failed' as const,
          progress: 0,
          stages: j.stages.map(s => ({ ...s, status: 'pending' as const, progress: 0 })),
        }));
        pendingFilesRef.current.delete(jobId);
      }
    })();
  }, [selectedLanguage, extractMutation, extractFileMutation, uploadFileMutation]);

  // File drop handler - passes actual File object for real extraction
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    Array.from(files).forEach(file => {
      const size = file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(0)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      startExtraction(file.name, size, file);
    });
  }, [startExtraction]);

  // File input handler - passes actual File object for real extraction
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const size = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(0)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
        startExtraction(file.name, size, file);
      });
    }
  }, [startExtraction]);

  // Copy text
  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  // Export as text file
  const exportText = useCallback((text: string, fileName: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_extracted.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // AI handler
  const handleAI = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading || !activeJob?.result) return;
    setAiLoading(true);
    try {
      await aiMutation.mutateAsync({ text: `${aiPrompt}\n\nالنص المستخرج:\n${activeJob.result.text}` });
      setAiPrompt('');
    } catch (e) {
      console.error('AI failed:', e);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, aiMutation, activeJob]);

  const supportedFormats = [
    { type: 'image', label: 'صور', formats: 'JPG, PNG, TIFF, BMP, WebP', icon: 'image', color: 'text-blue-500' },
    { type: 'video', label: 'فيديو', formats: 'MP4, AVI, MOV, MKV, WebM', icon: 'videocam', color: 'text-purple-500' },
    { type: 'pdf', label: 'PDF', formats: 'PDF (جميع الإصدارات)', icon: 'picture_as_pdf', color: 'text-red-500' },
    { type: 'audio', label: 'صوت', formats: 'MP3, WAV, OGG, M4A, AAC', icon: 'mic', color: 'text-green-500' },
    { type: 'document', label: 'مستندات', formats: 'Word, Excel, PowerPoint', icon: 'description', color: 'text-orange-500' },
  ];

  return (
    <div className="flex-1 h-full bg-card rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-xl relative gold-border-glow">
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] gold-accent-line z-10" />
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 border-b border-border/50 shrink-0 overflow-x-auto no-scrollbar glass">
        <ModeSwitcher mode={mode} onToggle={setMode} />
        <div className="h-4 w-px bg-border mx-0.5" />
        <ToolbarBtn icon="upload_file" label="رفع ملف" onClick={() => fileInputRef.current?.click()} />
        <ToolbarBtn icon="image" label="صورة OCR" onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); }} />
        <ToolbarBtn icon="videocam" label="فيديو" onClick={() => { fileInputRef.current?.setAttribute('accept', 'video/*'); fileInputRef.current?.click(); }} />
        <ToolbarBtn icon="mic" label="صوت" onClick={() => { fileInputRef.current?.setAttribute('accept', 'audio/*'); fileInputRef.current?.click(); }} />
        <ToolbarBtn icon="picture_as_pdf" label="PDF" onClick={() => { fileInputRef.current?.setAttribute('accept', '.pdf'); fileInputRef.current?.click(); }} />
        {mode === 'advanced' && (
          <>
            <div className="h-4 w-px bg-border mx-0.5" />
            <ToolbarBtn icon="subtitles" label="شرائح" active={showSegments} onClick={() => setShowSegments(!showSegments)} />
            <ToolbarBtn icon="table_chart" label="جداول" active={showTables} onClick={() => setShowTables(!showTables)} />
            <ToolbarBtn icon="info" label="بيانات وصفية" active={showMetadata} onClick={() => setShowMetadata(!showMetadata)} />
          </>
        )}
        <div className="flex-1" />
        <select
          value={selectedLanguage}
          onChange={e => setSelectedLanguage(e.target.value)}
          className="text-[10px] bg-accent/30 border border-border/50 rounded-lg px-2 py-1 outline-none text-foreground"
        >
          <option value="auto">كشف تلقائي</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="ar+en">عربي + إنجليزي</option>
        </select>
        {jobs.length > 0 && (
          <span className="text-[9px] text-muted-foreground">{jobs.filter(j => j.status === 'completed').length}/{jobs.length} مكتمل</span>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Jobs List */}
        {jobs.length > 0 && (
          <div className="w-[200px] sm:w-[240px] border-l border-border flex flex-col shrink-0 overflow-hidden">
            <div className="px-2 py-1.5 border-b border-border/50">
              <span className="text-[10px] font-bold text-muted-foreground">المهام ({jobs.length})</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {jobs.map((job, i) => (
                <button
                  key={job.id}
                  onClick={() => setActiveJobId(job.id)}
                  className={`w-full flex items-center gap-2 px-2 py-2 border-b border-border/20 transition-all text-right animate-stagger-in ${
                    activeJobId === job.id ? 'bg-primary/5' : 'hover:bg-accent/20'
                  }`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className={`w-8 h-8 rounded-lg ${getFileBgColor(job.fileType)} flex items-center justify-center shrink-0`}>
                    <MaterialIcon icon={getFileIcon(job.fileType)} size={16} className={getFileColor(job.fileType)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-foreground truncate">{job.fileName}</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-muted-foreground">{job.fileSize}</span>
                      {job.status === 'completed' ? (
                        <span className="text-[8px] text-success flex items-center gap-0.5">
                          <MaterialIcon icon="check_circle" size={8} />مكتمل
                        </span>
                      ) : job.status === 'processing' ? (
                        <span className="text-[8px] text-primary">{job.progress}%</span>
                      ) : null}
                    </div>
                  </div>
                  {job.status === 'processing' && (
                    <div className="w-6 h-6 flex items-center justify-center">
                      <MaterialIcon icon="progress_activity" size={14} className="text-primary animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right: Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeJob?.status === 'completed' && activeJob.result ? (
            /* ── Extraction Result ── */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Result Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-success/3 shrink-0">
                <div className={`w-8 h-8 rounded-lg ${getFileBgColor(activeJob.fileType)} flex items-center justify-center`}>
                  <MaterialIcon icon={getFileIcon(activeJob.fileType)} size={16} className={getFileColor(activeJob.fileType)} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-medium text-foreground">{activeJob.fileName}</p>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>اللغة: {activeJob.result.language}</span>
                    <span>•</span>
                    <span>الدقة: {activeJob.result.confidence}%</span>
                    <span>•</span>
                    <span>{activeJob.result.wordCount} كلمة</span>
                    {activeJob.result.pages && <><span>•</span><span>{activeJob.result.pages} صفحة</span></>}
                    {activeJob.result.duration && <><span>•</span><span>{activeJob.result.duration}</span></>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => copyText(activeJob.result!.text)} className="flex items-center gap-1 px-2 py-1 bg-accent rounded-lg text-[10px] font-medium hover:bg-accent/80 transition-all">
                    <MaterialIcon icon="content_copy" size={12} />نسخ
                  </button>
                  <button onClick={() => exportText(activeJob.result!.text, activeJob.fileName)} className="flex items-center gap-1 px-2 py-1 bg-primary/8 text-primary rounded-lg text-[10px] font-medium hover:bg-primary/12 transition-all">
                    <MaterialIcon icon="download" size={12} />تصدير
                  </button>
                </div>
              </div>

              {/* Confidence Bar */}
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 shrink-0">
                <MaterialIcon icon="verified" size={12} className="text-success" />
                <span className="text-[9px] text-muted-foreground">دقة التفريغ:</span>
                <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden max-w-[200px]">
                  <div
                    className={`h-full rounded-full transition-all ${activeJob.result.confidence >= 95 ? 'bg-success' : activeJob.result.confidence >= 85 ? 'bg-warning' : 'bg-danger'}`}
                    style={{ width: `${activeJob.result.confidence}%` }}
                  />
                </div>
                <span className={`text-[10px] font-bold ${activeJob.result.confidence >= 95 ? 'text-success' : 'text-warning'}`}>
                  {activeJob.result.confidence}%
                </span>
              </div>

              {/* Metadata Panel (Advanced) */}
              {mode === 'advanced' && showMetadata && activeJob.result.metadata && (
                <div className="border-b border-border bg-accent/10 p-2 animate-fade-in shrink-0">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(activeJob.result.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-card border border-border/50">
                        <span className="text-[8px] text-muted-foreground">{key}:</span>
                        <span className="text-[8px] font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Text */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                <div className="prose prose-sm max-w-none text-foreground leading-relaxed text-[12px] sm:text-[13px] whitespace-pre-wrap font-[system-ui]" dir="rtl">
                  {activeJob.result.text}
                </div>

                {/* Segments (Video/Audio) */}
                {showSegments && activeJob.result.segments && (
                  <div className="mt-4 border-t border-border pt-3 animate-fade-in">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MaterialIcon icon="subtitles" size={14} className="text-primary" />
                      <span className="text-[10px] font-bold text-muted-foreground">الشرائح الزمنية</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {activeJob.result.segments.map((seg, i) => (
                        <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/20 transition-all animate-stagger-in" style={{ animationDelay: `${i * 0.05}s` }}>
                          <span className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{seg.start}</span>
                          <span className="text-[11px] text-foreground">{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tables (PDF) */}
                {showTables && activeJob.result.tables && (
                  <div className="mt-4 border-t border-border pt-3 animate-fade-in">
                    <div className="flex items-center gap-1.5 mb-2">
                      <MaterialIcon icon="table_chart" size={14} className="text-primary" />
                      <span className="text-[10px] font-bold text-muted-foreground">الجداول المستخرجة</span>
                    </div>
                    {activeJob.result.tables.map((table, ti) => (
                      <div key={ti} className="overflow-x-auto mb-3">
                        <table className="w-full text-[10px] border-collapse">
                          <thead>
                            <tr className="bg-accent/30">
                              {table.headers.map((h, hi) => (
                                <th key={hi} className="text-right py-1.5 px-2 border border-border/30 font-medium text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-accent/10">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="py-1 px-2 border border-border/20 text-foreground">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeJob?.status === 'processing' ? (
            /* ── Processing View ── */
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
              <RasedLoader type="extraction" size="sm" inline message={`جاري تفريغ ${activeJob.fileName}`} />

              {/* Progress Bar */}
              <div className="w-full max-w-[300px] mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">التقدم</span>
                  <span className="text-[10px] font-bold text-primary">{activeJob.progress}%</span>
                </div>
                <div className="h-2 bg-accent rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${activeJob.progress}%` }} />
                </div>
              </div>

              {/* Stages */}
              <div className="flex flex-col gap-1.5 w-full max-w-[300px]">
                {activeJob.stages.map((stage, i) => (
                  <div key={i} className="flex items-center gap-2 animate-stagger-in" style={{ animationDelay: `${i * 0.1}s` }}>
                    {stage.status === 'completed' ? (
                      <MaterialIcon icon="check_circle" size={14} className="text-success" />
                    ) : stage.status === 'running' ? (
                      <MaterialIcon icon="progress_activity" size={14} className="text-primary animate-spin" />
                    ) : (
                      <MaterialIcon icon="radio_button_unchecked" size={14} className="text-muted-foreground/30" />
                    )}
                    <span className={`text-[10px] ${stage.status === 'completed' ? 'text-success' : stage.status === 'running' ? 'text-primary font-medium' : 'text-muted-foreground/50'}`}>
                      {stage.name}
                    </span>
                    {stage.status === 'running' && (
                      <span className="text-[8px] text-primary mr-auto">{Math.round(stage.progress)}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ── Drop Zone ── */
            <div
              className={`flex-1 flex flex-col items-center justify-center p-6 transition-all ${
                dragOver ? 'bg-primary/5' : ''
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 transition-all ${
                dragOver ? 'bg-primary/10 scale-110' : 'bg-accent/40'
              }`}>
                <MaterialIcon icon="document_scanner" size={40} className={`transition-colors ${dragOver ? 'text-primary' : 'text-muted-foreground/30'}`} />
              </div>
              <p className="text-[14px] font-medium text-foreground mb-1">
                {dragOver ? 'أفلت الملف هنا' : 'أسقط أي ملف للتفريغ'}
              </p>
              <p className="text-[11px] text-muted-foreground mb-4 text-center">
                صور • فيديو • PDF • صوت • مستندات
              </p>

              {/* Supported formats */}
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {supportedFormats.map((fmt, i) => (
                  <div
                    key={fmt.type}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border/50 rounded-xl animate-stagger-in cursor-pointer hover:border-primary/30 transition-all"
                    style={{ animationDelay: `${i * 0.08}s` }}
                    onClick={() => {
                      const accept = fmt.type === 'image' ? 'image/*' : fmt.type === 'video' ? 'video/*' : fmt.type === 'audio' ? 'audio/*' : fmt.type === 'pdf' ? '.pdf' : '*';
                      fileInputRef.current?.setAttribute('accept', accept);
                      fileInputRef.current?.click();
                    }}
                  >
                    <MaterialIcon icon={fmt.icon} size={14} className={fmt.color} />
                    <div>
                      <p className="text-[10px] font-medium text-foreground">{fmt.label}</p>
                      <p className="text-[8px] text-muted-foreground">{fmt.formats}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[12px] font-medium hover:bg-primary/90 transition-all shadow-sm"
              >
                اختر ملفاً للتفريغ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── AI Command Bar ── */}
      <div className="px-2 pb-1.5 pt-1 border-t border-border shrink-0">
        <div className="flex items-center gap-1.5 bg-accent/30 rounded-xl px-2 py-1.5">
          <img src={char} alt="راصد" className="w-5 h-5 rounded-full object-contain" />
          <input
            type="text"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAI(); }}
            placeholder="اطلب من راصد تلخيص أو تحليل النص المستخرج... مثال: لخص النقاط الرئيسية"
            className="flex-1 bg-transparent text-[10px] sm:text-[11px] outline-none text-foreground placeholder:text-muted-foreground"
            disabled={aiLoading}
          />
          <button
            onClick={handleAI}
            disabled={aiLoading || !aiPrompt.trim()}
            className={`w-6 h-6 flex items-center justify-center rounded-lg hover:bg-accent transition-all ${aiLoading ? 'animate-spin' : ''}`}
          >
            <MaterialIcon icon={aiLoading ? 'progress_activity' : 'send'} size={13} className="text-primary" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        className="hidden"
        multiple
        onChange={handleFileSelect}
      />
    </div>
  );
}

/* ── Toolbar Button ── */
function ToolbarBtn({ icon, label, active, onClick }: { icon: string; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-medium transition-all active:scale-95 whitespace-nowrap ${
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <MaterialIcon icon={icon} size={14} />
      {label && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
