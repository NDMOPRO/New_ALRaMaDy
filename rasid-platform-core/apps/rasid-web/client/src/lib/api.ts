/**
 * Rasid Presentation API Client
 * Bridges the original editor store with real backend tRPC endpoints
 * No fake data — all calls go to the real server
 */

// ─── tRPC batch caller ───
async function trpcMutate<T>(path: string, input: unknown): Promise<T> {
  const res = await fetch('/api/trpc/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      "0": { json: input, meta: { values: {} } }
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const result = data[0]?.result?.data;
  if (result?.json !== undefined) return result.json as T;
  return result as T;
}

async function trpcQuery<T>(path: string, input?: unknown): Promise<T> {
  const params = input
    ? `?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input, meta: { values: {} } } }))}`
    : '?batch=1&input=%7B%220%22%3A%7B%7D%7D';
  const res = await fetch('/api/trpc/' + path + params, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const result = data[0]?.result?.data;
  if (result?.json !== undefined) return result.json as T;
  return result as T;
}

// ─── Types ───
export interface TOCItem {
  index: number;
  title: string;
  layout: string;
  description: string;
}

export interface GeneratedSlide {
  layout: string;
  title: string;
  subtitle?: string;
  content?: string;
  bulletPoints?: string[];
  kpiItems?: { label: string; value: string; change?: string; icon?: string; trend?: string }[];
  chartType?: string;
  chartData?: number[];
  chartLabels?: string[];
  chartColors?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  timelineItems?: { year?: string; date?: string; title: string; description: string }[];
  pillarItems?: { title: string; description: string; icon?: string }[];
  infographicItems?: { icon?: string; label: string; value: string; description?: string }[];
  imagePrompt?: string;
}

// ─── Create presentation in DB (enhanced) ───
export async function apiCreatePresentation(opts: {
  title: string;
  topic?: string;
  themeId?: number;
  slideCount: number;
  style: string;
  contentSource?: 'ai' | 'custom' | 'mixed';
  usedBananaPro?: boolean;
}): Promise<{ id: number; title: string }> {
  return trpcMutate<{ id: number; title: string }>('presentations.createEnhanced', {
    title: opts.title,
    topic: opts.topic,
    themeId: opts.themeId,
    slideCount: opts.slideCount,
    style: opts.style,
    contentSource: opts.contentSource || 'ai',
    usedBananaPro: opts.usedBananaPro || false,
  });
}

// ─── Generate TOC via AI ───
export async function apiGenerateTOC(opts: {
  topic: string;
  slideCount: number;
  style: string;
  additionalInstructions?: string;
}): Promise<{ toc: TOCItem[]; topic: string }> {
  return trpcMutate<{ toc: TOCItem[]; topic: string }>('ai.generateTOC', {
    topic: opts.topic,
    slideCount: opts.slideCount,
    style: opts.style,
    additionalInstructions: opts.additionalInstructions,
    language: 'ar',
  });
}

// ─── Generate single slide via AI ───
export async function apiGenerateSlide(opts: {
  topic: string;
  slideIndex: number;
  slideTitle: string;
  slideLayout: string;
  slideDescription: string;
  totalSlides: number;
  style: string;
  previousSlides?: { title: string; layout: string }[];
}): Promise<{ slide: GeneratedSlide; slideIndex: number }> {
  return trpcMutate<{ slide: GeneratedSlide; slideIndex: number }>('ai.generateSingleSlide', {
    topic: opts.topic,
    slideIndex: opts.slideIndex,
    slideTitle: opts.slideTitle,
    slideLayout: opts.slideLayout,
    slideDescription: opts.slideDescription,
    totalSlides: opts.totalSlides,
    style: opts.style,
    language: 'ar',
    previousSlides: opts.previousSlides || [],
  });
}

// ─── Edit slide with AI ───
export async function apiEditSlideAI(opts: {
  currentSlide: Record<string, unknown>;
  instruction: string;
  slideIndex: number;
}): Promise<{ slide: GeneratedSlide; slideIndex: number }> {
  return trpcMutate<{ slide: GeneratedSlide; slideIndex: number }>('ai.editSlideAI', opts);
}

// ─── Save slide to DB ───
export async function apiSaveSlide(opts: {
  presentationId: number;
  slideIndex: number;
  title: string;
  layout?: string;
  data: string;
  htmlCode?: string;
  source?: string;
}): Promise<{ id: number }> {
  return trpcMutate<{ id: number }>('presentations.saveSlide', opts);
}

// ─── Update slide in DB ───
export async function apiUpdateSlide(opts: {
  id: number;
  title?: string;
  layout?: string;
  data?: string;
  htmlCode?: string;
  isEdited?: boolean;
  source?: string;
}): Promise<{ success: boolean }> {
  return trpcMutate<{ success: boolean }>('presentations.updateSlide', opts);
}

// ─── Generate image with NanoBanana Pro (async) ───
export async function apiGenerateImage(opts: {
  prompt: string;
  type?: 'TEXTTOIAMGE' | 'IMAGETOIAMGE';
  numImages?: number;
  imageSize?: string;
  imageUrls?: string[];
}): Promise<{ taskId: string }> {
  return trpcMutate<{ taskId: string }>('ai.generateImageAsync', {
    prompt: opts.prompt,
    type: opts.type || 'TEXTTOIAMGE',
    numImages: opts.numImages || 1,
    imageSize: opts.imageSize || '16:9',
    imageUrls: opts.imageUrls,
  });
}

// ─── Wait for image generation ───
export async function apiWaitForImage(opts: {
  taskId: string;
  maxWaitMs?: number;
}): Promise<{ taskId: string; imageUrl: string | null; originUrl: string | null }> {
  return trpcMutate<{ taskId: string; imageUrl: string | null; originUrl: string | null }>('ai.waitForImage', opts);
}

// ─── Get NanoBanana Pro credits ───
export async function apiGetCredits(): Promise<{ credits: number }> {
  return trpcQuery<{ credits: number }>('ai.getCredits');
}

// ─── AI Chat ───
export async function apiChat(opts: {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: string;
}): Promise<{ content: string; intent?: string }> {
  return trpcMutate<{ content: string; intent?: string }>('ai.chat', opts);
}

// ─── AI Text Operations ───
export async function apiTextOperation(opts: {
  text: string;
  operation: 'translate' | 'rephrase' | 'summarize' | 'expand';
  targetLanguage?: string;
}): Promise<{ result: string }> {
  return trpcMutate<{ result: string }>('ai.textOperation', opts);
}

// ─── Save/Update presentation in DB ───
export async function apiSavePresentation(opts: {
  id: number;
  title?: string;
  topic?: string;
  themeId?: number;
  slideCount?: number;
  status?: string;
  style?: string;
  toc?: string;
}): Promise<{ success: boolean }> {
  return trpcMutate<{ success: boolean }>('presentations.updateEnhanced', opts);
}

// ─── Load presentation from DB ───
export async function apiLoadPresentation(id: number): Promise<unknown> {
  return trpcQuery<unknown>('presentations.getByIdDirect', { id });
}

// ─── Load slides for a presentation ───
export async function apiLoadSlides(presentationId: number): Promise<unknown[]> {
  return trpcQuery<unknown[]>('presentations.getSlides', { presentationId });
}

// ─── List presentations ───
export async function apiListPresentations(): Promise<unknown[]> {
  return trpcQuery<unknown[]>('presentations.list');
}

// ─── Delete presentation ───
export async function apiDeletePresentation(id: number): Promise<{ success: boolean }> {
  return trpcMutate<{ success: boolean }>('presentations.deleteWithSlides', { id });
}

// ─── AI Status ───
export async function apiGetAIStatus(): Promise<{ openai: boolean; nanobanana: boolean; timestamp: string }> {
  return trpcQuery<{ openai: boolean; nanobanana: boolean; timestamp: string }>('ai.aiStatus');
}

// ─── Themes ───
export async function apiListThemes(): Promise<unknown[]> {
  return trpcQuery<unknown[]>('themes.list');
}

export async function apiGetSystemThemes(): Promise<unknown[]> {
  return trpcQuery<unknown[]>('themes.systemThemes');
}
