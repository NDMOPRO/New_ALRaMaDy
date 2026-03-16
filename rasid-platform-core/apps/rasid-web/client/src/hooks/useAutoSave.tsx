/* ═══════════════════════════════════════════════════════════════
   useAutoSave — Auto-save hook with dirty tracking
   - Saves every 30 seconds when data changes
   - Shows save status indicator (saved/saving/unsaved)
   - Debounced to avoid excessive saves
   - Supports any engine (reports, presentations, dashboards, excel)
   ═══════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  /** The data to track for changes */
  data: T;
  /** The save function to call */
  onSave: (data: T) => Promise<void>;
  /** Auto-save interval in ms (default: 30000 = 30s) */
  interval?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Unique key to identify this document (e.g., report ID) */
  documentId?: number | null;
}

export function useAutoSave<T>({
  data,
  onSave,
  interval = 30000,
  enabled = true,
  documentId,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastDataRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const saveInProgressRef = useRef(false);

  // Serialize data for comparison
  const serialized = JSON.stringify(data);

  // Track dirty state
  useEffect(() => {
    if (lastDataRef.current && serialized !== lastDataRef.current) {
      setStatus('unsaved');
    }
    lastDataRef.current = serialized;
  }, [serialized]);

  // Reset when document changes
  useEffect(() => {
    setStatus('idle');
    setLastSaved(null);
    lastDataRef.current = serialized;
  }, [documentId]);

  // The actual save function
  const save = useCallback(async () => {
    if (saveInProgressRef.current) return;
    if (status !== 'unsaved') return;
    
    saveInProgressRef.current = true;
    setStatus('saving');
    
    try {
      await onSave(data);
      if (isMountedRef.current) {
        setStatus('saved');
        setLastSaved(new Date());
        // Reset to idle after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus(prev => prev === 'saved' ? 'idle' : prev);
          }
        }, 3000);
      }
    } catch (err) {
      console.error('[AutoSave] Error:', err);
      if (isMountedRef.current) {
        setStatus('error');
        // Reset to unsaved after 5 seconds so it retries
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus('unsaved');
          }
        }, 5000);
      }
    } finally {
      saveInProgressRef.current = false;
    }
  }, [data, onSave, status]);

  // Manual save
  const forceSave = useCallback(async () => {
    if (saveInProgressRef.current) return;
    saveInProgressRef.current = true;
    setStatus('saving');
    
    try {
      await onSave(data);
      if (isMountedRef.current) {
        setStatus('saved');
        setLastSaved(new Date());
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatus(prev => prev === 'saved' ? 'idle' : prev);
          }
        }, 3000);
      }
    } catch (err) {
      console.error('[AutoSave] Force save error:', err);
      if (isMountedRef.current) {
        setStatus('error');
      }
    } finally {
      saveInProgressRef.current = false;
    }
  }, [data, onSave]);

  // Auto-save interval
  useEffect(() => {
    if (!enabled) return;
    
    timerRef.current = setInterval(() => {
      if (status === 'unsaved' && !saveInProgressRef.current) {
        save();
      }
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [enabled, interval, save, status]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    status,
    lastSaved,
    save: forceSave,
    isDirty: status === 'unsaved',
  };
}

/* ─── Save Status Indicator Component ─── */
export function SaveStatusIndicator({ status, lastSaved }: { status: SaveStatus; lastSaved: Date | null }) {
  const config: Record<SaveStatus, { icon: string; label: string; color: string; animate?: boolean }> = {
    idle: { icon: 'cloud_done', label: '', color: 'text-muted-foreground/40' },
    unsaved: { icon: 'cloud_upload', label: 'تغييرات غير محفوظة', color: 'text-warning' },
    saving: { icon: 'sync', label: 'جاري الحفظ...', color: 'text-primary', animate: true },
    saved: { icon: 'cloud_done', label: 'تم الحفظ', color: 'text-success' },
    error: { icon: 'cloud_off', label: 'خطأ في الحفظ', color: 'text-destructive' },
  };

  const { icon, label, color, animate } = config[status];

  if (status === 'idle' && !lastSaved) return null;

  const timeAgo = lastSaved ? formatTimeAgo(lastSaved) : '';

  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${color} transition-all duration-300`}>
      <span className={`material-symbols-rounded text-[16px] ${animate ? 'animate-spin' : ''}`}>
        {icon}
      </span>
      {label && <span className="font-medium">{label}</span>}
      {status === 'idle' && lastSaved && (
        <span className="text-muted-foreground/50">آخر حفظ: {timeAgo}</span>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  return `منذ ${hours} س`;
}
