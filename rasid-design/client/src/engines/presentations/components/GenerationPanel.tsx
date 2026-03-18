/**
 * GenerationPanel — AI-powered presentation generation
 * E02-0004: Prompt-to-deck generation
 * E02-0005: 8-stage pipeline
 * E02-0006: 7 control knobs
 * E02-0007: Evidence pack
 * E02-0008: Outline editor
 */

import { useState } from 'react';
import {
  X, Sparkles, Wand2, BookOpen, Settings, Sliders,
  FileText, BarChart3, Palette, Volume2, Quote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePresentationStore } from '../store';
import type { Tone, Density, InfographicLevel, MotionLevel, ChartStyle } from '../types';

export function GenerationPanel() {
  const {
    generationParams, setGenerationParams, startGeneration,
    isGenerating, setContextPanel, outline, setOutline,
  } = usePresentationStore();

  const [activeTab, setActiveTab] = useState('prompt');

  const tones: { value: Tone; label: string }[] = [
    { value: 'formal', label: 'رسمي' },
    { value: 'semi-formal', label: 'شبه رسمي' },
    { value: 'persuasive', label: 'إقناعي' },
    { value: 'educational', label: 'تعليمي' },
    { value: 'storytelling', label: 'سردي' },
  ];

  const densities: { value: Density; label: string }[] = [
    { value: 'minimal', label: 'مختصر' },
    { value: 'standard', label: 'معياري' },
    { value: 'detailed', label: 'مفصّل' },
    { value: 'comprehensive', label: 'شامل' },
  ];

  const infographicLevels: { value: InfographicLevel; label: string }[] = [
    { value: 'none', label: 'بدون' },
    { value: 'low', label: 'قليل' },
    { value: 'medium', label: 'متوسط' },
    { value: 'high', label: 'كثيف' },
  ];

  const motionLevels: { value: MotionLevel; label: string }[] = [
    { value: 'none', label: 'بدون' },
    { value: 'basic', label: 'أساسي' },
    { value: 'moderate', label: 'متوسط' },
    { value: 'cinematic', label: 'سينمائي' },
  ];

  const chartStyles: { value: ChartStyle; label: string }[] = [
    { value: 'boardroom', label: 'غرفة الاجتماعات' },
    { value: 'modern', label: 'عصري' },
    { value: 'minimal', label: 'بسيط' },
    { value: 'colorful', label: 'ملوّن' },
    { value: 'dark', label: 'داكن' },
  ];

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold">التوليد الذكي</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setContextPanel(null)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-3 mt-2 grid grid-cols-3">
          <TabsTrigger value="prompt" className="text-xs">الطلب</TabsTrigger>
          <TabsTrigger value="knobs" className="text-xs">التحكم</TabsTrigger>
          <TabsTrigger value="outline" className="text-xs">الهيكل</TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* PROMPT TAB */}
          <TabsContent value="prompt" className="p-3 space-y-4 mt-0">
            <div className="space-y-2">
              <Label className="text-xs">وصف العرض المطلوب</Label>
              <Textarea
                value={generationParams.prompt}
                onChange={e => setGenerationParams({ prompt: e.target.value })}
                placeholder="مثال: أنشئ عرضاً تقديمياً عن رؤية السعودية 2030 يتضمن الإنجازات الرئيسية والمستهدفات المستقبلية مع رسوم بيانية..."
                className="min-h-[120px] text-sm"
                dir="rtl"
              />
              <p className="text-[10px] text-muted-foreground">
                كلما كان الوصف أكثر تفصيلاً، كانت النتيجة أفضل
              </p>
            </div>

            {/* Quick templates */}
            <div className="space-y-2">
              <Label className="text-xs">قوالب سريعة</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'تقرير أداء ربعي',
                  'خطة استراتيجية',
                  'عرض مشروع',
                  'تقرير مالي',
                  'عرض تسويقي',
                  'خطة عمل',
                ].map(t => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent text-[10px]"
                    onClick={() => setGenerationParams({ prompt: t })}
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            {/* Language */}
            <div className="space-y-2">
              <Label className="text-xs">لغة المحتوى</Label>
              <Select
                value={generationParams.language}
                onValueChange={v => setGenerationParams({ language: v as any })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar-en">ثنائي اللغة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              className="w-full gap-2 bg-gold text-gold-foreground hover:bg-gold/90"
              onClick={startGeneration}
              disabled={isGenerating || !generationParams.prompt.trim()}
            >
              <Wand2 className="w-4 h-4" />
              توليد العرض
            </Button>
          </TabsContent>

          {/* KNOBS TAB — 7 Control Knobs (E02-0006) */}
          <TabsContent value="knobs" className="p-3 space-y-4 mt-0">
            <p className="text-[10px] text-muted-foreground">تحكم في أسلوب ومحتوى العرض المولّد</p>

            {/* 1. Tone */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Volume2 className="w-3 h-3" />
                النبرة
              </Label>
              <Select
                value={generationParams.tone}
                onValueChange={v => setGenerationParams({ tone: v as Tone })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tones.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Density */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                كثافة المحتوى
              </Label>
              <Select
                value={generationParams.density}
                onValueChange={v => setGenerationParams({ density: v as Density })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {densities.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 3. Infographic Level */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" />
                مستوى الإنفوجرافيك
              </Label>
              <Select
                value={generationParams.infographicLevel}
                onValueChange={v => setGenerationParams({ infographicLevel: v as InfographicLevel })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {infographicLevels.map(l => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Motion Level */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                مستوى الحركة
              </Label>
              <Select
                value={generationParams.motionLevel}
                onValueChange={v => setGenerationParams({ motionLevel: v as MotionLevel })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {motionLevels.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Chart Style */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Palette className="w-3 h-3" />
                أسلوب المخططات
              </Label>
              <Select
                value={generationParams.chartStyle}
                onValueChange={v => setGenerationParams({ chartStyle: v as ChartStyle })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chartStyles.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 6. Citations */}
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Quote className="w-3 h-3" />
                تضمين الاستشهادات
              </Label>
              <Switch
                checked={generationParams.citations}
                onCheckedChange={v => setGenerationParams({ citations: v })}
              />
            </div>

            {/* 7. Speaker Notes */}
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <BookOpen className="w-3 h-3" />
                ملاحظات المتحدث
              </Label>
              <Switch
                checked={generationParams.speakerNotes}
                onCheckedChange={v => setGenerationParams({ speakerNotes: v })}
              />
            </div>
          </TabsContent>

          {/* OUTLINE TAB — E02-0008 */}
          <TabsContent value="outline" className="p-3 space-y-4 mt-0">
            {outline ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">هيكل العرض</Label>
                  <Badge variant="outline" className="text-[10px]">
                    {outline.sections.length} أقسام
                  </Badge>
                </div>
                {outline.sections.map((section, i) => (
                  <div key={i} className="border border-border rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-gold">{i + 1}</span>
                      <span className="text-xs font-medium">{section.title}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mr-5">{section.description}</p>
                    <div className="flex gap-1 mr-5">
                      {(section.slideTypes || []).map((st: string, j: number) => (
                        <Badge key={j} variant="secondary" className="text-[8px]">{st}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">لم يتم إنشاء هيكل بعد</p>
                <p className="text-[10px] text-muted-foreground">
                  ابدأ بكتابة الطلب في تبويب "الطلب" ثم اضغط "توليد العرض"
                </p>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
