/**
 * PreviewMode — Full-screen presentation preview
 * E02-0003: Real-time preview
 * E02-0010: Presenter mode with notes
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePresentationStore } from '../store';
import { SlideElementRenderer } from './SlideElementRenderer';

export function PreviewMode() {
  const { deck, togglePreviewMode } = usePresentationStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [direction, setDirection] = useState(1);

  const visibleSlides = deck?.slides.filter(s => !s.hidden) || [];
  const currentSlide = visibleSlides[currentIndex];

  const goNext = useCallback(() => {
    if (currentIndex < visibleSlides.length - 1) {
      setDirection(1);
      setCurrentIndex(i => i + 1);
    }
  }, [currentIndex, visibleSlides.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(i => i - 1);
    }
  }, [currentIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const isRTL = deck?.properties.direction === 'rtl';
        if ((e.key === 'ArrowLeft' && !isRTL) || (e.key === 'ArrowRight' && isRTL)) goPrev();
        else goNext();
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      if (e.key === 'Escape') togglePreviewMode();
      if (e.key === 'n') setShowNotes(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, togglePreviewMode, deck]);

  if (!deck || !currentSlide) return null;

  const theme = deck.theme;
  const bg = currentSlide.background || theme.slideBackground;
  const bgStyle: React.CSSProperties = {};
  if (bg.type === 'solid') bgStyle.backgroundColor = bg.color;
  else if (bg.type === 'gradient' && bg.gradient) {
    const stops = bg.gradient.stops.map(s => `${s.color} ${s.position}%`).join(', ');
    bgStyle.background = `linear-gradient(${bg.gradient.angle || 0}deg, ${stops})`;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Slide */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 100 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-[1200px] aspect-video relative"
            style={{
              ...bgStyle,
              direction: deck.properties.direction as 'rtl' | 'ltr' | undefined,
            }}
          >
            {currentSlide.elements
              .filter(el => !el.hidden)
              .sort((a, b) => a.zIndex - b.zIndex)
              .map(el => (
                <SlideElementRenderer
                  key={el.id}
                  element={el}
                  isSelected={false}
                  onMouseDown={() => {}}
                  theme={theme}
                  zoom={100}
                />
              ))}
          </motion.div>
        </AnimatePresence>

        {/* Navigation areas */}
        <div className="absolute inset-y-0 right-0 w-1/4 cursor-pointer" onClick={goPrev} />
        <div className="absolute inset-y-0 left-0 w-1/4 cursor-pointer" onClick={goNext} />
      </div>

      {/* Notes panel */}
      {showNotes && currentSlide.notes && (
        <div className="h-32 bg-gray-900 border-t border-gray-700 p-4 overflow-auto" dir="rtl">
          <p className="text-sm text-gray-300">{currentSlide.notes}</p>
        </div>
      )}

      {/* Bottom bar */}
      <div className="h-10 bg-black/90 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={togglePreviewMode}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={goPrev} disabled={currentIndex === 0}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-400 font-mono">
            {currentIndex + 1} / {visibleSlides.length}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={goNext} disabled={currentIndex >= visibleSlides.length - 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showNotes ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7 text-white"
            onClick={() => setShowNotes(v => !v)}
          >
            <StickyNote className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
