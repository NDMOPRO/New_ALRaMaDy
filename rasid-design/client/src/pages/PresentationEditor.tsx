/**
 * Presentation Editor — Main Page
 * E02-0001: Single Canvas UI — no pop-ups, wizards, or separate screens
 * E02-0002: All controls in contextual drawer/panel
 * E02-0003: Real-time preview
 * E02-0009: Arabic ELITE — full RTL support
 * E02-0011: Full user control — override any automated decision
 */

import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronRight, ChevronLeft, Play, Download, Undo2, Redo2,
  ZoomIn, ZoomOut, Grid3X3, Eye, EyeOff, Palette, Type, Image,
  BarChart3, Table2, Shapes, Sparkles, Settings, PanelLeftClose,
  PanelLeftOpen, LayoutGrid, FileDown, Presentation, Moon, Sun,
  Copy, Trash2, Lock, Unlock, MoveUp, MoveDown, StickyNote,
  Wand2, BookOpen, Layers, PenTool, MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { usePresentationStore } from '@/engines/presentations/store';
import { SlideCanvas } from '@/engines/presentations/components/SlideCanvas';
import { SlideList } from '@/engines/presentations/components/SlideList';
import { ContextPanel } from '@/engines/presentations/components/ContextPanel';
import { GenerationPanel } from '@/engines/presentations/components/GenerationPanel';
import { PipelineProgress } from '@/engines/presentations/components/PipelineProgress';
import { ToolBar } from '@/engines/presentations/components/ToolBar';
import { PreviewMode } from '@/engines/presentations/components/PreviewMode';
import { NewDeckDialog } from '@/engines/presentations/components/NewDeckDialog';

export default function PresentationEditor() {
  const [, navigate] = useLocation();
  const [showNewDeckDialog, setShowNewDeckDialog] = useState(false);

  const {
    deck,
    activeSlideId,
    selectedElementIds,
    contextPanel,
    isGenerating,
    zoom,
    previewMode,
    slideListCollapsed,
    pipeline,
    setContextPanel,
    setZoom,
    togglePreviewMode,
    toggleSlideList,
    undo,
    redo,
    canUndo,
    canRedo,
    createDeck,
  } = usePresentationStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
        if (e.key === '=') { e.preventDefault(); setZoom(zoom + 10); }
        if (e.key === '-') { e.preventDefault(); setZoom(zoom - 10); }
      }
      if (e.key === 'F5') { e.preventDefault(); togglePreviewMode(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoom, undo, redo, setZoom, togglePreviewMode]);

  // Show new deck dialog if no deck
  useEffect(() => {
    if (!deck) setShowNewDeckDialog(true);
  }, [deck]);

  // Preview mode
  if (previewMode && deck) {
    return <PreviewMode />;
  }

  const activeSlide = deck?.slides.find(s => s.id === activeSlideId);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden" dir="rtl">
      {/* === TOP BAR === */}
      <header className="h-12 border-b border-border flex items-center justify-between px-3 bg-card shrink-0 z-50">
        {/* Right side — Logo & Title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-1.5 text-xs">
            <Presentation className="w-4 h-4" />
            <span className="font-semibold">راصد</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">
            {deck?.properties.title || 'عرض جديد'}
          </span>
          {deck && (
            <Badge variant="outline" className="text-[10px]">
              v{deck.version}
            </Badge>
          )}
        </div>

        {/* Center — Main Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo()}>
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تراجع (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo()}>
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>إعادة (Ctrl+Y)</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom - 10)}>
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تصغير</TooltipContent>
          </Tooltip>
          <span className="text-xs font-mono w-10 text-center text-muted-foreground">{zoom}%</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom + 10)}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>تكبير</TooltipContent>
          </Tooltip>
        </div>

        {/* Left side — Actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={togglePreviewMode}
              >
                <Play className="w-3.5 h-3.5" />
                عرض
              </Button>
            </TooltipTrigger>
            <TooltipContent>عرض تقديمي (F5)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setContextPanel('export')}
              >
                <Download className="w-3.5 h-3.5" />
                تصدير
              </Button>
            </TooltipTrigger>
            <TooltipContent>تصدير العرض</TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            className="gap-1.5 text-xs bg-gold text-gold-foreground hover:bg-gold/90"
            onClick={() => setContextPanel('style')}
          >
            <Sparkles className="w-3.5 h-3.5" />
            توليد ذكي
          </Button>
        </div>
      </header>

      {/* === MAIN AREA === */}
      <div className="flex-1 flex overflow-hidden">
        {/* Slide List (Right in RTL) */}
        <AnimatePresence mode="wait">
          {!slideListCollapsed && deck && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-l border-border bg-card overflow-hidden shrink-0"
            >
              <SlideList />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Slide List */}
        <button
          onClick={toggleSlideList}
          className="w-5 shrink-0 flex items-center justify-center bg-card border-l border-border hover:bg-accent transition-colors"
        >
          {slideListCollapsed ? <PanelLeftOpen className="w-3 h-3" /> : <PanelLeftClose className="w-3 h-3" />}
        </button>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tool Bar */}
          {deck && <ToolBar />}

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden bg-muted/30">
            {deck && activeSlide ? (
              <SlideCanvas />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Presentation className="w-16 h-16 mx-auto text-muted-foreground/30" />
                  <p className="text-muted-foreground">لا يوجد عرض مفتوح</p>
                  <Button onClick={() => setShowNewDeckDialog(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    إنشاء عرض جديد
                  </Button>
                </div>
              </div>
            )}

            {/* Pipeline Progress Overlay */}
            {isGenerating && <PipelineProgress />}
          </div>

          {/* Notes Bar */}
          {deck && activeSlide && (
            <div className="h-8 border-t border-border bg-card flex items-center px-3 gap-2 shrink-0">
              <StickyNote className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground truncate">
                {activeSlide.notes || 'ملاحظات المتحدث — انقر للتحرير'}
              </span>
              <span className="mr-auto text-[10px] text-muted-foreground">
                شريحة {(deck.slides.findIndex(s => s.id === activeSlideId) + 1)} من {deck.slides.length}
              </span>
            </div>
          )}
        </div>

        {/* Context Panel (Left in RTL) */}
        <AnimatePresence mode="wait">
          {contextPanel && deck && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border bg-card overflow-hidden shrink-0"
            >
              {contextPanel === 'style' ? (
                <GenerationPanel />
              ) : (
                <ContextPanel />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* New Deck Dialog */}
      <NewDeckDialog
        open={showNewDeckDialog}
        onOpenChange={setShowNewDeckDialog}
      />
    </div>
  );
}
