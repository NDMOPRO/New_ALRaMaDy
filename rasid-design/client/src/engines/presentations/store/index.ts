/**
 * Rasid Presentation Engine — Zustand Store
 * Central state management for the entire presentation engine
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuid } from 'uuid';
import type {
  Deck, Slide, SlideElement, Theme, BrandKit,
  GenerationParams, PipelineState, Outline, StoryboardFrame,
  EvidencePack, HistoryEntry, SlideMaster, SlideLayoutType,
  ElementType, Position, Size, TextContent, Background,
  Language, Tone, Density, InfographicLevel, MotionLevel, ChartStyle,
} from '../types';
import { defaultThemes, defaultMasters } from '../templates/defaults';

// ============================================================
// STORE INTERFACE
// ============================================================

interface PresentationStore {
  // === DECK STATE ===
  deck: Deck | null;
  isDirty: boolean;

  // === UI STATE ===
  activeSlideId: string | null;
  selectedElementIds: string[];
  contextPanel: 'style' | 'content' | 'data' | 'layout' | 'theme' | 'brand' | 'export' | null;
  isGenerating: boolean;
  showGrid: boolean;
  showGuides: boolean;
  zoom: number;
  previewMode: boolean;
  slideListCollapsed: boolean;

  // === PIPELINE ===
  pipeline: PipelineState;
  outline: Outline | null;
  storyboard: StoryboardFrame[];

  // === GENERATION PARAMS (KNOBS) ===
  generationParams: GenerationParams;

  // === HISTORY ===
  history: HistoryEntry[];
  historyIndex: number;

  // === EVIDENCE ===
  evidencePack: EvidencePack | null;

  // === DECK ACTIONS ===
  createDeck: (title: string, language: Language, themeId?: string) => void;
  updateDeckProperties: (props: Partial<Deck['properties']>) => void;
  setTheme: (theme: Theme) => void;
  setBrandKit: (kit: BrandKit | undefined) => void;

  // === SLIDE ACTIONS ===
  addSlide: (layoutType?: SlideLayoutType, afterSlideId?: string) => string;
  duplicateSlide: (slideId: string) => string;
  deleteSlide: (slideId: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  setActiveSlide: (slideId: string | null) => void;
  updateSlideBackground: (slideId: string, bg: Background) => void;
  updateSlideNotes: (slideId: string, notes: string) => void;
  toggleSlideHidden: (slideId: string) => void;

  // === ELEMENT ACTIONS ===
  addElement: (slideId: string, element: Partial<SlideElement>) => string;
  updateElement: (slideId: string, elementId: string, updates: Partial<SlideElement>) => void;
  deleteElement: (slideId: string, elementId: string) => void;
  duplicateElement: (slideId: string, elementId: string) => string;
  moveElement: (slideId: string, elementId: string, position: Position) => void;
  resizeElement: (slideId: string, elementId: string, size: Size) => void;
  setSelectedElements: (ids: string[]) => void;
  selectElement: (id: string, addToSelection?: boolean) => void;
  bringToFront: (slideId: string, elementId: string) => void;
  sendToBack: (slideId: string, elementId: string) => void;
  lockElement: (slideId: string, elementId: string, locked: boolean) => void;

  // === UI ACTIONS ===
  setContextPanel: (panel: PresentationStore['contextPanel']) => void;
  setZoom: (zoom: number) => void;
  togglePreviewMode: () => void;
  toggleGrid: () => void;
  toggleGuides: () => void;
  toggleSlideList: () => void;

  // === GENERATION ACTIONS ===
  setGenerationParams: (params: Partial<GenerationParams>) => void;
  startGeneration: () => Promise<void>;
  cancelGeneration: () => void;
  setPipelineStage: (stage: PipelineState['stage'], progress?: number) => void;
  setOutline: (outline: Outline) => void;

  // === HISTORY ACTIONS ===
  pushHistory: (action: string, actionAr: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // === UTILITY ===
  getActiveSlide: () => Slide | null;
  getSlideById: (id: string) => Slide | null;
  reset: () => void;
}

// ============================================================
// INITIAL STATE
// ============================================================

const defaultPipeline: PipelineState = {
  stage: 'idle',
  progress: 0,
  currentStep: '',
  steps: [
    { name: 'Intent Parsing', nameAr: 'تحليل الطلب', status: 'pending', progress: 0 },
    { name: 'Research & RAG', nameAr: 'البحث والاسترجاع', status: 'pending', progress: 0 },
    { name: 'Outline', nameAr: 'بناء الهيكل', status: 'pending', progress: 0 },
    { name: 'Storyboard', nameAr: 'القصة المصورة', status: 'pending', progress: 0 },
    { name: 'Layout', nameAr: 'التخطيط', status: 'pending', progress: 0 },
    { name: 'Styling', nameAr: 'التنسيق', status: 'pending', progress: 0 },
    { name: 'Generation', nameAr: 'التوليد', status: 'pending', progress: 0 },
    { name: 'QA Check', nameAr: 'فحص الجودة', status: 'pending', progress: 0 },
  ],
};

const defaultGenerationParams: GenerationParams = {
  prompt: '',
  tone: 'formal',
  density: 'standard',
  language: 'ar',
  infographicLevel: 'medium',
  motionLevel: 'basic',
  chartStyle: 'boardroom',
  iconPack: 'default',
  citations: false,
  speakerNotes: true,
};

// ============================================================
// STORE IMPLEMENTATION
// ============================================================

export const usePresentationStore = create<PresentationStore>()(
  immer((set, get) => ({
    // State
    deck: null,
    isDirty: false,
    activeSlideId: null,
    selectedElementIds: [],
    contextPanel: null,
    isGenerating: false,
    showGrid: false,
    showGuides: true,
    zoom: 100,
    previewMode: false,
    slideListCollapsed: false,
    pipeline: { ...defaultPipeline },
    outline: null,
    storyboard: [],
    generationParams: { ...defaultGenerationParams },
    history: [],
    historyIndex: -1,
    evidencePack: null,

    // === DECK ACTIONS ===
    createDeck: (title, language, themeId) => {
      const theme = defaultThemes.find((t: Theme) => t.id === themeId) || defaultThemes[0];
      const deckId = uuid();
      const firstSlideId = uuid();
      set(state => {
        state.deck = {
          id: deckId,
          version: 1,
          properties: {
            title,
            author: 'مستخدم راصد',
            slideSize: '16:9',
            language,
            direction: language === 'en' ? 'ltr' : 'rtl',
          },
          slides: [{
            id: firstSlideId,
            layoutType: 'title',
            elements: [
              {
                id: uuid(),
                type: 'text',
                position: { x: 10, y: 30 },
                size: { width: 80, height: 20 },
                zIndex: 1,
                textContent: {
                  html: `<h1>${title}</h1>`,
                  plainText: title,
                  direction: language === 'en' ? 'ltr' : 'rtl',
                  align: language === 'en' ? 'left' : 'right',
                  fontSize: theme.fonts.titleSize,
                  fontWeight: theme.fonts.titleWeight,
                  fontFamily: theme.fonts.titleFamily,
                  color: theme.colors.primary,
                },
              },
              {
                id: uuid(),
                type: 'text',
                position: { x: 10, y: 55 },
                size: { width: 80, height: 10 },
                zIndex: 2,
                textContent: {
                  html: '<p>العنوان الفرعي</p>',
                  plainText: 'العنوان الفرعي',
                  direction: language === 'en' ? 'ltr' : 'rtl',
                  align: language === 'en' ? 'left' : 'right',
                  fontSize: theme.fonts.bodySize,
                  fontWeight: theme.fonts.bodyWeight,
                  fontFamily: theme.fonts.bodyFamily,
                  color: theme.colors.textSecondary,
                },
              },
            ],
            background: theme.slideBackground,
            order: 0,
          }],
          theme,
          masters: defaultMasters,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.activeSlideId = firstSlideId;
        state.isDirty = false;
      });
    },

    updateDeckProperties: (props) => {
      set(state => {
        if (state.deck) {
          Object.assign(state.deck.properties, props);
          state.deck.version++;
          state.deck.updatedAt = new Date().toISOString();
          state.isDirty = true;
        }
      });
    },

    setTheme: (theme) => {
      set(state => {
        if (state.deck) {
          state.deck.theme = theme;
          state.deck.version++;
          state.isDirty = true;
        }
      });
    },

    setBrandKit: (kit) => {
      set(state => {
        if (state.deck) {
          state.deck.brandKit = kit;
          state.isDirty = true;
        }
      });
    },

    // === SLIDE ACTIONS ===
    addSlide: (layoutType = 'blank', afterSlideId) => {
      const newId = uuid();
      set(state => {
        if (!state.deck) return;
        const newSlide: Slide = {
          id: newId,
          layoutType,
          elements: [],
          background: state.deck.theme.slideBackground,
          order: state.deck.slides.length,
        };
        if (afterSlideId) {
          const idx = state.deck.slides.findIndex(s => s.id === afterSlideId);
          state.deck.slides.splice(idx + 1, 0, newSlide);
        } else {
          state.deck.slides.push(newSlide);
        }
        // Reorder
        state.deck.slides.forEach((s, i) => { s.order = i; });
        state.activeSlideId = newId;
        state.deck.version++;
        state.isDirty = true;
      });
      return newId;
    },

    duplicateSlide: (slideId) => {
      const newId = uuid();
      set(state => {
        if (!state.deck) return;
        const source = state.deck.slides.find(s => s.id === slideId);
        if (!source) return;
        const idx = state.deck.slides.findIndex(s => s.id === slideId);
        const clone: Slide = JSON.parse(JSON.stringify(source));
        clone.id = newId;
        clone.elements = clone.elements.map(el => ({ ...el, id: uuid() }));
        state.deck.slides.splice(idx + 1, 0, clone);
        state.deck.slides.forEach((s, i) => { s.order = i; });
        state.activeSlideId = newId;
        state.deck.version++;
        state.isDirty = true;
      });
      return newId;
    },

    deleteSlide: (slideId) => {
      set(state => {
        if (!state.deck || state.deck.slides.length <= 1) return;
        const idx = state.deck.slides.findIndex(s => s.id === slideId);
        state.deck.slides.splice(idx, 1);
        state.deck.slides.forEach((s, i) => { s.order = i; });
        if (state.activeSlideId === slideId) {
          state.activeSlideId = state.deck.slides[Math.max(0, idx - 1)]?.id || null;
        }
        state.deck.version++;
        state.isDirty = true;
      });
    },

    reorderSlides: (fromIndex, toIndex) => {
      set(state => {
        if (!state.deck) return;
        const [moved] = state.deck.slides.splice(fromIndex, 1);
        state.deck.slides.splice(toIndex, 0, moved);
        state.deck.slides.forEach((s, i) => { s.order = i; });
        state.deck.version++;
        state.isDirty = true;
      });
    },

    setActiveSlide: (slideId) => {
      set(state => {
        state.activeSlideId = slideId;
        state.selectedElementIds = [];
      });
    },

    updateSlideBackground: (slideId, bg) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        if (slide) {
          slide.background = bg;
          state.isDirty = true;
        }
      });
    },

    updateSlideNotes: (slideId, notes) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        if (slide) {
          slide.notes = notes;
          state.isDirty = true;
        }
      });
    },

    toggleSlideHidden: (slideId) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        if (slide) {
          slide.hidden = !slide.hidden;
          state.isDirty = true;
        }
      });
    },

    // === ELEMENT ACTIONS ===
    addElement: (slideId, element) => {
      const newId = uuid();
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        if (!slide) return;
        const maxZ = slide.elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
        slide.elements.push({
          id: newId,
          type: element.type || 'text',
          position: element.position || { x: 20, y: 20 },
          size: element.size || { width: 40, height: 20 },
          zIndex: maxZ + 1,
          rotation: element.rotation,
          opacity: element.opacity ?? 1,
          ...element,
        } as SlideElement);
        state.selectedElementIds = [newId];
        state.isDirty = true;
      });
      return newId;
    },

    updateElement: (slideId, elementId, updates) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (el) {
          Object.assign(el, updates);
          state.isDirty = true;
        }
      });
    },

    deleteElement: (slideId, elementId) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        if (slide) {
          slide.elements = slide.elements.filter(e => e.id !== elementId);
          state.selectedElementIds = state.selectedElementIds.filter(id => id !== elementId);
          state.isDirty = true;
        }
      });
    },

    duplicateElement: (slideId, elementId) => {
      const newId = uuid();
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const source = slide?.elements.find(e => e.id === elementId);
        if (slide && source) {
          const clone: SlideElement = JSON.parse(JSON.stringify(source));
          clone.id = newId;
          clone.position = { x: source.position.x + 2, y: source.position.y + 2 };
          clone.zIndex = slide.elements.reduce((max, el) => Math.max(max, el.zIndex), 0) + 1;
          slide.elements.push(clone);
          state.selectedElementIds = [newId];
          state.isDirty = true;
        }
      });
      return newId;
    },

    moveElement: (slideId, elementId, position) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (el) {
          el.position = position;
          state.isDirty = true;
        }
      });
    },

    resizeElement: (slideId, elementId, size) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (el) {
          el.size = size;
          state.isDirty = true;
        }
      });
    },

    setSelectedElements: (ids) => {
      set(state => { state.selectedElementIds = ids; });
    },

    selectElement: (id, addToSelection) => {
      set(state => {
        if (addToSelection) {
          if (state.selectedElementIds.includes(id)) {
            state.selectedElementIds = state.selectedElementIds.filter(eid => eid !== id);
          } else {
            state.selectedElementIds.push(id);
          }
        } else {
          state.selectedElementIds = [id];
        }
      });
    },

    bringToFront: (slideId, elementId) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (slide && el) {
          const maxZ = slide.elements.reduce((max, e) => Math.max(max, e.zIndex), 0);
          el.zIndex = maxZ + 1;
          state.isDirty = true;
        }
      });
    },

    sendToBack: (slideId, elementId) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (slide && el) {
          const minZ = slide.elements.reduce((min, e) => Math.min(min, e.zIndex), Infinity);
          el.zIndex = minZ - 1;
          state.isDirty = true;
        }
      });
    },

    lockElement: (slideId, elementId, locked) => {
      set(state => {
        const slide = state.deck?.slides.find(s => s.id === slideId);
        const el = slide?.elements.find(e => e.id === elementId);
        if (el) el.locked = locked;
      });
    },

    // === UI ACTIONS ===
    setContextPanel: (panel) => {
      set(state => { state.contextPanel = panel; });
    },

    setZoom: (zoom) => {
      set(state => { state.zoom = Math.max(25, Math.min(400, zoom)); });
    },

    togglePreviewMode: () => {
      set(state => { state.previewMode = !state.previewMode; });
    },

    toggleGrid: () => {
      set(state => { state.showGrid = !state.showGrid; });
    },

    toggleGuides: () => {
      set(state => { state.showGuides = !state.showGuides; });
    },

    toggleSlideList: () => {
      set(state => { state.slideListCollapsed = !state.slideListCollapsed; });
    },

    // === GENERATION ===
    setGenerationParams: (params) => {
      set(state => { Object.assign(state.generationParams, params); });
    },

    startGeneration: async () => {
      set(state => {
        state.isGenerating = true;
        state.pipeline = {
          ...defaultPipeline,
          stage: 'parsing',
          steps: defaultPipeline.steps.map(s => ({ ...s })),
        };
        state.pipeline.startedAt = new Date().toISOString();
      });
      // Pipeline simulation — in production this calls backend AI
      const stages: PipelineState['stage'][] = ['parsing', 'researching', 'outlining', 'storyboarding', 'layouting', 'styling', 'generating', 'qa'];
      for (let i = 0; i < stages.length; i++) {
        const store = get();
        if (!store.isGenerating) break;
        set(state => {
          state.pipeline.stage = stages[i];
          state.pipeline.currentStep = state.pipeline.steps[i].nameAr;
          state.pipeline.steps[i].status = 'active';
          state.pipeline.progress = Math.round(((i) / stages.length) * 100);
        });
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        set(state => {
          state.pipeline.steps[i].status = 'done';
          state.pipeline.steps[i].progress = 100;
        });
      }
      // Generate demo deck
      const store = get();
      if (store.isGenerating && store.deck) {
        set(state => {
          state.pipeline.stage = 'done';
          state.pipeline.progress = 100;
          state.pipeline.completedAt = new Date().toISOString();
          state.isGenerating = false;
        });
      }
    },

    cancelGeneration: () => {
      set(state => {
        state.isGenerating = false;
        state.pipeline.stage = 'idle';
      });
    },

    setPipelineStage: (stage, progress) => {
      set(state => {
        state.pipeline.stage = stage;
        if (progress !== undefined) state.pipeline.progress = progress;
      });
    },

    setOutline: (outline) => {
      set(state => { state.outline = outline; });
    },

    // === HISTORY ===
    pushHistory: (action, actionAr) => {
      set(state => {
        if (!state.deck) return;
        // Trim future entries
        state.history = state.history.slice(0, state.historyIndex + 1);
        state.history.push({
          id: uuid(),
          timestamp: new Date().toISOString(),
          action,
          actionAr,
          snapshot: JSON.stringify(state.deck),
        });
        state.historyIndex = state.history.length - 1;
        // Keep max 50 entries
        if (state.history.length > 50) {
          state.history = state.history.slice(-50);
          state.historyIndex = state.history.length - 1;
        }
      });
    },

    undo: () => {
      set(state => {
        if (state.historyIndex <= 0) return;
        state.historyIndex--;
        const entry = state.history[state.historyIndex];
        if (entry) {
          state.deck = JSON.parse(entry.snapshot);
        }
      });
    },

    redo: () => {
      set(state => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex++;
        const entry = state.history[state.historyIndex];
        if (entry) {
          state.deck = JSON.parse(entry.snapshot);
        }
      });
    },

    canUndo: () => get().historyIndex > 0,
    canRedo: () => get().historyIndex < get().history.length - 1,

    // === UTILITY ===
    getActiveSlide: () => {
      const { deck, activeSlideId } = get();
      return deck?.slides.find(s => s.id === activeSlideId) || null;
    },

    getSlideById: (id) => {
      return get().deck?.slides.find(s => s.id === id) || null;
    },

    reset: () => {
      set(state => {
        state.deck = null;
        state.activeSlideId = null;
        state.selectedElementIds = [];
        state.contextPanel = null;
        state.isGenerating = false;
        state.pipeline = { ...defaultPipeline };
        state.outline = null;
        state.storyboard = [];
        state.history = [];
        state.historyIndex = -1;
        state.evidencePack = null;
        state.isDirty = false;
      });
    },
  }))
);
