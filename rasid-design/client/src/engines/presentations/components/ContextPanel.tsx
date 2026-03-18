/**
 * ContextPanel — Contextual side panel for element/slide properties
 * E02-0002: All controls in contextual drawer
 * E02-0011: Full user control
 */

import { X, Palette, Type, Image, LayoutGrid, FileDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { usePresentationStore } from '../store';
import { defaultThemes, defaultMasters, layoutNames } from '../templates/defaults';
import type { SlideLayoutType } from '../types';

export function ContextPanel() {
  const {
    deck, activeSlideId, selectedElementIds, contextPanel,
    setContextPanel, setTheme, updateElement, updateSlideBackground,
    addSlide,
  } = usePresentationStore();

  if (!deck) return null;

  const activeSlide = deck.slides.find(s => s.id === activeSlideId);
  const selectedElement = activeSlide?.elements.find(e => selectedElementIds.includes(e.id));

  const close = () => setContextPanel(null);

  return (
    <div className="h-full flex flex-col" dir="rtl">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold">
          {contextPanel === 'theme' && 'السمات'}
          {contextPanel === 'layout' && 'التخطيطات'}
          {contextPanel === 'export' && 'التصدير'}
          {contextPanel === 'content' && 'المحتوى'}
          {contextPanel === 'data' && 'البيانات'}
          {contextPanel === 'brand' && 'الهوية البصرية'}
          {!contextPanel && 'الخصائص'}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={close}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* THEME PANEL */}
          {contextPanel === 'theme' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">اختر سمة لتطبيقها على العرض بالكامل</p>
              <div className="grid grid-cols-2 gap-2">
                {defaultThemes.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setTheme(theme)}
                    className={`rounded-lg overflow-hidden border-2 transition-all ${
                      deck.theme.id === theme.id ? 'border-gold' : 'border-border hover:border-muted-foreground/30'
                    }`}
                  >
                    <div
                      className="aspect-video p-2 flex flex-col justify-center items-center gap-1"
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      <div className="w-3/4 h-1.5 rounded" style={{ backgroundColor: theme.colors.primary }} />
                      <div className="w-1/2 h-1 rounded" style={{ backgroundColor: theme.colors.accent }} />
                      <div className="flex gap-1 mt-1">
                        {[theme.colors.primary, theme.colors.secondary, theme.colors.accent].map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <div className="px-2 py-1 bg-card text-center">
                      <span className="text-[10px]">{theme.nameAr}</span>
                    </div>
                  </button>
                ))}
              </div>

              <Separator />

              {/* Current theme colors */}
              <div className="space-y-2">
                <Label className="text-xs">ألوان السمة الحالية</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(deck.theme.colors).slice(0, 8).map(([key, val]) => (
                    <div key={key} className="flex flex-col items-center gap-0.5">
                      <div className="w-6 h-6 rounded border border-border" style={{ backgroundColor: val }} />
                      <span className="text-[8px] text-muted-foreground">{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LAYOUT PANEL */}
          {contextPanel === 'layout' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">اختر تخطيطاً لإضافة شريحة جديدة</p>
              <div className="grid grid-cols-2 gap-2">
                {defaultMasters.map(master => (
                  <button
                    key={master.id}
                    onClick={() => addSlide(master.layoutType, activeSlideId || undefined)}
                    className="rounded-lg border border-border hover:border-gold transition-all overflow-hidden"
                  >
                    <div className="aspect-video bg-muted/30 p-2 relative">
                      {master.placeholders.map(ph => (
                        <div
                          key={ph.id}
                          className="absolute border border-dashed border-muted-foreground/30 rounded-sm flex items-center justify-center"
                          style={{
                            left: `${ph.position.x}%`,
                            top: `${ph.position.y}%`,
                            width: `${ph.size.width}%`,
                            height: `${ph.size.height}%`,
                          }}
                        >
                          <span className="text-[5px] text-muted-foreground">{ph.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-2 py-1 bg-card text-center">
                      <span className="text-[10px]">{master.nameAr}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EXPORT PANEL */}
          {contextPanel === 'export' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">تصدير العرض التقديمي</p>

              <div className="space-y-2">
                <Button className="w-full gap-2 justify-start" variant="outline">
                  <FileDown className="w-4 h-4" />
                  تصدير كـ PPTX
                </Button>
                <Button className="w-full gap-2 justify-start" variant="outline">
                  <FileDown className="w-4 h-4" />
                  تصدير كـ PDF
                </Button>
                <Button className="w-full gap-2 justify-start" variant="outline">
                  <Image className="w-4 h-4" />
                  تصدير كصور PNG
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">خيارات التصدير</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs">تضمين ملاحظات المتحدث</span>
                    <input type="checkbox" defaultChecked className="accent-gold" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">تضمين أرقام الشرائح</span>
                    <input type="checkbox" defaultChecked className="accent-gold" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs">تضمين التاريخ</span>
                    <input type="checkbox" className="accent-gold" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ELEMENT PROPERTIES (when element selected) */}
          {selectedElement && !contextPanel && (
            <div className="space-y-4">
              <Label className="text-xs font-semibold">خصائص العنصر</Label>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">X</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.position.x)}
                    onChange={e => updateElement(activeSlideId!, selectedElement.id, {
                      position: { ...selectedElement.position, x: Number(e.target.value) },
                    })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Y</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.position.y)}
                    onChange={e => updateElement(activeSlideId!, selectedElement.id, {
                      position: { ...selectedElement.position, y: Number(e.target.value) },
                    })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {/* Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">العرض</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.size.width)}
                    onChange={e => updateElement(activeSlideId!, selectedElement.id, {
                      size: { ...selectedElement.size, width: Number(e.target.value) },
                    })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">الارتفاع</Label>
                  <Input
                    type="number"
                    value={Math.round(selectedElement.size.height)}
                    onChange={e => updateElement(activeSlideId!, selectedElement.id, {
                      size: { ...selectedElement.size, height: Number(e.target.value) },
                    })}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <Label className="text-[10px]">الشفافية</Label>
                <Slider
                  value={[(selectedElement.opacity ?? 1) * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => updateElement(activeSlideId!, selectedElement.id, { opacity: v / 100 })}
                />
              </div>

              {/* Rotation */}
              <div className="space-y-1">
                <Label className="text-[10px]">الدوران</Label>
                <Slider
                  value={[selectedElement.rotation || 0]}
                  min={0}
                  max={360}
                  step={5}
                  onValueChange={([v]) => updateElement(activeSlideId!, selectedElement.id, { rotation: v })}
                />
              </div>

              {/* Text-specific */}
              {selectedElement.type === 'text' && selectedElement.textContent && (
                <>
                  <Separator />
                  <Label className="text-xs font-semibold">خصائص النص</Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-[10px]">حجم الخط</Label>
                      <Input
                        type="number"
                        value={selectedElement.textContent.fontSize || 16}
                        onChange={e => updateElement(activeSlideId!, selectedElement.id, {
                          textContent: { ...selectedElement.textContent!, fontSize: Number(e.target.value) },
                        })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">المحاذاة</Label>
                      <Select
                        value={selectedElement.textContent.align || 'right'}
                        onValueChange={v => updateElement(activeSlideId!, selectedElement.id, {
                          textContent: { ...selectedElement.textContent!, align: v as any },
                        })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">يمين</SelectItem>
                          <SelectItem value="center">وسط</SelectItem>
                          <SelectItem value="left">يسار</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SLIDE BACKGROUND (when no element selected and no specific panel) */}
          {!selectedElement && !contextPanel && activeSlide && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold">خلفية الشريحة</Label>
              <div className="space-y-2">
                <Label className="text-[10px]">لون الخلفية</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={activeSlide.background?.color || deck.theme.colors.background}
                    onChange={e => updateSlideBackground(activeSlideId!, { type: 'solid', color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <Input
                    value={activeSlide.background?.color || deck.theme.colors.background}
                    onChange={e => updateSlideBackground(activeSlideId!, { type: 'solid', color: e.target.value })}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
