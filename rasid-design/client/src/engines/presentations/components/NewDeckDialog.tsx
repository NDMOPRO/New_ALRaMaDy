/**
 * NewDeckDialog — Create new presentation dialog
 * E02-0009: Arabic ELITE — default Arabic
 */

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePresentationStore } from '../store';
import { defaultThemes } from '../templates/defaults';
import type { Language } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDeckDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState('عرض تقديمي جديد');
  const [language, setLanguage] = useState<Language>('ar');
  const [selectedTheme, setSelectedTheme] = useState(defaultThemes[0].id);
  const { createDeck } = usePresentationStore();

  const handleCreate = () => {
    createDeck(title, language, selectedTheme);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>إنشاء عرض تقديمي جديد</DialogTitle>
          <DialogDescription>اختر العنوان واللغة والسمة للبدء</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label>عنوان العرض</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="أدخل عنوان العرض..."
              dir="rtl"
            />
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label>اللغة</Label>
            <RadioGroup value={language} onValueChange={v => setLanguage(v as Language)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ar" id="lang-ar" />
                <Label htmlFor="lang-ar" className="cursor-pointer">العربية</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="en" id="lang-en" />
                <Label htmlFor="lang-en" className="cursor-pointer">English</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ar-en" id="lang-both" />
                <Label htmlFor="lang-both" className="cursor-pointer">ثنائي اللغة</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <Label>السمة</Label>
            <div className="grid grid-cols-3 gap-2">
              {defaultThemes.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme.id)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedTheme === theme.id ? 'border-gold shadow-md' : 'border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div
                    className="aspect-video p-2 flex flex-col justify-end"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="w-full h-1 rounded mb-1" style={{ backgroundColor: theme.colors.primary }} />
                    <div className="w-2/3 h-0.5 rounded" style={{ backgroundColor: theme.colors.accent }} />
                  </div>
                  <div className="px-2 py-1 bg-card text-center">
                    <span className="text-[10px] font-medium">{theme.nameAr}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleCreate} className="bg-gold text-gold-foreground hover:bg-gold/90">
            إنشاء العرض
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
