/**
 * ThemeBrandPanel — Theme & Brand Kit Management
 * E02-0014: Theme system with 10+ built-in themes
 * E02-0015: Brand kit with logo, colors, fonts
 * E02-0016: Custom theme editor
 * E02-0017: Theme preview and hot-swap
 */

import { useState } from 'react';
import { usePresentationStore } from '../store';
import { defaultThemes } from '../templates/defaults';
import type { Theme, BrandKit } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Palette, Building2, Paintbrush, Check, Upload, Plus, Eye,
  Type, Layers, Sparkles,
} from 'lucide-react';

export function ThemeBrandPanel() {
  const { deck, setTheme, setBrandKit } = usePresentationStore();
  const [activeTab, setActiveTab] = useState('themes');
  const [customThemeOpen, setCustomThemeOpen] = useState(false);
  const [brandFormOpen, setBrandFormOpen] = useState(false);

  if (!deck) return null;

  return (
    <div className="h-full flex flex-col" dir="rtl">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-3 mx-2 mt-2">
          <TabsTrigger value="themes" className="text-xs gap-1">
            <Palette className="w-3 h-3" />
            السمات
          </TabsTrigger>
          <TabsTrigger value="brands" className="text-xs gap-1">
            <Building2 className="w-3 h-3" />
            الهوية
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs gap-1">
            <Paintbrush className="w-3 h-3" />
            مخصص
          </TabsTrigger>
        </TabsList>

        {/* === THEMES TAB === */}
        <TabsContent value="themes" className="flex-1 mt-0">
          <ScrollArea className="h-full px-3 py-2">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                اختر سمة جاهزة — يتم تطبيقها فوراً على جميع الشرائح
              </p>

              {/* Theme categories */}
              {['corporate', 'creative', 'minimal', 'government', 'academic'].map(category => {
                const categoryThemes = defaultThemes.filter(t => t.category === category);
                if (categoryThemes.length === 0) return null;

                const categoryNames: Record<string, string> = {
                  corporate: 'مؤسسي',
                  creative: 'إبداعي',
                  minimal: 'بسيط',
                  government: 'حكومي',
                  academic: 'أكاديمي',
                };

                return (
                  <div key={category}>
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                      {categoryNames[category] || category}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {categoryThemes.map(theme => (
                        <ThemeCard
                          key={theme.id}
                          theme={theme}
                          isActive={deck.theme.id === theme.id}
                          onSelect={() => setTheme(theme)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* === BRANDS TAB === */}
        <TabsContent value="brands" className="flex-1 mt-0">
          <ScrollArea className="h-full px-3 py-2">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                أنشئ هوية بصرية مخصصة تتضمن الشعار والألوان والخطوط
              </p>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => setBrandFormOpen(!brandFormOpen)}
              >
                <Plus className="w-3 h-3" />
                إنشاء هوية جديدة
              </Button>

              {brandFormOpen && (
                <BrandKitForm
                  onSave={(kit) => {
                    setBrandKit(kit);
                    setBrandFormOpen(false);
                  }}
                  onCancel={() => setBrandFormOpen(false)}
                />
              )}

              {/* Pre-built brand kits */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground">هويات جاهزة</h4>
                {preBuiltBrands.map(brand => (
                  <div
                    key={brand.id}
                    className="p-3 rounded-lg border hover:border-gold/50 cursor-pointer transition-colors"
                    onClick={() => setBrandKit(brand)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: brand.primaryColor }}
                      />
                      <span className="text-sm font-medium">{brand.nameAr || brand.name}</span>
                    </div>
                    <div className="flex gap-1">
                      {[brand.primaryColor, brand.secondaryColor, brand.accentColor].map((c, i) => (
                        <div
                          key={i}
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        {brand.fontFamily}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* === CUSTOM THEME TAB === */}
        <TabsContent value="custom" className="flex-1 mt-0">
          <ScrollArea className="h-full px-3 py-2">
            <CustomThemeEditor
              currentTheme={deck.theme}
              onApply={(theme) => setTheme(theme)}
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// THEME CARD
// ============================================================

function ThemeCard({ theme, isActive, onSelect }: {
  theme: Theme; isActive: boolean; onSelect: () => void;
}) {
  return (
    <div
      className={`relative p-2 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'border-gold ring-1 ring-gold/30' : 'border-border hover:border-gold/30'
      }`}
      onClick={onSelect}
    >
      {isActive && (
        <div className="absolute top-1 left-1 w-4 h-4 bg-gold rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}

      {/* Mini preview */}
      <div
        className="w-full h-16 rounded mb-1.5 flex flex-col items-center justify-center"
        style={{ backgroundColor: theme.colors.background }}
      >
        <div
          className="w-3/4 h-2 rounded mb-1"
          style={{ backgroundColor: theme.colors.primary }}
        />
        <div
          className="w-1/2 h-1 rounded"
          style={{ backgroundColor: theme.colors.secondary }}
        />
        <div className="flex gap-0.5 mt-1">
          {[theme.colors.primary, theme.colors.secondary, theme.colors.accent].map((c, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <p className="text-[10px] font-medium text-center truncate">
        {theme.nameAr || theme.name}
      </p>
    </div>
  );
}

// ============================================================
// BRAND KIT FORM
// ============================================================

function BrandKitForm({ onSave, onCancel }: {
  onSave: (kit: BrandKit) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [primary, setPrimary] = useState('#1a5276');
  const [secondary, setSecondary] = useState('#2e86c1');
  const [accent, setAccent] = useState('#d4a017');
  const [font, setFont] = useState('Cairo');

  const handleSave = () => {
    onSave({
      id: `brand-${Date.now()}`,
      name: name || 'Custom Brand',
      nameAr: nameAr || 'هوية مخصصة',
      logoUrl: '',
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      fontFamily: font,
      fontFamilyAr: font,
      colors: { primary, secondary, accent },
    });
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">الاسم بالعربية</Label>
          <Input value={nameAr} onChange={e => setNameAr(e.target.value)} className="h-8 text-xs" placeholder="هوية المنظمة" />
        </div>
        <div>
          <Label className="text-xs">Name (EN)</Label>
          <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" placeholder="Organization" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">الرئيسي</Label>
          <div className="flex gap-1 items-center">
            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-[10px] text-muted-foreground">{primary}</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">الثانوي</Label>
          <div className="flex gap-1 items-center">
            <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-[10px] text-muted-foreground">{secondary}</span>
          </div>
        </div>
        <div>
          <Label className="text-xs">التمييزي</Label>
          <div className="flex gap-1 items-center">
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
            <span className="text-[10px] text-muted-foreground">{accent}</span>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">الخط</Label>
        <select
          value={font}
          onChange={e => setFont(e.target.value)}
          className="w-full h-8 text-xs rounded border bg-background px-2"
        >
          <option value="Cairo">Cairo</option>
          <option value="Tajawal">Tajawal</option>
          <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
          <option value="Noto Sans Arabic">Noto Sans Arabic</option>
          <option value="Almarai">Almarai</option>
          <option value="Changa">Changa</option>
          <option value="Amiri">Amiri</option>
        </select>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleSave}>حفظ</Button>
        <Button size="sm" variant="outline" className="text-xs" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

// ============================================================
// CUSTOM THEME EDITOR
// ============================================================

function CustomThemeEditor({ currentTheme, onApply }: {
  currentTheme: Theme;
  onApply: (theme: Theme) => void;
}) {
  const [colors, setColors] = useState({ ...currentTheme.colors });
  const [fonts, setFonts] = useState({ ...currentTheme.fonts });

  const updateColor = (key: string, value: string) => {
    setColors(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply({
      ...currentTheme,
      id: `custom-${Date.now()}`,
      name: 'Custom Theme',
      nameAr: 'سمة مخصصة',
      colors,
      fonts,
    });
  };

  const colorFields = [
    { key: 'primary', label: 'الرئيسي' },
    { key: 'secondary', label: 'الثانوي' },
    { key: 'accent', label: 'التمييزي' },
    { key: 'background', label: 'الخلفية' },
    { key: 'surface', label: 'السطح' },
    { key: 'text', label: 'النص' },
    { key: 'textSecondary', label: 'النص الثانوي' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Paintbrush className="w-4 h-4 text-gold" />
        <h4 className="text-sm font-semibold">محرر السمة المخصصة</h4>
      </div>

      {/* Colors */}
      <div>
        <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
          <Palette className="w-3 h-3" /> الألوان
        </h5>
        <div className="space-y-2">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={(colors as any)[key] || '#000000'}
                onChange={e => updateColor(key, e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border"
              />
              <span className="text-xs flex-1">{label}</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {(colors as any)[key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <h5 className="text-xs font-medium mb-2 flex items-center gap-1">
          <Type className="w-3 h-3" /> الخطوط
        </h5>
        <div className="space-y-2">
          <div>
            <Label className="text-[10px]">خط العناوين</Label>
            <select
              value={fonts.headingFamily}
              onChange={e => setFonts(prev => ({ ...prev, headingFamily: e.target.value }))}
              className="w-full h-7 text-xs rounded border bg-background px-2"
            >
              <option value="Cairo">Cairo</option>
              <option value="Tajawal">Tajawal</option>
              <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
              <option value="Almarai">Almarai</option>
              <option value="Amiri">Amiri</option>
            </select>
          </div>
          <div>
            <Label className="text-[10px]">خط المتن</Label>
            <select
              value={fonts.bodyFamily}
              onChange={e => setFonts(prev => ({ ...prev, bodyFamily: e.target.value }))}
              className="w-full h-7 text-xs rounded border bg-background px-2"
            >
              <option value="Cairo">Cairo</option>
              <option value="Tajawal">Tajawal</option>
              <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
              <option value="Noto Sans Arabic">Noto Sans Arabic</option>
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 rounded-lg border" style={{ backgroundColor: colors.background }}>
        <div className="text-xs font-bold mb-1" style={{ color: colors.primary, fontFamily: fonts.headingFamily }}>
          معاينة العنوان
        </div>
        <div className="text-[10px] mb-2" style={{ color: colors.text, fontFamily: fonts.bodyFamily }}>
          هذا نص تجريبي لمعاينة السمة المخصصة
        </div>
        <div className="flex gap-1">
          <div className="px-2 py-0.5 rounded text-[9px] text-white" style={{ backgroundColor: colors.primary }}>
            رئيسي
          </div>
          <div className="px-2 py-0.5 rounded text-[9px] text-white" style={{ backgroundColor: colors.accent }}>
            تمييزي
          </div>
        </div>
      </div>

      <Button size="sm" className="w-full text-xs gap-1" onClick={handleApply}>
        <Sparkles className="w-3 h-3" />
        تطبيق السمة المخصصة
      </Button>
    </div>
  );
}

// ============================================================
// PRE-BUILT BRAND KITS
// ============================================================

const preBuiltBrands: BrandKit[] = [
  {
    id: 'brand-ndmo',
    name: 'NDMO Style',
    nameAr: 'نمط المركز الوطني',
    logoUrl: '',
    primaryColor: '#1a5276',
    secondaryColor: '#2e86c1',
    accentColor: '#d4a017',
    fontFamily: 'Cairo',
    fontFamilyAr: 'Cairo',
    colors: {},
  },
  {
    id: 'brand-vision2030',
    name: 'Vision 2030',
    nameAr: 'رؤية 2030',
    logoUrl: '',
    primaryColor: '#006c35',
    secondaryColor: '#00a651',
    accentColor: '#ffd700',
    fontFamily: 'Tajawal',
    fontFamilyAr: 'Tajawal',
    colors: {},
  },
  {
    id: 'brand-modern-corp',
    name: 'Modern Corporate',
    nameAr: 'مؤسسي حديث',
    logoUrl: '',
    primaryColor: '#2c3e50',
    secondaryColor: '#3498db',
    accentColor: '#e74c3c',
    fontFamily: 'IBM Plex Sans Arabic',
    fontFamilyAr: 'IBM Plex Sans Arabic',
    colors: {},
  },
  {
    id: 'brand-elegant',
    name: 'Elegant Gold',
    nameAr: 'أناقة ذهبية',
    logoUrl: '',
    primaryColor: '#1a1a2e',
    secondaryColor: '#16213e',
    accentColor: '#c9a227',
    fontFamily: 'Amiri',
    fontFamilyAr: 'Amiri',
    colors: {},
  },
];
