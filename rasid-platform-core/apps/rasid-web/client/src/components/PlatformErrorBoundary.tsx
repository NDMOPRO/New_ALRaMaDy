/**
 * PlatformErrorBoundary — Advanced error handling with toast notifications
 * 
 * Provides:
 * - Connection loss/recovery detection with auto-retry toast
 * - Session expiry detection with re-auth prompt
 * - API error handling with retry action
 * - WebSocket disconnect notifications
 * - Platform status change notifications
 */
import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { usePlatformHealth } from '@/hooks/usePlatform';
import { useWebSocket, type SystemEvent, type NotificationEvent } from '@/hooks/useWebSocket';
import MaterialIcon from './MaterialIcon';

// ─── Toast Configuration ─────────────────────────────────────────

const TOAST_IDS = {
  CONNECTION_LOST: 'platform-connection-lost',
  CONNECTION_RESTORED: 'platform-connection-restored',
  SESSION_EXPIRED: 'platform-session-expired',
  WS_DISCONNECTED: 'ws-disconnected',
  WS_RECONNECTING: 'ws-reconnecting',
} as const;

// ─── Error Types ─────────────────────────────────────────────────

export type PlatformErrorType =
  | 'connection_lost'
  | 'connection_restored'
  | 'session_expired'
  | 'api_error'
  | 'ws_disconnected'
  | 'ws_reconnecting'
  | 'rate_limited'
  | 'server_error';

// ─── Main Component ──────────────────────────────────────────────

interface PlatformErrorBoundaryProps {
  children: ReactNode;
}

export default function PlatformErrorBoundary({ children }: PlatformErrorBoundaryProps) {
  const { connected: platformConnected, isLoading: healthLoading } = usePlatformHealth();
  const prevConnected = useRef<boolean | null>(null);
  const reconnectAttempts = useRef(0);

  // ─── WebSocket Event Handlers ──────────────────────────────────

  const handleSystemEvent = useCallback((event: SystemEvent) => {
    // In local/dev mode, suppress all platform connection toasts
    const _isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('manus.computer'));
    if (_isLocal) return;

    // Platform connection status change via WebSocket
    if (event.connected === false && event.source === 'websocket') {
      if (event.reconnecting) {
        toast.loading('جاري إعادة الاتصال بالمنصة...', {
          id: TOAST_IDS.WS_RECONNECTING,
          duration: 10000,
        });
      }
    }

    if (event.connected === true && event.source === 'websocket') {
      toast.dismiss(TOAST_IDS.WS_RECONNECTING);
      toast.success('تم إعادة الاتصال بالمنصة', {
        id: TOAST_IDS.CONNECTION_RESTORED,
        duration: 3000,
      });
    }

    // Session expired
    if (event.message?.includes('انتهت صلاحية الجلسة')) {
      toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.', {
        id: TOAST_IDS.SESSION_EXPIRED,
        duration: Infinity,
        action: {
          label: 'تسجيل الدخول',
          onClick: () => window.location.reload(),
        },
      });
    }
  }, []);

  const handleNotification = useCallback((event: NotificationEvent) => {
    // Map notification type to toast type
    switch (event.type) {
      case 'success':
        toast.success(event.message, { description: event.title, duration: 4000 });
        break;
      case 'warning':
        toast.warning(event.message, { description: event.title, duration: 6000 });
        break;
      case 'error':
        toast.error(event.message, { description: event.title, duration: 8000 });
        break;
      default:
        toast.info(event.message, { description: event.title, duration: 4000 });
    }
  }, []);

  const handleConnectionChange = useCallback((wsConnected: boolean) => {
    // In local/dev mode, suppress all WS connection toasts
    const _isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('manus.computer'));
    if (_isLocal) return;
    if (!wsConnected) {
      // Only show WS disconnect if we were previously connected
      toast.loading('انقطع الاتصال المباشر. جاري إعادة المحاولة...', {
        id: TOAST_IDS.WS_DISCONNECTED,
        duration: 15000,
      });
    } else {
      toast.dismiss(TOAST_IDS.WS_DISCONNECTED);
    }
  }, []);

  // Connect WebSocket with all handlers
  useWebSocket({
    channels: ['system', 'notification'],
    autoConnect: true,
    handlers: {
      onSystemEvent: handleSystemEvent,
      onNotification: handleNotification,
      onConnectionChange: handleConnectionChange,
    },
  });

  // ─── Platform Health Monitoring ────────────────────────────────
  // In local/dev mode, suppress connection toasts since platform engines are not available
  const isLocalMode = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('manus.computer'));

  useEffect(() => {
    if (healthLoading) return;
    // In local/dev mode, silently skip platform connection monitoring
    if (isLocalMode) {
      prevConnected.current = platformConnected;
      return;
    }

    // Skip initial state
    if (prevConnected.current === null) {
      prevConnected.current = platformConnected;
      return;
    }

    // Connection lost
    if (prevConnected.current && !platformConnected) {
      reconnectAttempts.current++;
      toast.error('فقد الاتصال بالمنصة الخلفية', {
        id: TOAST_IDS.CONNECTION_LOST,
        description: 'سيتم استخدام الوضع المحلي حتى عودة الاتصال',
        duration: Infinity,
        action: {
          label: 'إعادة المحاولة',
          onClick: () => {
            toast.loading('جاري إعادة الاتصال...', {
              id: TOAST_IDS.CONNECTION_LOST,
              duration: 5000,
            });
            window.location.reload();
          },
        },
      });
    }

    // Connection restored
    if (!prevConnected.current && platformConnected) {
      toast.dismiss(TOAST_IDS.CONNECTION_LOST);
      toast.success('تم استعادة الاتصال بالمنصة الخلفية', {
        id: TOAST_IDS.CONNECTION_RESTORED,
        description: reconnectAttempts.current > 0
          ? `تمت إعادة الاتصال بعد ${reconnectAttempts.current} محاولة`
          : undefined,
        duration: 4000,
      });
      reconnectAttempts.current = 0;
    }

    prevConnected.current = platformConnected;
  }, [platformConnected, healthLoading, isLocalMode]);

  return <>{children}</>;
}

// ─── Utility Functions for Manual Error Handling ──────────────────

/**
 * Show an API error toast with optional retry
 */
export function showApiError(
  message: string,
  options?: { retry?: () => void; detail?: string }
) {
  toast.error(message, {
    description: options?.detail,
    duration: options?.retry ? 10000 : 5000,
    action: options?.retry
      ? {
          label: 'إعادة المحاولة',
          onClick: options.retry,
        }
      : undefined,
  });
}

/**
 * Show a rate limit toast
 */
export function showRateLimitError(retryAfterMs?: number) {
  const seconds = retryAfterMs ? Math.ceil(retryAfterMs / 1000) : 30;
  toast.warning(`تم تجاوز الحد المسموح. يرجى الانتظار ${seconds} ثانية.`, {
    duration: retryAfterMs || 30000,
  });
}

/**
 * Show a server error toast
 */
export function showServerError(statusCode: number, message?: string) {
  const defaultMsg = statusCode >= 500
    ? 'خطأ في الخادم. يرجى المحاولة لاحقاً.'
    : 'حدث خطأ غير متوقع.';
  toast.error(message || defaultMsg, {
    description: `رمز الخطأ: ${statusCode}`,
    duration: 8000,
  });
}

/**
 * Show a session expired toast with login redirect
 */
export function showSessionExpired() {
  toast.error('انتهت صلاحية الجلسة', {
    id: TOAST_IDS.SESSION_EXPIRED,
    description: 'يرجى تسجيل الدخول مرة أخرى للمتابعة',
    duration: Infinity,
    action: {
      label: 'تسجيل الدخول',
      onClick: () => window.location.reload(),
    },
  });
}

/**
 * Wrap an async operation with automatic error toast handling
 */
export async function withErrorToast<T>(
  operation: () => Promise<T>,
  options?: {
    loadingMessage?: string;
    successMessage?: string;
    errorMessage?: string;
    retry?: boolean;
  }
): Promise<T | null> {
  const toastId = options?.loadingMessage
    ? toast.loading(options.loadingMessage)
    : undefined;

  try {
    const result = await operation();
    if (toastId) {
      toast.dismiss(toastId);
    }
    if (options?.successMessage) {
      toast.success(options.successMessage, { duration: 3000 });
    }
    return result;
  } catch (error: any) {
    if (toastId) {
      toast.dismiss(toastId);
    }

    const message = options?.errorMessage || error?.message || 'حدث خطأ غير متوقع';

    // Check for specific error types
    if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
      showSessionExpired();
    } else if (error?.message?.includes('429') || error?.message?.includes('rate limit')) {
      showRateLimitError();
    } else if (error?.message?.includes('500') || error?.message?.includes('Internal Server')) {
      showServerError(500, message);
    } else {
      showApiError(message, {
        retry: options?.retry ? () => withErrorToast(operation, options) : undefined,
        detail: error?.message !== message ? error?.message : undefined,
      });
    }

    return null;
  }
}
