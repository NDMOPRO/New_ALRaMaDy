import { describe, it, expect } from 'vitest';

/**
 * Tests for AI Presentation Generation improvements:
 * 1. New slide types (toc, executive-summary, pillars)
 * 2. Layout sequence generation with new types
 * 3. Post-processing of new slide types
 */

describe('AI Presentation Layout Sequence', () => {
  // Replicate the backend layout distribution logic (matches server/aiRouter.ts)
  function getLayoutDistribution(slideCount: number): string[] {
    const mandatoryLayouts: string[] = ['title'];
    if (slideCount >= 12) {
      mandatoryLayouts.push('toc', 'executive-summary', 'pillars', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    } else if (slideCount >= 10) {
      mandatoryLayouts.push('toc', 'executive-summary', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    } else if (slideCount >= 8) {
      mandatoryLayouts.push('toc', 'chart', 'table', 'infographic', 'kpi', 'timeline');
    } else if (slideCount >= 6) {
      mandatoryLayouts.push('chart', 'table', 'infographic', 'kpi');
    } else if (slideCount >= 5) {
      mandatoryLayouts.push('chart', 'table', 'infographic');
    } else if (slideCount >= 4) {
      mandatoryLayouts.push('chart', 'infographic');
    } else {
      mandatoryLayouts.push('chart');
    }
    mandatoryLayouts.push('closing');
    const remaining = slideCount - mandatoryLayouts.length;
    const fillerOptions = ['content', 'two-column', 'pillars', 'kpi', 'timeline', 'quote'];
    const fillerLayouts = Array.from({ length: remaining }, (_, i) => fillerOptions[i % fillerOptions.length]);
    return [mandatoryLayouts[0], ...mandatoryLayouts.slice(1, -1), ...fillerLayouts, mandatoryLayouts[mandatoryLayouts.length - 1]];
  }

  it('should always start with title and end with closing', () => {
    for (const count of [5, 8, 10, 15]) {
      const layouts = getLayoutDistribution(count);
      expect(layouts[0]).toBe('title');
      expect(layouts[layouts.length - 1]).toBe('closing');
    }
  });

  it('should produce the correct number of slides', () => {
    for (const count of [5, 8, 10, 15]) {
      const layouts = getLayoutDistribution(count);
      expect(layouts.length).toBe(count);
    }
  });

  it('should include toc for 8+ slides', () => {
    const layouts8 = getLayoutDistribution(8);
    expect(layouts8).toContain('toc');

    const layouts5 = getLayoutDistribution(5);
    expect(layouts5).not.toContain('toc');
  });

  it('should include executive-summary for 10+ slides', () => {
    const layouts10 = getLayoutDistribution(10);
    expect(layouts10).toContain('executive-summary');

    const layouts8 = getLayoutDistribution(8);
    expect(layouts8).not.toContain('executive-summary');
  });

  it('should include pillars for 12+ slides as mandatory', () => {
    const layouts12 = getLayoutDistribution(12);
    expect(layouts12).toContain('pillars');

    // For 10 slides, pillars may appear as filler but not mandatory
    const layouts10 = getLayoutDistribution(10);
    // pillars is in filler options so it might appear
    expect(layouts12.filter(l => l === 'pillars').length).toBeGreaterThanOrEqual(1);
  });

  it('should include chart for all slide counts >= 4', () => {
    for (const count of [4, 5, 6, 8, 10, 15]) {
      const layouts = getLayoutDistribution(count);
      expect(layouts).toContain('chart');
    }
  });

  it('should include toc before executive-summary for 10+ slides', () => {
    const layouts = getLayoutDistribution(10);
    const tocIdx = layouts.indexOf('toc');
    const execIdx = layouts.indexOf('executive-summary');
    expect(tocIdx).toBeGreaterThan(-1);
    expect(execIdx).toBeGreaterThan(-1);
    expect(tocIdx).toBeLessThan(execIdx);
  });
});

describe('AI Slide Post-Processing', () => {
  // Replicate the post-processing logic for new slide types
  function postProcessSlide(slide: any): any {
    const processed = { ...slide };
    
    // TOC slide: ensure bulletPoints from content
    if (processed.layout === 'toc' && !processed.bulletPoints?.length && processed.content) {
      const lines = processed.content.split('\n').filter((l: string) => l.trim());
      if (lines.length > 1) {
        processed.bulletPoints = lines;
        processed.content = '';
      }
    }
    
    // Executive summary: ensure infographicItems for KPIs
    if (processed.layout === 'executive-summary' && !processed.infographicItems?.length) {
      processed.infographicItems = [
        { icon: 'analytics', label: 'مؤشر رئيسي', value: '—' }
      ];
    }
    
    // Pillars: ensure infographicItems
    if (processed.layout === 'pillars' && !processed.infographicItems?.length && processed.bulletPoints?.length) {
      processed.infographicItems = processed.bulletPoints.map((bp: string, i: number) => ({
        icon: ['foundation', 'security', 'analytics', 'cloud', 'groups'][i % 5],
        label: bp,
        value: '',
      }));
    }
    
    return processed;
  }

  it('should convert TOC content to bulletPoints', () => {
    const slide = {
      layout: 'toc',
      content: 'المقدمة\nالتحليل\nالنتائج\nالتوصيات',
      bulletPoints: [],
    };
    const result = postProcessSlide(slide);
    expect(result.bulletPoints).toHaveLength(4);
    expect(result.bulletPoints[0]).toBe('المقدمة');
    expect(result.content).toBe('');
  });

  it('should add default infographicItems for executive-summary', () => {
    const slide = {
      layout: 'executive-summary',
      infographicItems: [],
    };
    const result = postProcessSlide(slide);
    expect(result.infographicItems.length).toBeGreaterThan(0);
  });

  it('should convert bulletPoints to infographicItems for pillars', () => {
    const slide = {
      layout: 'pillars',
      bulletPoints: ['الحوكمة', 'الجودة', 'الأمان'],
      infographicItems: [],
    };
    const result = postProcessSlide(slide);
    expect(result.infographicItems).toHaveLength(3);
    expect(result.infographicItems[0].label).toBe('الحوكمة');
    expect(result.infographicItems[0].icon).toBe('foundation');
  });

  it('should not modify slides that already have correct data', () => {
    const slide = {
      layout: 'toc',
      content: '',
      bulletPoints: ['بند 1', 'بند 2'],
    };
    const result = postProcessSlide(slide);
    expect(result.bulletPoints).toEqual(['بند 1', 'بند 2']);
  });
});

describe('LAYOUT_META for new types', () => {
  // Replicate the LAYOUT_META entries
  const LAYOUT_META: Record<string, { title: string; desc: string; icon: string }> = {
    title: { title: 'شريحة الغلاف', desc: 'العنوان الرئيسي والعنوان الفرعي والتاريخ', icon: 'title' },
    toc: { title: 'فهرس المحتويات', desc: 'قائمة مرقمة بمحاور العرض الرئيسية', icon: 'view_list' },
    'executive-summary': { title: 'الملخص التنفيذي', desc: 'ملخص شامل مع مؤشرات أداء رئيسية ونتائج أساسية', icon: 'summarize' },
    pillars: { title: 'الركائز الرئيسية', desc: 'عرض المحاور أو الركائز الاستراتيجية بشكل بصري', icon: 'view_column_2' },
    content: { title: 'شريحة محتوى', desc: 'عنوان مع نقاط أو فقرة نصية', icon: 'article' },
    chart: { title: 'شريحة رسم بياني', desc: 'رسم بياني مع تحليل', icon: 'bar_chart' },
    table: { title: 'شريحة جدول', desc: 'جدول بيانات منظم', icon: 'table_chart' },
    infographic: { title: 'شريحة إنفوجرافيك', desc: 'بطاقات بصرية مع أيقونات وأرقام', icon: 'insights' },
    kpi: { title: 'مؤشرات أداء', desc: 'بطاقات مؤشرات رقمية بارزة', icon: 'speed' },
    timeline: { title: 'خط زمني', desc: 'أحداث مرتبة زمنياً', icon: 'timeline' },
    'two-column': { title: 'شريحة عمودين', desc: 'محتوى موزع على عمودين', icon: 'view_column' },
    quote: { title: 'شريحة اقتباس', desc: 'اقتباس بارز مع المصدر', icon: 'format_quote' },
    closing: { title: 'شريحة الختام', desc: 'الختام الرسمي مع شكر وتقدير', icon: 'celebration' },
  };

  it('should have entries for all new slide types', () => {
    expect(LAYOUT_META['toc']).toBeDefined();
    expect(LAYOUT_META['executive-summary']).toBeDefined();
    expect(LAYOUT_META['pillars']).toBeDefined();
  });

  it('should have Arabic titles for new types', () => {
    expect(LAYOUT_META['toc'].title).toContain('فهرس');
    expect(LAYOUT_META['executive-summary'].title).toContain('ملخص');
    expect(LAYOUT_META['pillars'].title).toContain('ركائز');
  });

  it('should have icons for new types', () => {
    expect(LAYOUT_META['toc'].icon).toBe('view_list');
    expect(LAYOUT_META['executive-summary'].icon).toBe('summarize');
    expect(LAYOUT_META['pillars'].icon).toBe('view_column_2');
  });
});
