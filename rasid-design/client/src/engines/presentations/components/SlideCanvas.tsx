/**
 * SlideCanvas — Main slide rendering area
 * E02-0001: Single canvas view
 * E02-0003: Real-time preview
 * E02-0011: Full user control — select, move, resize elements
 */

import { useRef, useState, useCallback } from 'react';
import { usePresentationStore } from '../store';
import { SlideElementRenderer } from './SlideElementRenderer';
import type { SlideElement } from '../types';

export function SlideCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    deck, activeSlideId, selectedElementIds, zoom, showGrid,
    setSelectedElements, moveElement, resizeElement,
  } = usePresentationStore();

  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);

  const activeSlide = deck?.slides.find(s => s.id === activeSlideId);
  if (!activeSlide || !deck) return null;

  const theme = deck.theme;
  const isRTL = deck.properties.direction === 'rtl';

  // Background style
  const bgStyle: React.CSSProperties = {};
  const bg = activeSlide.background || theme.slideBackground;
  if (bg.type === 'solid') {
    bgStyle.backgroundColor = bg.color;
  } else if (bg.type === 'gradient' && bg.gradient) {
    const stops = bg.gradient.stops.map(s => `${s.color} ${s.position}%`).join(', ');
    bgStyle.background = bg.gradient.type === 'linear'
      ? `linear-gradient(${bg.gradient.angle || 0}deg, ${stops})`
      : `radial-gradient(circle, ${stops})`;
  } else if (bg.type === 'image' && bg.imageUrl) {
    bgStyle.backgroundImage = `url(${bg.imageUrl})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas) {
      setSelectedElements([]);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: SlideElement) => {
    e.stopPropagation();
    if (el.locked) return;
    setSelectedElements([el.id]);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setDragging({
        id: el.id,
        startX: e.clientX,
        startY: e.clientY,
        elX: el.position.x,
        elY: el.position.y,
      });
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current || !activeSlideId) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragging.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragging.startY) / rect.height) * 100;
    moveElement(activeSlideId, dragging.id, {
      x: Math.max(0, Math.min(95, dragging.elX + (isRTL ? -dx : dx))),
      y: Math.max(0, Math.min(95, dragging.elY + dy)),
    });
  }, [dragging, activeSlideId, isRTL, moveElement]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 overflow-auto">
      <div
        ref={canvasRef}
        className="relative shadow-2xl rounded-sm overflow-hidden transition-transform"
        style={{
          width: `${(960 * zoom) / 100}px`,
          height: `${(540 * zoom) / 100}px`,
          ...bgStyle,
          direction: isRTL ? 'rtl' : 'ltr',
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        data-canvas="true"
      >
        {/* Grid overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none z-50 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)',
              backgroundSize: '5% 5%',
            }}
          />
        )}

        {/* Elements */}
        {activeSlide.elements
          .filter(el => !el.hidden)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map(el => (
            <SlideElementRenderer
              key={el.id}
              element={el}
              isSelected={selectedElementIds.includes(el.id)}
              onMouseDown={(e) => handleElementMouseDown(e, el)}
              theme={theme}
              zoom={zoom}
            />
          ))}
      </div>
    </div>
  );
}
