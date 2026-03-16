/**
 * useWebSocket — React hook for real-time WebSocket updates
 * 
 * Connects to the server WebSocket at /ws and provides:
 * - Auto-connect/reconnect with exponential backoff
 * - Channel subscription management
 * - Typed event handlers for dashboard, job, system, notification channels
 * - Connection status tracking
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────

export interface WSMessage {
  channel: "dashboard" | "job" | "system" | "notification";
  event: string;
  data: unknown;
  timestamp: number;
}

export interface DashboardUpdateEvent {
  dashboardId: string;
  widgetRef?: string;
  payload?: unknown;
  layout?: unknown;
  status?: string;
}

export interface JobUpdateEvent {
  jobId: string;
  progress?: number;
  stage?: string;
  message?: string;
  result?: unknown;
  error?: string;
}

export interface SystemEvent {
  connected?: boolean;
  source?: string;
  url?: string;
  error?: string;
  reconnecting?: boolean;
  message?: string;
}

export interface NotificationEvent {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface WebSocketHandlers {
  onDashboardUpdate?: (event: DashboardUpdateEvent) => void;
  onJobUpdate?: (event: JobUpdateEvent) => void;
  onSystemEvent?: (event: SystemEvent) => void;
  onNotification?: (event: NotificationEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseWebSocketOptions {
  channels?: string[];
  autoConnect?: boolean;
  handlers?: WebSocketHandlers;
}

interface UseWebSocketReturn {
  connected: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  lastMessage: WSMessage | null;
  reconnectCount: number;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    channels = ["dashboard", "job", "system", "notification"],
    autoConnect = true,
    handlers,
  } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlersRef = useRef(handlers);
  const channelsRef = useRef(channels);
  const mountedRef = useRef(true);

  // Keep refs updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const channelParam = channelsRef.current.join(",");
    return `${protocol}//${window.location.host}/ws?channels=${channelParam}`;
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      if (!mountedRef.current) return;

      setLastMessage(msg);

      const h = handlersRef.current;
      if (!h) return;

      switch (msg.channel) {
        case "dashboard":
          h.onDashboardUpdate?.(msg.data as DashboardUpdateEvent);
          break;
        case "job":
          h.onJobUpdate?.(msg.data as JobUpdateEvent);
          break;
        case "system":
          h.onSystemEvent?.(msg.data as SystemEvent);
          break;
        case "notification":
          h.onNotification?.(msg.data as NotificationEvent);
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    setConnecting(true);

    try {
      const ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        setConnecting(false);
        setReconnectCount(0);
        handlersRef.current?.onConnectionChange?.(true);
        console.log("[WS] Connected to server");
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        setConnecting(false);
        handlersRef.current?.onConnectionChange?.(false);

        // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, reconnectCount), 30000);
        console.log(`[WS] Disconnected, reconnecting in ${delay / 1000}s...`);
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setReconnectCount((c) => c + 1);
            connect();
          }
        }, delay);
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setConnecting(false);
      };

      wsRef.current = ws;
    } catch {
      setConnecting(false);
    }
  }, [getWsUrl, handleMessage, reconnectCount]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", channel }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    mountedRef.current = true;
    if (autoConnect) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connected,
    connecting,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    lastMessage,
    reconnectCount,
  };
}

// ─── Specialized Hooks ───────────────────────────────────────────

/**
 * Hook specifically for dashboard real-time updates
 */
export function useDashboardWebSocket(
  onUpdate?: (event: DashboardUpdateEvent) => void
): { connected: boolean } {
  const { connected } = useWebSocket({
    channels: ["dashboard", "system"],
    handlers: {
      onDashboardUpdate: onUpdate,
    },
  });
  return { connected };
}

/**
 * Hook specifically for AI job progress tracking
 */
export function useJobWebSocket(
  onUpdate?: (event: JobUpdateEvent) => void
): { connected: boolean } {
  const { connected } = useWebSocket({
    channels: ["job", "system"],
    handlers: {
      onJobUpdate: onUpdate,
    },
  });
  return { connected };
}
