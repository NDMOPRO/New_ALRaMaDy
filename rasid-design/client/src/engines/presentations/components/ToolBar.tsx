/**
 * ToolBar — Element insertion and formatting toolbar
 * E02-0011: Full user control
 */

import {
  Type, Image, Shapes, BarChart3, Table2, Sparkles, Grid3X3,
  Ruler, Palette, LayoutGrid, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { usePresentationStore } from '../store';

export function ToolBar() {
  const {
    activeSlideId, showGrid, showGuides,
    addElement, toggleGrid, toggleGuides,
    setContextPanel,
  } = usePresentationStore();

  const insertText = () => {
    if (!activeSlideId) return;
    addElement(activeSlideId, {
      type: 'text',
      position: { x: 20, y: 30 },
      size: { width: 60, height: 15 },
      textContent: {
        html: '<p>نص جديد</p>',
        plainText: 'نص جديد',
        direction: 'rtl',
        align: 'right',
        fontSize: 18,
        fontWeight: 'regular',
      },
    });
  };

  const insertImage = () => {
    if (!activeSlideId) return;
    addElement(activeSlideId, {
      type: 'image',
      position: { x: 25, y: 20 },
      size: { width: 50, height: 55 },
      imageContent: {
        url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
        alt: 'صورة',
        fit: 'cover',
      },
    });
  };

  const insertShape = () => {
    if (!activeSlideId) return;
    addElement(activeSlideId, {
      type: 'shape',
      position: { x: 30, y: 30 },
      size: { width: 30, height: 30 },
      shapeContent: {
        shapeType: 'rectangle',
        fill: '#c9a84c',
        stroke: '#1a237e',
        strokeWidth: 2,
      },
    });
  };

  const insertChart = () => {
    if (!activeSlideId) return;
    addElement(activeSlideId, {
      type: 'chart',
      position: { x: 10, y: 20 },
      size: { width: 80, height: 65 },
      chartContent: {
        chartType: 'bar',
        data: {
          labels: ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'],
          datasets: [{
            label: 'الإيرادات',
            data: [45, 72, 63, 89],
            color: '#1a237e',
          }],
        },
        options: {
          direction: 'rtl',
          showLegend: true,
          showGrid: true,
        },
      },
    });
  };

  const insertTable = () => {
    if (!activeSlideId) return;
    addElement(activeSlideId, {
      type: 'table',
      position: { x: 10, y: 20 },
      size: { width: 80, height: 55 },
      tableContent: {
        headers: ['المؤشر', 'القيمة', 'النسبة', 'الحالة'],
        rows: [
          ['مؤشر 1', '1,250', '85%', 'مرتفع'],
          ['مؤشر 2', '980', '72%', 'متوسط'],
          ['مؤشر 3', '1,500', '95%', 'ممتاز'],
        ],
        headerStyle: { background: '#1a237e', color: '#ffffff' },
        cellStyle: { borderColor: '#e2e8f0', alternateRowColor: '#f8fafc' },
        direction: 'rtl',
      },
    });
  };

  const tools = [
    { icon: Type, label: 'نص', onClick: insertText },
    { icon: Image, label: 'صورة', onClick: insertImage },
    { icon: Shapes, label: 'شكل', onClick: insertShape },
    { icon: BarChart3, label: 'مخطط', onClick: insertChart },
    { icon: Table2, label: 'جدول', onClick: insertTable },
  ];

  return (
    <div className="h-10 border-b border-border bg-card flex items-center px-2 gap-1 shrink-0">
      {tools.map(({ icon: Icon, label, onClick }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClick}>
              <Icon className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}

      <Separator orientation="vertical" className="h-5 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showGrid ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={toggleGrid}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>الشبكة</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showGuides ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={toggleGuides}
          >
            <Ruler className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>خطوط الإرشاد</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-5 mx-1" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setContextPanel('theme')}>
            <Palette className="w-3.5 h-3.5" />
            السمة
          </Button>
        </TooltipTrigger>
        <TooltipContent>تغيير السمة</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setContextPanel('layout')}>
            <LayoutGrid className="w-3.5 h-3.5" />
            التخطيط
          </Button>
        </TooltipTrigger>
        <TooltipContent>تغيير التخطيط</TooltipContent>
      </Tooltip>

      <div className="mr-auto" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => setContextPanel('style')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            توليد ذكي
          </Button>
        </TooltipTrigger>
        <TooltipContent>توليد محتوى بالذكاء الاصطناعي</TooltipContent>
      </Tooltip>
    </div>
  );
}
