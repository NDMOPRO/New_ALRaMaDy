/**
 * Rasid Presentation Engine — Public API
 */

// Store
export { usePresentationStore } from './store';

// Types
export type {
  Deck,
  Slide,
  SlideElement,
  Theme,
  BrandKit,
  TextContent,
  ImageContent,
  ShapeContent,
  ChartContent,
  TableContent,
  ColorPalette,
  FontScheme,
  SlideMaster,
  OutlineSection,
  StoryboardFrame,
  PipelineState,
  SlideLayoutType,
  ElementType,
  PipelineStage,
} from './types';

// Components
export { SlideCanvas } from './components/SlideCanvas';
export { SlideList } from './components/SlideList';
export { SlideElementRenderer } from './components/SlideElementRenderer';
export { ToolBar } from './components/ToolBar';
export { ContextPanel } from './components/ContextPanel';
export { GenerationPanel } from './components/GenerationPanel';
export { PreviewMode } from './components/PreviewMode';
export { NewDeckDialog } from './components/NewDeckDialog';
export { PipelineProgress } from './components/PipelineProgress';
export { ThemeBrandPanel } from './components/ThemeBrandPanel';
export { ExportPanel } from './components/ExportPanel';
export { DragResizeWrapper } from './components/DragResizeWrapper';

// Services
export {
  exportToPPTX,
  exportToPDF,
  exportSlideAsImage,
  exportAndDownloadPPTX,
  exportAndDownloadPDF,
  downloadBlob,
} from './services/export';

export { PresentationPipeline } from './services/generation';

export {
  detectTextDirection,
  isArabicText,
  toArabicNumerals,
  toWesternNumerals,
  formatNumerals,
  stripTashkeel,
  addKashida,
  removeKashida,
  gregorianToHijri,
  formatHijriDate,
  segmentBiDiText,
  processArabicText,
  getTextCSSProperties,
  ARABIC_FONTS,
} from './services/arabicElite';

// Templates
export { defaultThemes, defaultMasters } from './templates/defaults';
