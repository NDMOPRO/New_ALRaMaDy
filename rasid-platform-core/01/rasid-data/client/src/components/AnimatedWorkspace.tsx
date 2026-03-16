/* ═══════════════════════════════════════════════════════════════
   AnimatedWorkspace — Premium Page Transitions
   Directional slide + crossfade based on tab position
   Preserves scroll position when switching back
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { WORKSPACE_VIEWS } from '@/lib/assets';

type TransitionDirection = 'left' | 'right' | 'none';
type TransitionPhase = 'idle' | 'exit' | 'enter';

interface AnimatedWorkspaceProps {
  activeView: string;
  children: ReactNode;
}

// Get the index of a view in the tab bar for directional transitions
function getViewIndex(viewId: string): number {
  return WORKSPACE_VIEWS.findIndex(v => v.id === viewId);
}

export default function AnimatedWorkspace({ activeView, children }: AnimatedWorkspaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [direction, setDirection] = useState<TransitionDirection>('none');
  const [displayedView, setDisplayedView] = useState(activeView);
  const [displayedChildren, setDisplayedChildren] = useState<ReactNode>(children);
  const prevViewRef = useRef(activeView);
  const scrollPositions = useRef<Map<string, number>>(new Map());
  const isFirstRender = useRef(true);
  const animationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Determine transition direction based on tab positions
  const getDirection = useCallback((from: string, to: string): TransitionDirection => {
    const fromIdx = getViewIndex(from);
    const toIdx = getViewIndex(to);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return 'none';
    // RTL layout: moving to higher index = slide left, lower = slide right
    return toIdx > fromIdx ? 'left' : 'right';
  }, []);

  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevViewRef.current = activeView;
      return;
    }

    if (activeView === prevViewRef.current) return;

    // Save scroll position of outgoing view
    if (containerRef.current) {
      const scrollEl = containerRef.current.querySelector('[data-workspace-scroll]');
      if (scrollEl) {
        scrollPositions.current.set(prevViewRef.current, scrollEl.scrollTop);
      }
    }

    const dir = getDirection(prevViewRef.current, activeView);
    setDirection(dir);

    // Clear any pending animation
    if (animationTimer.current) clearTimeout(animationTimer.current);

    // Phase 1: Exit current view
    setPhase('exit');

    // Phase 2: After exit animation, swap content and enter
    animationTimer.current = setTimeout(() => {
      setDisplayedView(activeView);
      setDisplayedChildren(children);
      setPhase('enter');

      // Phase 3: After enter animation, go idle
      animationTimer.current = setTimeout(() => {
        setPhase('idle');
        setDirection('none');

        // Restore scroll position if we've been here before
        if (containerRef.current) {
          const scrollEl = containerRef.current.querySelector('[data-workspace-scroll]');
          const savedScroll = scrollPositions.current.get(activeView);
          if (scrollEl && savedScroll !== undefined) {
            scrollEl.scrollTop = savedScroll;
          }
        }
      }, 280);
    }, 200);

    prevViewRef.current = activeView;

    return () => {
      if (animationTimer.current) clearTimeout(animationTimer.current);
    };
  }, [activeView, children, getDirection]);

  // Update displayed children when they change and we're idle
  useEffect(() => {
    if (phase === 'idle' && displayedView === activeView) {
      setDisplayedChildren(children);
    }
  }, [children, phase, displayedView, activeView]);

  // Build CSS classes for the transition
  const getTransitionClasses = (): string => {
    if (phase === 'idle') return 'workspace-transition-idle';

    if (phase === 'exit') {
      if (direction === 'left') return 'workspace-exit-left';
      if (direction === 'right') return 'workspace-exit-right';
      return 'workspace-exit-fade';
    }

    if (phase === 'enter') {
      if (direction === 'left') return 'workspace-enter-left';
      if (direction === 'right') return 'workspace-enter-right';
      return 'workspace-enter-fade';
    }

    return '';
  };

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-h-0 overflow-hidden relative ${getTransitionClasses()}`}
      style={{ perspective: '1200px' }}
    >
      <div
        className="h-full w-full workspace-transition-content"
        data-workspace-scroll
      >
        {displayedChildren}
      </div>
    </div>
  );
}
