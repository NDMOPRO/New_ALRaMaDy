/**
 * SlideElementRenderer — Renders individual slide elements
 * Supports: text, image, shape, chart, table, icon, infographic
 */

import { memo } from 'react';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import type { SlideElement, Theme } from '../types';

interface Props {
  element: SlideElement;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  theme: Theme;
  zoom: number;
}

export const SlideElementRenderer = memo(function SlideElementRenderer({
  element, isSelected, onMouseDown, theme, zoom,
}: Props) {
  const { type, position, size, rotation, opacity, zIndex } = element;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: `${size.width}%`,
    height: `${size.height}%`,
    zIndex,
    opacity: opacity ?? 1,
    transform: rotation ? `rotate(${rotation}deg)` : undefined,
    cursor: element.locked ? 'default' : 'move',
  };

  const selectionBorder = isSelected
    ? '2px solid #c9a84c'
    : '1px solid transparent';

  return (
    <div
      style={{ ...style, border: selectionBorder }}
      onMouseDown={onMouseDown}
      className="group transition-shadow"
    >
      {/* Selection handles */}
      {isSelected && !element.locked && (
        <>
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gold rounded-full border border-white cursor-nw-resize" />
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-gold rounded-full border border-white cursor-ne-resize" />
          <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-gold rounded-full border border-white cursor-sw-resize" />
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-gold rounded-full border border-white cursor-se-resize" />
        </>
      )}

      {/* Content */}
      {type === 'text' && element.textContent && (
        <TextElement content={element.textContent} theme={theme} />
      )}
      {type === 'image' && element.imageContent && (
        <ImageElement content={element.imageContent} />
      )}
      {type === 'shape' && element.shapeContent && (
        <ShapeElement content={element.shapeContent} />
      )}
      {type === 'chart' && element.chartContent && (
        <ChartElement content={element.chartContent} theme={theme} />
      )}
      {type === 'table' && element.tableContent && (
        <TableElement content={element.tableContent} theme={theme} />
      )}
      {type === 'icon' && element.iconContent && (
        <IconElement content={element.iconContent} />
      )}
      {type === 'infographic' && element.infographicContent && (
        <InfographicElement content={element.infographicContent} theme={theme} />
      )}
    </div>
  );
});

// === TEXT ELEMENT ===
function TextElement({ content, theme }: { content: NonNullable<SlideElement['textContent']>; theme: Theme }) {
  return (
    <div
      className="w-full h-full overflow-hidden p-1"
      style={{
        direction: (content.direction || 'rtl') as 'rtl' | 'ltr',
        textAlign: content.align || 'right',
        fontFamily: content.fontFamily || theme.fonts.bodyFamily,
        fontSize: content.fontSize ? `${content.fontSize * 0.6}px` : undefined,
        fontWeight: content.fontWeight === 'bold' ? 700 : content.fontWeight === 'semibold' ? 600 : 400,
        color: content.color || theme.colors.text,
        lineHeight: content.lineHeight || 1.5,
      }}
      dangerouslySetInnerHTML={{ __html: content.html }}
    />
  );
}

// === IMAGE ELEMENT ===
function ImageElement({ content }: { content: NonNullable<SlideElement['imageContent']> }) {
  return (
    <div className="w-full h-full overflow-hidden" style={{ borderRadius: content.borderRadius }}>
      <img
        src={content.url}
        alt={content.alt}
        className="w-full h-full"
        style={{
          objectFit: content.fit || 'cover',
          filter: content.filters
            ? `brightness(${content.filters.brightness ?? 100}%) contrast(${content.filters.contrast ?? 100}%) saturate(${content.filters.saturation ?? 100}%)`
            : undefined,
          opacity: content.filters?.opacity ?? 1,
        }}
      />
    </div>
  );
}

// === SHAPE ELEMENT ===
function ShapeElement({ content }: { content: NonNullable<SlideElement['shapeContent']> }) {
  const shapeClasses: Record<string, string> = {
    rectangle: '',
    circle: 'rounded-full',
    triangle: '',
    diamond: 'rotate-45',
  };

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${shapeClasses[content.shapeType] || ''}`}
      style={{
        backgroundColor: content.fill,
        border: content.stroke ? `${content.strokeWidth || 2}px solid ${content.stroke}` : undefined,
        opacity: content.opacity ?? 1,
        borderRadius: content.shapeType === 'rectangle' ? '4px' : undefined,
      }}
    >
      {content.text && (
        <span
          style={{
            color: content.text.color || '#fff',
            fontSize: content.text.fontSize ? `${content.text.fontSize * 0.6}px` : '12px',
            textAlign: 'center',
          }}
        >
          {content.text.plainText}
        </span>
      )}
    </div>
  );
}

// === CHART ELEMENT (Visual placeholder — real charts in export) ===
function ChartElement({ content, theme }: { content: NonNullable<SlideElement['chartContent']>; theme: Theme }) {
  const chartIcons: Record<string, React.ReactNode> = {
    bar: <BarChart3 className="w-8 h-8" />,
    pie: <PieChart className="w-8 h-8" />,
    line: <TrendingUp className="w-8 h-8" />,
  };

  // Simple bar chart visualization
  const maxVal = Math.max(...(content.data.datasets[0]?.data || [1]));

  return (
    <div className="w-full h-full flex flex-col p-2 gap-1" style={{ direction: (content.options.direction || 'rtl') as 'rtl' | 'ltr' }}>
      <div className="flex-1 flex items-end gap-1 px-2">
        {content.data.datasets[0]?.data.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${(val / maxVal) * 100}%`,
                backgroundColor: content.data.datasets[0]?.color || theme.colors.primary,
                minHeight: '4px',
                opacity: 0.8 + (i * 0.05),
              }}
            />
            <span className="text-[6px] truncate w-full text-center" style={{ color: theme.colors.textSecondary }}>
              {content.data.labels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// === TABLE ELEMENT ===
function TableElement({ content, theme }: { content: NonNullable<SlideElement['tableContent']>; theme: Theme }) {
  return (
    <div className="w-full h-full overflow-auto" style={{ direction: (content.direction || 'rtl') as 'rtl' | 'ltr' }}>
      <table className="w-full h-full text-[8px] border-collapse">
        <thead>
          <tr>
            {content.headers.map((h, i) => (
              <th
                key={i}
                className="px-1 py-0.5 text-center"
                style={{
                  backgroundColor: content.headerStyle.background || theme.colors.primary,
                  color: content.headerStyle.color || '#fff',
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {content.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-1 py-0.5 text-center"
                  style={{
                    borderBottom: `1px solid ${content.cellStyle.borderColor || theme.colors.border}`,
                    backgroundColor: ri % 2 === 1 ? (content.cellStyle.alternateRowColor || 'transparent') : 'transparent',
                    color: theme.colors.text,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// === ICON ELEMENT ===
function IconElement({ content }: { content: NonNullable<SlideElement['iconContent']> }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        style={{ color: content.color, fontSize: `${content.size * 0.5}px` }}
        className="flex items-center justify-center"
      >
        ●
      </div>
    </div>
  );
}

// === INFOGRAPHIC ELEMENT ===
function InfographicElement({ content, theme }: { content: NonNullable<SlideElement['infographicContent']>; theme: Theme }) {
  return (
    <div className="w-full h-full flex items-center justify-center gap-2 p-2" style={{ direction: (content.direction || 'rtl') as 'rtl' | 'ltr' }}>
      {content.items.map((item, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-1 p-1 rounded"
          style={{
            backgroundColor: item.color || theme.colors.surface,
            border: `1px solid ${theme.colors.border}`,
          }}
        >
          {item.value && (
            <span className="text-sm font-bold" style={{ color: item.color || theme.colors.primary }}>
              {item.value}
            </span>
          )}
          <span className="text-[7px] text-center" style={{ color: theme.colors.text }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
