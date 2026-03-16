/* ═══════════════════════════════════════════════════════════════
   Export Utilities — PPTX & PDF Export for Rasid Presentations
   Uses pptxgenjs for PowerPoint and jsPDF + html2canvas for PDF
   ═══════════════════════════════════════════════════════════════ */
import PptxGenJS from 'pptxgenjs';
import { THEMES, type SlideData, type SlideTheme } from './slideTemplates';

/* ─── Brand color mapping ─── */
function getTheme(themeId: string): SlideTheme {
  return THEMES[themeId] || THEMES.ndmo;
}

/* ─── Layout label mapping ─── */
function layoutLabel(layout: string): string {
  const map: Record<string, string> = {
    title: 'غلاف', toc: 'فهرس', 'executive-summary': 'ملخص تنفيذي',
    pillars: 'ركائز', chart: 'رسم بياني', table: 'جدول',
    infographic: 'إنفوجرافيك', kpi: 'مؤشرات', timeline: 'خط زمني',
    closing: 'ختام', content: 'محتوى', 'two-column': 'عمودان', quote: 'اقتباس',
  };
  return map[layout] || layout;
}

/* ═══════════════════════════════════════════════════════════════
   PPTX Export — Real PowerPoint file generation
   ═══════════════════════════════════════════════════════════════ */
export async function exportToPptx(slides: SlideData[], themeId: string, title: string): Promise<void> {
  const theme = getTheme(themeId);
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'منصة راصد';
  pptx.company = 'مكتب إدارة البيانات الوطنية';
  pptx.subject = title;
  pptx.title = title;

  // Define master slides
  pptx.defineSlideMaster({
    title: 'RASID_MASTER',
    background: { color: theme.background.replace('#', '') },
    objects: [
      // Bottom accent bar
      { rect: { x: 0, y: '93%', w: '100%', h: '7%', fill: { color: theme.primary.replace('#', '') } } },
    ],
  });

  for (const slideData of slides) {
    const slide = pptx.addSlide({ masterName: 'RASID_MASTER' });

    if (slideData.layout === 'title' || slideData.layout === 'closing') {
      // ─── Cover / Closing slide ───
      slide.background = { fill: theme.primary.replace('#', '') };
      slide.addText(slideData.title || '', {
        x: 0.5, y: 1.5, w: 9, h: 1.5,
        fontSize: 32, fontFace: 'Tajawal', color: 'FFFFFF',
        bold: true, align: 'right', rtlMode: true,
      });
      slide.addText(slideData.subtitle || '', {
        x: 0.5, y: 3.0, w: 9, h: 0.8,
        fontSize: 18, fontFace: 'Tajawal', color: theme.secondary.replace('#', ''),
        align: 'right', rtlMode: true,
      });
      if (slideData.layout === 'title') {
        slide.addText(new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }), {
          x: 0.5, y: 4.0, w: 9, h: 0.5,
          fontSize: 12, fontFace: 'Tajawal', color: 'FFFFFF80',
          align: 'right', rtlMode: true,
        });
      }
      if (slideData.notes) slide.addNotes(slideData.notes);
      continue;
    }

    // ─── Standard slide header ───
    slide.addText(slideData.title || '', {
      x: 0.5, y: 0.3, w: 9, h: 0.6,
      fontSize: 22, fontFace: 'Tajawal', color: theme.primary.replace('#', ''),
      bold: true, align: 'right', rtlMode: true,
    });
    if (slideData.subtitle) {
      slide.addText(slideData.subtitle, {
        x: 0.5, y: 0.85, w: 9, h: 0.4,
        fontSize: 13, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
        align: 'right', rtlMode: true,
      });
    }
    // Divider line
    slide.addShape(pptx.ShapeType.line, {
      x: 0.5, y: 1.25, w: 9, h: 0,
      line: { color: theme.borderColor.replace('#', ''), width: 1 },
    });

    const contentY = 1.4;
    const contentH = 3.8;

    // ─── Chart slide ───
    if (slideData.layout === 'chart' && slideData.chartData && slideData.chartData.length > 0) {
      const chartType = slideData.chartType === 'pie' || slideData.chartType === 'donut' ? pptx.ChartType.pie
        : slideData.chartType === 'line' ? pptx.ChartType.line
        : pptx.ChartType.bar;

      const chartColors = (slideData.chartColors || [theme.primary, theme.secondary, theme.accent]).map(c => c.replace('#', ''));

      slide.addChart(chartType, [{
        name: slideData.title || 'بيانات',
        labels: slideData.chartLabels || slideData.chartData.map((_, i) => `عنصر ${i + 1}`),
        values: slideData.chartData,
      }], {
        x: 0.5, y: contentY, w: 5, h: contentH,
        showTitle: false,
        showValue: true,
        chartColors: chartColors,
        catAxisOrientation: 'minMax',
        valAxisOrientation: 'minMax',
      });

      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 5.8, y: contentY, w: 3.7, h: contentH,
          fontSize: 11, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
          align: 'right', rtlMode: true, valign: 'top',
        });
      }
    }
    // ─── Table slide ───
    else if (slideData.layout === 'table' && slideData.tableHeaders && slideData.tableRows) {
      const headerRow = slideData.tableHeaders.map(h => ({
        text: h, options: {
          bold: true, fontSize: 10, fontFace: 'Tajawal',
          color: 'FFFFFF', fill: { color: theme.primary.replace('#', '') },
          align: 'right' as const,
        },
      }));
      const dataRows = slideData.tableRows.map(row =>
        row.map(cell => ({
          text: cell, options: {
            fontSize: 9, fontFace: 'Tajawal',
            color: theme.textPrimary.replace('#', ''),
            align: 'right' as const,
          },
        }))
      );
      slide.addTable([headerRow, ...dataRows], {
        x: 0.5, y: contentY, w: 9, h: contentH,
        border: { type: 'solid', pt: 0.5, color: theme.borderColor.replace('#', '') },
        colW: Array(slideData.tableHeaders.length).fill(9 / slideData.tableHeaders.length),
        autoPage: false,
      });
    }
    // ─── Infographic / KPI / Pillars / Executive Summary ───
    else if (['infographic', 'kpi', 'pillars', 'executive-summary'].includes(slideData.layout) && slideData.infographicItems && slideData.infographicItems.length > 0) {
      const items = slideData.infographicItems;
      const colCount = Math.min(items.length, 4);
      const colW = 9 / colCount;
      items.slice(0, 4).forEach((item, i) => {
        const x = 0.5 + (colCount - 1 - i) * colW;
        // Card background
        slide.addShape(pptx.ShapeType.roundRect, {
          x, y: contentY + 0.2, w: colW - 0.3, h: 2.2,
          fill: { color: theme.cardBg.replace('#', '') },
          line: { color: theme.borderColor.replace('#', ''), width: 0.5 },
          rectRadius: 0.15,
        });
        // Value
        slide.addText(item.value, {
          x, y: contentY + 0.4, w: colW - 0.3, h: 0.7,
          fontSize: 24, fontFace: 'Tajawal', color: theme.primary.replace('#', ''),
          bold: true, align: 'center',
        });
        // Label
        slide.addText(item.label, {
          x, y: contentY + 1.2, w: colW - 0.3, h: 0.6,
          fontSize: 11, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
          align: 'center',
        });
      });
      // Content below cards
      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 0.5, y: contentY + 2.6, w: 9, h: 1.2,
          fontSize: 10, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
          align: 'right', rtlMode: true, valign: 'top',
        });
      }
    }
    // ─── Timeline slide ───
    else if (slideData.layout === 'timeline' && slideData.timelineItems && slideData.timelineItems.length > 0) {
      const items = slideData.timelineItems;
      const stepW = 9 / items.length;
      // Timeline line
      slide.addShape(pptx.ShapeType.line, {
        x: 0.5, y: contentY + 1.2, w: 9, h: 0,
        line: { color: theme.primary.replace('#', ''), width: 2 },
      });
      items.forEach((item, i) => {
        const x = 0.5 + (items.length - 1 - i) * stepW;
        // Dot
        slide.addShape(pptx.ShapeType.ellipse, {
          x: x + stepW / 2 - 0.15, y: contentY + 1.05, w: 0.3, h: 0.3,
          fill: { color: theme.primary.replace('#', '') },
        });
        // Year
        slide.addText(item.year, {
          x, y: contentY + 0.3, w: stepW, h: 0.5,
          fontSize: 14, fontFace: 'Tajawal', color: theme.primary.replace('#', ''),
          bold: true, align: 'center',
        });
        // Title
        slide.addText(item.title, {
          x, y: contentY + 1.5, w: stepW, h: 0.5,
          fontSize: 10, fontFace: 'Tajawal', color: theme.textPrimary.replace('#', ''),
          bold: true, align: 'center',
        });
        // Description
        slide.addText(item.description.substring(0, 80), {
          x, y: contentY + 2.0, w: stepW, h: 0.8,
          fontSize: 8, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
          align: 'center',
        });
      });
    }
    // ─── TOC slide ───
    else if (slideData.layout === 'toc' && slideData.bulletPoints && slideData.bulletPoints.length > 0) {
      const tocText = slideData.bulletPoints.map((bp, i) => `${i + 1}. ${bp}`).join('\n\n');
      slide.addText(tocText, {
        x: 0.5, y: contentY, w: 9, h: contentH,
        fontSize: 13, fontFace: 'Tajawal', color: theme.textPrimary.replace('#', ''),
        align: 'right', rtlMode: true, valign: 'top', lineSpacing: 28,
      });
    }
    // ─── Content / Two-column / Default ───
    else {
      // Content paragraph
      if (slideData.content) {
        slide.addText(slideData.content, {
          x: 0.5, y: contentY, w: 9, h: 1.2,
          fontSize: 12, fontFace: 'Tajawal', color: theme.textPrimary.replace('#', ''),
          align: 'right', rtlMode: true, valign: 'top',
        });
      }
      // Bullet points
      if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
        const bpText = slideData.bulletPoints.map(bp => `• ${bp}`).join('\n');
        slide.addText(bpText, {
          x: 0.5, y: contentY + 1.3, w: 9, h: contentH - 1.3,
          fontSize: 11, fontFace: 'Tajawal', color: theme.textSecondary.replace('#', ''),
          align: 'right', rtlMode: true, valign: 'top', lineSpacing: 22,
        });
      }
    }

    // Add speaker notes
    if (slideData.notes) slide.addNotes(slideData.notes);
  }

  // Generate and download
  const fileName = `${title || 'عرض_راصد'}.pptx`;
  await pptx.writeFile({ fileName });
}

/* ═══════════════════════════════════════════════════════════════
   PDF Export — Renders slide HTML to PDF using iframe + jsPDF
   ═══════════════════════════════════════════════════════════════ */
export async function exportToPdf(slideHtmls: string[], title: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [960, 540] });

  for (let i = 0; i < slideHtmls.length; i++) {
    if (i > 0) pdf.addPage([960, 540], 'landscape');

    // Create a temporary container to render the slide
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:960px;height:540px;overflow:hidden;background:#fff;';
    document.body.appendChild(container);

    // Create iframe to render HTML
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:960px;height:540px;border:none;';
    container.appendChild(iframe);

    // Write HTML content
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = slideHtmls[i];
      // Fallback timeout
      setTimeout(resolve, 2000);
    });

    // Wait for fonts and images to load
    await new Promise(r => setTimeout(r, 500));

    try {
      // Capture the iframe content
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (iframeDoc?.body) {
        const canvas = await html2canvas(iframeDoc.body, {
          width: 960,
          height: 540,
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 960, 540);
      }
    } catch {
      // If html2canvas fails, add a placeholder
      pdf.setFontSize(24);
      pdf.text(`شريحة ${i + 1}`, 480, 270, { align: 'center' });
    }

    document.body.removeChild(container);
  }

  pdf.save(`${title || 'عرض_راصد'}.pdf`);
}
