/**
 * SlideList — Slide thumbnails panel
 * E02-0011: Full user control — add, delete, reorder, duplicate slides
 */

import { Plus, Copy, Trash2, Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePresentationStore } from '../store';
import { layoutNames } from '../templates/defaults';

export function SlideList() {
  const {
    deck, activeSlideId, setActiveSlide,
    addSlide, duplicateSlide, deleteSlide, toggleSlideHidden,
  } = usePresentationStore();

  if (!deck) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">الشرائح</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => addSlide('blank', activeSlideId || undefined)}>
          <Plus className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {deck.slides.map((slide, index) => {
            const isActive = slide.id === activeSlideId;
            const bg = slide.background || deck.theme.slideBackground;
            const bgColor = bg.type === 'solid' ? bg.color : bg.type === 'gradient' ? bg.gradient?.stops[0]?.color : '#fff';

            return (
              <div
                key={slide.id}
                className={`relative group rounded-md overflow-hidden cursor-pointer transition-all ${
                  isActive
                    ? 'ring-2 ring-gold shadow-md'
                    : 'ring-1 ring-border hover:ring-muted-foreground/30'
                } ${slide.hidden ? 'opacity-40' : ''}`}
                onClick={() => setActiveSlide(slide.id)}
              >
                {/* Slide number */}
                <div className="absolute top-1 right-1 z-10 bg-black/50 text-white text-[9px] rounded px-1 font-mono">
                  {index + 1}
                </div>

                {/* Mini preview */}
                <div
                  className="w-full aspect-video relative"
                  style={{ backgroundColor: bgColor || '#fff' }}
                >
                  {/* Simplified element previews */}
                  {slide.elements.slice(0, 5).map(el => (
                    <div
                      key={el.id}
                      className="absolute"
                      style={{
                        left: `${el.position.x}%`,
                        top: `${el.position.y}%`,
                        width: `${el.size.width}%`,
                        height: `${el.size.height}%`,
                      }}
                    >
                      {el.type === 'text' && (
                        <div
                          className="w-full h-full overflow-hidden"
                          style={{
                            fontSize: '4px',
                            lineHeight: 1.2,
                            color: el.textContent?.color || deck.theme.colors.text,
                            direction: (el.textContent?.direction || 'rtl') as 'rtl' | 'ltr',
                          }}
                        >
                          {el.textContent?.plainText}
                        </div>
                      )}
                      {el.type === 'shape' && (
                        <div
                          className="w-full h-full rounded-sm"
                          style={{ backgroundColor: el.shapeContent?.fill || deck.theme.colors.primary }}
                        />
                      )}
                      {el.type === 'image' && (
                        <div className="w-full h-full bg-muted rounded-sm" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Layout label */}
                <div className="px-1.5 py-0.5 bg-card border-t border-border">
                  <span className="text-[9px] text-muted-foreground truncate block">
                    {layoutNames[slide.layoutType]?.ar || slide.layoutType}
                  </span>
                </div>

                {/* Actions on hover */}
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 bg-black/50 text-white hover:bg-black/70">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="text-xs">
                      <DropdownMenuItem onClick={() => duplicateSlide(slide.id)}>
                        <Copy className="w-3 h-3 ml-2" />
                        نسخ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleSlideHidden(slide.id)}>
                        {slide.hidden ? <Eye className="w-3 h-3 ml-2" /> : <EyeOff className="w-3 h-3 ml-2" />}
                        {slide.hidden ? 'إظهار' : 'إخفاء'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteSlide(slide.id)}
                        className="text-destructive"
                        disabled={deck.slides.length <= 1}
                      >
                        <Trash2 className="w-3 h-3 ml-2" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
