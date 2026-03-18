/**
 * DragResizeWrapper — Drag & resize element on slide canvas
 * E02-0011: Full user control over every element
 * E02-0002: Move, resize, rotate, reorder
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePresentationStore } from '../store';
import type { SlideElement } from '../types';

interface Props {
  element: SlideElement;
  slideId: string;
  isSelected: boolean;
  zoom: number;
  children: React.ReactNode;
}

export function DragResizeWrapper({ element, slideId, isSelected, zoom, children }: Props) {
  const { selectElement, updateElement } = usePresentationStore();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState('');
  const dragStart = useRef({ x: 0, y: 0, elX: 0, elY: 0, elW: 0, elH: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (element.locked) return;
    e.stopPropagation();
    selectElement(element.id, e.shiftKey);

    const parentRect = wrapperRef.current?.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      elX: element.position.x,
      elY: element.position.y,
      elW: element.size.width,
      elH: element.size.height,
    };
  }, [element, selectElement]);

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: string) => {
    if (element.locked) return;
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);
    setResizeHandle(handle);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      elX: element.position.x,
      elY: element.position.y,
      elW: element.size.width,
      elH: element.size.height,
    };
  }, [element]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const parentRect = wrapperRef.current?.parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const scale = zoom / 100;
      const dx = ((e.clientX - dragStart.current.x) / parentRect.width) * 100 / scale;
      const dy = ((e.clientY - dragStart.current.y) / parentRect.height) * 100 / scale;

      if (isDragging) {
        updateElement(slideId, element.id, {
          position: {
            x: Math.max(0, Math.min(100 - element.size.width, dragStart.current.elX + dx)),
            y: Math.max(0, Math.min(100 - element.size.height, dragStart.current.elY + dy)),
          },
        });
      }

      if (isResizing) {
        let newX = dragStart.current.elX;
        let newY = dragStart.current.elY;
        let newW = dragStart.current.elW;
        let newH = dragStart.current.elH;

        if (resizeHandle.includes('e')) newW = Math.max(5, dragStart.current.elW + dx);
        if (resizeHandle.includes('w')) {
          newW = Math.max(5, dragStart.current.elW - dx);
          newX = dragStart.current.elX + dx;
        }
        if (resizeHandle.includes('s')) newH = Math.max(3, dragStart.current.elH + dy);
        if (resizeHandle.includes('n')) {
          newH = Math.max(3, dragStart.current.elH - dy);
          newY = dragStart.current.elY + dy;
        }

        updateElement(slideId, element.id, {
          position: { x: newX, y: newY },
          size: { width: newW, height: newH },
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle('');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle, slideId, element.id, zoom, updateElement, element.size.width, element.size.height]);

  const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const handlePositions: Record<string, React.CSSProperties> = {
    n: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    ne: { top: -4, right: -4, cursor: 'nesw-resize' },
    e: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    se: { bottom: -4, right: -4, cursor: 'nwse-resize' },
    s: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
    sw: { bottom: -4, left: -4, cursor: 'nesw-resize' },
    w: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' },
    nw: { top: -4, left: -4, cursor: 'nwse-resize' },
  };

  return (
    <div
      ref={wrapperRef}
      className={`absolute group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${element.locked ? 'cursor-not-allowed' : ''}`}
      style={{
        left: `${element.position.x}%`,
        top: `${element.position.y}%`,
        width: `${element.size.width}%`,
        height: `${element.size.height}%`,
        zIndex: element.zIndex,
        opacity: element.opacity ?? 1,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Selection border */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-gold rounded-sm pointer-events-none z-50" />
      )}

      {/* Resize handles */}
      {isSelected && !element.locked && handles.map(h => (
        <div
          key={h}
          className="absolute w-2 h-2 bg-gold border border-white rounded-full z-50"
          style={handlePositions[h]}
          onMouseDown={e => handleResizeStart(e, h)}
        />
      ))}

      {/* Element content */}
      <div className="w-full h-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
